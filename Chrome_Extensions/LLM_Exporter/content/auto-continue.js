if (!window.__universalLLMAutoContinueLoaded) {
window.__universalLLMAutoContinueLoaded = true;
/**
 * Auto Continue
 *
 * Controlled prompt repeater:
 * - User chooses the follow-up message.
 * - User chooses exactly how many times it may be sent.
 * - A follow-up is sent only after the current generation has finished.
 * - If enabled while the user is composing the initial prompt, it arms itself
 *   and waits for that generation instead of cancelling.
 * - If enabled while the page is idle and an assistant response already exists,
 *   the first follow-up is sent immediately.
 */
(function () {
  const DEFAULT_MESSAGE = "Continue";
  const DEFAULT_COUNT = 5;
  const MAX_COUNT = 50;
  const POLL_MS = 300;
  const FINISH_SETTLE_MS = 900;

  const state = {
    enabled: false,
    message: DEFAULT_MESSAGE,
    total: DEFAULT_COUNT,
    remaining: 0,
    sent: 0,
    phase: "off",
    generationSeen: false,
    armedForNewGeneration: false,
    internalSend: false,
    timer: null,
    lastGenerationEndAt: 0,
    lastStatus: "Auto Continue is off.",
  };

  const adapters = {
    chatgpt: {
      matches: () => /(^|\.)chatgpt\.com$/.test(location.hostname) || /(^|\.)chat\.openai\.com$/.test(location.hostname),
      stopSelectors: ['button[aria-label*="Stop" i]', 'button[data-testid*="stop" i]'],
      composerSelectors: ['#prompt-textarea', 'textarea[placeholder*="Message" i]', '[contenteditable="true"]'],
      sendSelectors: ['button[data-testid="send-button"]', 'button[aria-label*="Send" i]'],
    },
    claude: {
      matches: () => /(^|\.)claude\.ai$/.test(location.hostname),
      stopSelectors: ['button[aria-label*="Stop" i]', 'button[data-testid*="stop" i]'],
      composerSelectors: ['div[contenteditable="true"]', 'textarea'],
      sendSelectors: ['button[aria-label*="Send" i]', 'button[type="submit"]'],
    },
    deepseek: {
      matches: () => /(^|\.)chat\.deepseek\.com$/.test(location.hostname),
      stopSelectors: [
        'button[aria-label*="Stop" i]',
        'button[data-testid*="stop" i]',
        'button[class*="stop" i]',
        '[class*="ds-stop"] button',
      ],
      composerSelectors: ['textarea', '[contenteditable="true"]', '[role="textbox"]'],
      sendSelectors: [
        'button[aria-label*="Send" i]',
        'button[data-testid*="send" i]',
        'button[class*="send" i]',
        'button[type="submit"]',
      ],
    },
    gemini: {
      matches: () => /(^|\.)gemini\.google\.com$/.test(location.hostname),
      stopSelectors: ['button[aria-label*="Stop" i]', 'button[aria-label*="stop generating" i]'],
      composerSelectors: ['div[contenteditable="true"]', 'textarea', 'rich-textarea [contenteditable="true"]'],
      sendSelectors: ['button[aria-label*="Send" i]', 'button[type="submit"]'],
    },
    grok: {
      matches: () => /(^|\.)grok\.com$/.test(location.hostname) || (/(^|\.)x\.com$/.test(location.hostname) && location.pathname.startsWith("/i/grok")),
      stopSelectors: ['button[aria-label*="Stop" i]', 'button[data-testid*="stop" i]'],
      composerSelectors: ['textarea', '[contenteditable="true"]'],
      sendSelectors: ['button[aria-label*="Send" i]', 'button[type="submit"]'],
    },
  };

  function getAdapter() {
    return Object.values(adapters).find(a => {
      try { return a.matches(); } catch { return false; }
    }) || null;
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
  }

  function findFirst(selectors) {
    for (const selector of selectors || []) {
      try {
        const found = Array.from(document.querySelectorAll(selector)).find(visible);
        if (found) return found;
      } catch {}
    }
    return null;
  }

  function findComposer(adapter = getAdapter()) {
    return adapter ? findFirst(adapter.composerSelectors) : null;
  }

  function composerHasText() {
    const composer = findComposer();
    if (!composer) return false;
    if ("value" in composer) return String(composer.value || "").trim().length > 0;
    return String(composer.innerText || composer.textContent || "").trim().length > 0;
  }

  function isGenerating() {
    const adapter = getAdapter();
    if (!adapter) return false;

    if (findFirst(adapter.stopSelectors)) return true;

    // A disabled send button is a useful fallback while the model is streaming.
    const send = findFirst(adapter.sendSelectors);
    if (send && send.disabled) return true;

    // Some UIs expose a disabled/aria-busy generation state elsewhere.
    const busy = document.querySelector('[aria-busy="true"]');
    if (busy && visible(busy)) return true;

    return false;
  }

  function hasAssistantResponse() {
    return !!document.querySelector(
      '[data-message-author-role="assistant"], .ds-assistant-message-main-content, .font-claude-message, model-response, [class*="message-bubble"]'
    );
  }

  function status(phase, message) {
    state.phase = phase;
    state.lastStatus = message;
    try {
      chrome.runtime.sendMessage({
        type: "AUTO_CONTINUE_STATUS",
        status: snapshot(),
      });
    } catch {}
  }

  function snapshot() {
    return {
      enabled: state.enabled,
      message: state.message,
      total: state.total,
      remaining: state.remaining,
      sent: state.sent,
      phase: state.phase,
      lastStatus: state.lastStatus,
    };
  }

  function stop(reason = "Auto Continue stopped.") {
    state.enabled = false;
    state.remaining = 0;
    state.generationSeen = false;
    state.armedForNewGeneration = false;
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    status("off", reason);
  }

  function schedule(ms, fn) {
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      state.timer = null;
      fn();
    }, ms);
  }

  function fireInput(el) {
    try {
      el.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: null,
      }));
    } catch {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function sendPrompt(prompt) {
    const adapter = getAdapter();
    const composer = findComposer(adapter);
    if (!adapter) throw new Error("No supported AI platform adapter is active.");
    if (!composer) throw new Error("Message composer not found.");

    state.internalSend = true;

    try {
      composer.focus();

      if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
        const proto = Object.getPrototypeOf(composer);
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(composer, prompt);
        else composer.value = prompt;
      } else {
        let inserted = false;
        try {
          inserted = document.execCommand("insertText", false, prompt);
        } catch {}
        if (!inserted) {
          composer.textContent = prompt;
        }
      }

      fireInput(composer);
      await new Promise(resolve => setTimeout(resolve, 180));

      const send = findFirst(adapter.sendSelectors);
      if (send && !send.disabled) {
        send.click();
        return;
      }

      // Keyboard fallback for platforms whose send button isn't exposed.
      composer.focus();
      composer.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      }));
      composer.dispatchEvent(new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      }));
    } finally {
      setTimeout(() => { state.internalSend = false; }, 700);
    }
  }

  async function monitor() {
    if (!state.enabled) return;

    const generating = isGenerating();

    if (generating) {
      state.generationSeen = true;
      state.armedForNewGeneration = false;
      status("generating", `AI is generating… ${state.sent}/${state.total} sent`);
      schedule(POLL_MS, monitor);
      return;
    }

    // If a generation was observed, the transition to idle means it finished.
    if (state.generationSeen) {
      if (!state.lastGenerationEndAt) {
        state.lastGenerationEndAt = Date.now();
      }

      const elapsed = Date.now() - state.lastGenerationEndAt;
      if (elapsed < FINISH_SETTLE_MS) {
        schedule(FINISH_SETTLE_MS - elapsed, monitor);
        return;
      }

      state.generationSeen = false;
      state.lastGenerationEndAt = 0;

      if (state.remaining <= 0) {
        stop(`Completed ${state.sent} automatic message${state.sent === 1 ? "" : "s"}.`);
        return;
      }

      await sendNext();
      return;
    }

    // Armed while the user was composing the original request.
    if (state.armedForNewGeneration) {
      status("armed", `Waiting for your generation to finish… ${state.sent}/${state.total} sent`);
      schedule(POLL_MS, monitor);
      return;
    }

    // Nothing is generating. If we already have a response, this is an idle
    // state and the first configured follow-up can be sent immediately.
    if (hasAssistantResponse()) {
      await sendNext();
      return;
    }

    status("armed", `Waiting for the first generation… ${state.sent}/${state.total} sent`);
    schedule(POLL_MS, monitor);
  }

  async function sendNext() {
    if (!state.enabled || state.remaining <= 0) {
      if (state.enabled) stop(`Completed ${state.sent} automatic message${state.sent === 1 ? "" : "s"}.`);
      return;
    }

    const prompt = state.message.trim() || DEFAULT_MESSAGE;
    const current = state.sent + 1;

    status("sending", `Sending automatic message ${current}/${state.total}…`);

    try {
      await sendPrompt(prompt);
      state.sent += 1;
      state.remaining -= 1;
      state.generationSeen = false;
      state.armedForNewGeneration = false;
      status("sent", `Sent ${state.sent}/${state.total}. Waiting for generation…`);
      schedule(POLL_MS, monitor);
    } catch (err) {
      stop(`Stopped: ${err?.message || "couldn't send the automatic message."}`);
    }
  }

  function userInteraction(event) {
    if (!state.enabled || state.internalSend) return;

    const adapter = getAdapter();
    if (!adapter) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    let composer = null;
    try {
      composer = target.closest(adapter.composerSelectors.join(","));
    } catch {}

    let send = null;
    try {
      send = target.closest(adapter.sendSelectors.join(","));
    } catch {}

    // While waiting for the initial generation, normal typing is allowed.
    // Only a real user send should cancel the automatic queue.
    if (state.sent === 0 && state.armedForNewGeneration) {
      if (send) stop("Stopped because you manually sent a message.");
      return;
    }

    if (composer || send) {
      stop("Stopped because you interacted with the message composer.");
    }
  }

  document.addEventListener("click", userInteraction, true);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "AUTO_CONTINUE_PING") {
      sendResponse({ ok: true, site: getAdapter() ? location.hostname : "unsupported" });
      return true;
    }

    if (message?.type === "AUTO_CONTINUE_GET_STATUS") {
      sendResponse({ ok: true, status: snapshot() });
      return true;
    }

    if (message?.type === "AUTO_CONTINUE_START") {
      const adapter = getAdapter();
      if (!adapter) {
        sendResponse({ ok: false, error: "No supported AI platform adapter is active on this page." });
        return true;
      }

      const total = Math.min(
        MAX_COUNT,
        Math.max(1, Number.parseInt(message.count, 10) || DEFAULT_COUNT)
      );
      const prompt = String(message.prompt ?? DEFAULT_MESSAGE).trim() || DEFAULT_MESSAGE;

      state.enabled = true;
      state.message = prompt;
      state.total = total;
      state.remaining = total;
      state.sent = 0;
      state.generationSeen = isGenerating();
      state.lastGenerationEndAt = 0;

      // If the user has text in the composer, they are preparing the initial
      // request. Arm without sending anything.
      state.armedForNewGeneration = !state.generationSeen && composerHasText();

      status(
        "armed",
        state.generationSeen
          ? `Auto Continue armed. Waiting for generation to finish… 0/${total} sent`
          : state.armedForNewGeneration
            ? `Auto Continue armed. Waiting for your request to finish… 0/${total} sent`
            : hasAssistantResponse()
              ? `Auto Continue armed. Existing response detected. Starting… 0/${total} sent`
              : `Auto Continue armed. Waiting for the first generation… 0/${total} sent`
      );

      if (state.timer) clearTimeout(state.timer);
      schedule(POLL_MS, monitor);

      sendResponse({ ok: true, status: snapshot() });
      return true;
    }

    if (message?.type === "AUTO_CONTINUE_STOP") {
      stop("Auto Continue stopped.");
      sendResponse({ ok: true, status: snapshot() });
      return true;
    }

    return false;
  });
})();

}

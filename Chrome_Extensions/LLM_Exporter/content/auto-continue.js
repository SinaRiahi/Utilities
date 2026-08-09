/**
 * Auto Continue controller.
 *
 * The important rule is: never queue/type the next prompt until the previous
 * assistant response has actually started and then stopped changing.
 *
 * This is deliberately independent from conversation traversal/scrolling.
 */
window.__universalLLMAutoContinueCleanup?.();
window.__universalLLMAutoContinueCleanup = null;
window.__universalLLMAutoContinueLoaded = true;

(function () {
  const DEFAULT_MESSAGE = "Continue";
  const DEFAULT_COUNT = 5;
  const MAX_COUNT = 50;
  const POLL_MS = 350;
  const SETTLE_MS = 1400;
  const START_TIMEOUT_MS = 20000;

  const state = {
    enabled: false,
    message: DEFAULT_MESSAGE,
    total: DEFAULT_COUNT,
    remaining: 0,
    sent: 0,
    phase: "off",
    armedForInitialGeneration: false,
    internalSend: false,
    timer: null,
    stableSince: 0,
    lastSignature: "",
    waitingForSignatureChange: false,
    lastStatus: "Auto Continue is off.",
  };

  const adapters = {
    chatgpt: {
      matches: () => /(^|\.)chatgpt\.com$/.test(location.hostname) || /(^|\.)chat\.openai\.com$/.test(location.hostname),
      composerSelectors: ['#prompt-textarea', 'textarea[placeholder*="Message" i]', '[contenteditable="true"]'],
      sendSelectors: ['button[data-testid="send-button"]', 'button[aria-label*="Send" i]'],
      stopSelectors: ['button[aria-label*="Stop" i]', 'button[data-testid*="stop" i]'],
    },
    claude: {
      matches: () => /(^|\.)claude\.ai$/.test(location.hostname),
      composerSelectors: ['div[contenteditable="true"]', 'textarea'],
      sendSelectors: ['button[aria-label*="Send" i]', 'button[type="submit"]'],
      stopSelectors: ['button[aria-label*="Stop" i]', 'button[data-testid*="stop" i]'],
    },
    deepseek: {
      matches: () => /(^|\.)chat\.deepseek\.com$/.test(location.hostname),
      composerSelectors: [
        'textarea',
        'textarea[placeholder*="message" i]',
        '[contenteditable="true"]',
        '[role="textbox"]',
      ],
      sendSelectors: [
        'button[aria-label*="Send" i]',
        'button[title*="Send" i]',
        'button[data-testid*="send" i]',
        'button[class*="send" i]',
        'button[type="submit"]',
      ],
      stopSelectors: [
        'button[aria-label*="Stop" i]',
        'button[title*="Stop" i]',
        'button[data-testid*="stop" i]',
        'button[class*="stop" i]',
      ],
    },
    gemini: {
      matches: () => /(^|\.)gemini\.google\.com$/.test(location.hostname),
      composerSelectors: ['div[contenteditable="true"]', 'textarea', 'rich-textarea [contenteditable="true"]'],
      sendSelectors: ['button[aria-label*="Send" i]', 'button[type="submit"]'],
      stopSelectors: ['button[aria-label*="Stop" i]', 'button[aria-label*="stop generating" i]'],
    },
    grok: {
      matches: () => /(^|\.)grok\.com$/.test(location.hostname) ||
        (/(^|\.)x\.com$/.test(location.hostname) && location.pathname.startsWith("/i/grok")),
      composerSelectors: ['textarea', '[contenteditable="true"]'],
      sendSelectors: ['button[aria-label*="Send" i]', 'button[type="submit"]'],
      stopSelectors: ['button[aria-label*="Stop" i]', 'button[data-testid*="stop" i]'],
    },
  };

  function getAdapter() {
    return Object.values(adapters).find(a => {
      try { return a.matches(); } catch { return false; }
    }) || null;
  }

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 &&
      style.display !== "none" && style.visibility !== "hidden";
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
    return ("value" in composer)
      ? String(composer.value || "").trim().length > 0
      : String(composer.innerText || composer.textContent || "").trim().length > 0;
  }

  async function getAssistantSignature() {
    try {
      const active = window.ExporterExtractors?.findActive?.();
      if (!active?.extract) return "";

      const result = await active.extract();
      const assistants = (result?.messages || [])
        .filter(m => m?.role === "assistant" && typeof m.markdown === "string" && m.markdown.trim());

      if (!assistants.length) return "";

      // Include both count and the tail of the latest answer. This changes
      // while streaming and remains stable once the response stops changing.
      const latest = assistants[assistants.length - 1].markdown.trim();
      return `${assistants.length}:${latest.length}:${latest.slice(-1200)}`;
    } catch {
      return "";
    }
  }

  function controlsGenerating() {
    const adapter = getAdapter();
    if (!adapter) return false;

    if (findFirst(adapter.stopSelectors)) return true;

    const send = findFirst(adapter.sendSelectors);
    if (send && send.disabled) return true;

    const busy = document.querySelector('[aria-busy="true"]');
    return !!(busy && visible(busy));
  }

  function status(phase, message) {
    state.phase = phase;
    state.lastStatus = message;
    try {
      chrome.runtime.sendMessage({
        type: "AUTO_CONTINUE_V2_STATUS",
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

  function schedule(fn, delay = POLL_MS) {
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      state.timer = null;
      fn();
    }, delay);
  }

  function stop(reason = "Auto Continue stopped.") {
    state.enabled = false;
    state.remaining = 0;
    state.armedForInitialGeneration = false;
    state.waitingForSignatureChange = false;
    state.stableSince = 0;
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    status("off", reason);
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

  async function setComposerText(composer, text) {
    composer.focus();

    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const proto = Object.getPrototypeOf(composer);
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(composer, text);
      else composer.value = text;
      fireInput(composer);
      return;
    }

    // DeepSeek and other React contenteditables: replace the current contents
    // rather than appending to whatever React thinks is selected. execCommand
    // produces an input event that these editors generally accept.
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(composer);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch {}

    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, text);
    } catch {}

    if (!inserted || !composerHasText()) {
      composer.textContent = "";
      const textNode = document.createTextNode(text);
      composer.appendChild(textNode);
      fireInput(composer);
    }
  }

  async function waitForComposerText(expected, timeout = 2500) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const composer = findComposer();
      const value = composer
        ? ("value" in composer
            ? String(composer.value || "")
            : String(composer.innerText || composer.textContent || ""))
        : "";
      if (value.trim() === expected.trim()) return composer;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return findComposer();
  }

  function findDeepSeekSendButton(composer) {
    const adapter = getAdapter();
    const direct = findFirst(adapter?.sendSelectors);
    if (direct && !direct.disabled) return direct;

    // DeepSeek has changed generated class names over time. If the semantic
    // selectors aren't available, find a button physically belonging to the
    // composer/footer area rather than clicking an unrelated page button.
    let parent = composer;
    for (let depth = 0; parent && depth < 6; depth++, parent = parent.parentElement) {
      const buttons = Array.from(parent.querySelectorAll("button")).filter(visible);
      const candidates = buttons.filter(button => {
        if (button.disabled) return false;
        const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""} ${button.textContent || ""}`.toLowerCase();
        if (/send|submit/.test(label)) return true;
        // Icon-only button near a composer is a useful DeepSeek fallback.
        const br = button.getBoundingClientRect();
        const cr = composer.getBoundingClientRect();
        return br.top >= cr.top - 140 && br.left >= cr.left - 80 &&
          br.right <= cr.right + 120 && br.bottom <= cr.bottom + 100;
      });
      if (candidates.length) return candidates[candidates.length - 1];
    }

    return null;
  }

  async function sendPrompt(prompt) {
    const adapter = getAdapter();
    if (!adapter) throw new Error("No supported AI platform adapter is active.");

    const composer = findComposer(adapter);
    if (!composer) throw new Error("Message composer not found.");

    state.internalSend = true;

    try {
      await setComposerText(composer, prompt);

      // Give React/DeepSeek time to commit the controlled input before we
      // attempt submission. This is especially important on the 2nd/3rd
      // automatic turn, where the composer has just been reused.
      const acceptedComposer = await waitForComposerText(prompt);
      if (!acceptedComposer) {
        throw new Error("The message composer did not accept the automatic message.");
      }

      let send = findFirst(adapter.sendSelectors);

      if (adapter === adapters.deepseek) {
        send = findDeepSeekSendButton(acceptedComposer);
      }

      if (send && !send.disabled) {
        send.click();
      } else {
        // Keyboard fallback for platforms whose send button is unavailable.
        acceptedComposer.focus();
        const eventOptions = {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        };
        acceptedComposer.dispatchEvent(new KeyboardEvent("keydown", eventOptions));
        acceptedComposer.dispatchEvent(new KeyboardEvent("keypress", eventOptions));
        acceptedComposer.dispatchEvent(new KeyboardEvent("keyup", eventOptions));
      }

      // Do not immediately continue just because click() returned. Wait until
      // the UI consumes the draft. If it doesn't, retry the DeepSeek send once.
      const sentAt = Date.now();
      let consumed = false;
      while (Date.now() - sentAt < 3000) {
        const current = findComposer(adapter);
        const value = current
          ? ("value" in current
              ? String(current.value || "")
              : String(current.innerText || current.textContent || ""))
          : "";

        if (!value.trim() || controlsGenerating()) {
          consumed = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 120));
      }

      if (!consumed && adapter === adapters.deepseek) {
        const retryComposer = findComposer(adapter);
        const retrySend = retryComposer ? findDeepSeekSendButton(retryComposer) : null;
        if (retrySend && !retrySend.disabled) {
          retrySend.click();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!consumed && composerHasText() && adapter === adapters.deepseek) {
        throw new Error("DeepSeek did not accept the automatic message.");
      }
    } finally {
      setTimeout(() => { state.internalSend = false; }, 1000);
    }
  }

  async function waitForInitialGeneration(baselineSignature) {
    const started = Date.now();

    while (state.enabled && Date.now() - started < START_TIMEOUT_MS) {
      const signature = await getAssistantSignature();

      if (controlsGenerating() || (signature && signature !== baselineSignature)) {
        state.lastSignature = signature || baselineSignature;
        state.armedForInitialGeneration = false;
        state.stableSince = 0;
        status("generating", `AI is generating… ${state.sent}/${state.total} sent`);
        schedule(monitorGeneration);
        return;
      }

      status("armed", `Waiting for the AI to start generating… ${state.sent}/${state.total} sent`);
      await new Promise(resolve => setTimeout(resolve, POLL_MS));
    }

    if (state.enabled) {
      stop("Stopped: I couldn't detect the start of the AI response.");
    }
  }

  async function monitorGeneration() {
    if (!state.enabled) return;

    const signature = await getAssistantSignature();
    const generating = controlsGenerating();

    if (signature && signature !== state.lastSignature) {
      state.lastSignature = signature;
      state.stableSince = 0;
      status("generating", `AI is generating… ${state.sent}/${state.total} sent`);
    }

    if (generating) {
      state.stableSince = 0;
      status("generating", `AI is generating… ${state.sent}/${state.total} sent`);
      schedule(monitorGeneration);
      return;
    }

    // If the DOM stopped changing but the site doesn't expose a stop button,
    // require the extracted answer to remain unchanged for SETTLE_MS.
    if (!state.stableSince) {
      state.stableSince = Date.now();
      status("settling", `AI appears finished. Waiting for it to settle…`);
      schedule(monitorGeneration, SETTLE_MS);
      return;
    }

    if (Date.now() - state.stableSince < SETTLE_MS) {
      schedule(monitorGeneration, SETTLE_MS - (Date.now() - state.stableSince));
      return;
    }

    const confirmed = await getAssistantSignature();
    if (confirmed !== state.lastSignature) {
      state.lastSignature = confirmed;
      state.stableSince = 0;
      schedule(monitorGeneration);
      return;
    }

    state.stableSince = 0;

    if (state.remaining <= 0) {
      stop(`Completed ${state.sent} automatic message${state.sent === 1 ? "" : "s"}.`);
      return;
    }

    await sendNext();
  }

  async function sendNext() {
    if (!state.enabled || state.remaining <= 0) return;

    const prompt = state.message.trim() || DEFAULT_MESSAGE;
    const number = state.sent + 1;
    const baselineSignature = await getAssistantSignature();

    state.waitingForSignatureChange = true;
    state.lastSignature = baselineSignature;
    state.stableSince = 0;

    status("sending", `Sending automatic message ${number}/${state.total}…`);

    try {
      await sendPrompt(prompt);
      state.sent += 1;
      state.remaining -= 1;
      status("waiting", `Sent ${state.sent}/${state.total}. Waiting for the new response…`);

      const started = Date.now();
      while (state.enabled && Date.now() - started < START_TIMEOUT_MS) {
        const signature = await getAssistantSignature();

        if (controlsGenerating() || (signature && signature !== baselineSignature)) {
          state.waitingForSignatureChange = false;
          state.lastSignature = signature || baselineSignature;
          state.stableSince = 0;
          status("generating", `AI is generating… ${state.sent}/${state.total} sent`);
          schedule(monitorGeneration);
          return;
        }

        await new Promise(resolve => setTimeout(resolve, POLL_MS));
      }

      stop(`Stopped: the AI did not start a new response after automatic message ${state.sent}.`);
    } catch (err) {
      stop(`Stopped: ${err?.message || "couldn't send the automatic message."}`);
    }
  }

  async function start(total, prompt) {
    const adapter = getAdapter();
    if (!adapter) throw new Error("No supported AI platform adapter is active on this page.");

    state.enabled = true;
    state.message = prompt || DEFAULT_MESSAGE;
    state.total = total;
    state.remaining = total;
    state.sent = 0;
    state.stableSince = 0;

    const baselineSignature = await getAssistantSignature();

    // If the AI is already generating, wait for that response to finish.
    if (controlsGenerating()) {
      state.lastSignature = baselineSignature;
      status("generating", `Auto Continue armed. Waiting for the current response… 0/${total} sent`);
      schedule(monitorGeneration);
      return;
    }

    // If the user is preparing the initial prompt, don't touch it. Wait for
    // the user to send it, then detect the new assistant response.
    if (composerHasText()) {
      state.armedForInitialGeneration = true;
      state.lastSignature = baselineSignature;
      status("armed", `Auto Continue armed. Send your prompt when ready… 0/${total} sent`);
      waitForInitialGeneration(baselineSignature);
      return;
    }

    // If an assistant response already exists and the page is idle, start the
    // first automatic follow-up immediately.
    if (baselineSignature || document.querySelector(".ds-message, [data-message-author-role='assistant']")) {
      state.lastSignature = baselineSignature;
      status("ready", `Existing response detected. Starting Auto Continue… 0/${total} sent`);
      await sendNext();
      return;
    }

    state.armedForInitialGeneration = true;
    state.lastSignature = baselineSignature;
    status("armed", `Waiting for the first AI response… 0/${total} sent`);
    waitForInitialGeneration(baselineSignature);
  }

  function userInteraction(event) {
    if (!state.enabled || state.internalSend) return;
    const adapter = getAdapter();
    if (!adapter || !(event.target instanceof Element)) return;

    let composer = null;
    let send = null;
    try { composer = event.target.closest(adapter.composerSelectors.join(",")); } catch {}
    try { send = event.target.closest(adapter.sendSelectors.join(",")); } catch {}

    // Typing the initial prompt is allowed. A manual send cancels the queue.
    if (state.sent === 0 && state.armedForInitialGeneration) {
      if (send) stop("Stopped because you manually sent a message.");
      return;
    }

    if (composer || send) {
      stop("Stopped because you interacted with the message composer.");
    }
  }

  const onRuntimeMessage = (message, _sender, sendResponse) => {
    if (message?.type === "AUTO_CONTINUE_V2_PING") {
      sendResponse({ ok: true, site: getAdapter() ? location.hostname : "unsupported" });
      return true;
    }

    if (message?.type === "AUTO_CONTINUE_V2_GET_STATUS") {
      sendResponse({ ok: true, status: snapshot() });
      return true;
    }

    if (message?.type === "AUTO_CONTINUE_V2_START") {
      const total = Math.min(
        MAX_COUNT,
        Math.max(1, Number.parseInt(message.count, 10) || DEFAULT_COUNT)
      );
      const prompt = String(message.prompt ?? DEFAULT_MESSAGE).trim() || DEFAULT_MESSAGE;

      start(total, prompt)
        .then(() => sendResponse({ ok: true, status: snapshot() }))
        .catch(err => sendResponse({
          ok: false,
          error: err?.message || "Couldn't start Auto Continue on this page.",
        }));

      return true;
    }

    if (message?.type === "AUTO_CONTINUE_V2_STOP") {
      stop("Auto Continue stopped.");
      sendResponse({ ok: true, status: snapshot() });
      return true;
    }

    return false;
  };

  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  document.addEventListener("click", userInteraction, true);

  window.__universalLLMAutoContinueCleanup = () => {
    state.enabled = false;
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    document.removeEventListener("click", userInteraction, true);
  };
})();

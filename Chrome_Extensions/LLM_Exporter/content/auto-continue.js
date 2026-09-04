/**
 * Auto Continue / Auto Prompter Controller for LLM Exporter.
 * 
 * Accurately detects generation status across DeepSeek, ChatGPT, Claude, Gemini, and Grok.
 */

// Cleanup any existing instance
if (typeof window.__universalLLMAutoContinueCleanup === "function") {
  window.__universalLLMAutoContinueCleanup();
}
window.__universalLLMAutoContinueCleanup = null;
window.__universalLLMAutoContinueLoaded = true;

const DEFAULT_MESSAGE = "Continue";
const DEFAULT_COUNT = 5;
const MAX_COUNT = 50;
const POLL_MS = 250;
const SETTLE_MS = 1000;
const START_TIMEOUT_MS = 25000;

const state = {
  enabled: false,
  message: DEFAULT_MESSAGE,
  total: DEFAULT_COUNT,
  remaining: 0,
  sent: 0,
  phase: "off",
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
      'textarea[name="search"]',
      'textarea[placeholder*="Message DeepSeek" i]',
      'textarea[id="chat-input"]',
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="发送消息" i]',
      '[contenteditable="true"]',
      '[role="textbox"]'
    ],
    sendSelectors: [
      '.ds-button--primary',
      'div.ds-button--primary',
      'button.ds-button--primary',
      'button[aria-label*="Send" i]',
      'button[title*="Send" i]',
      'button[aria-label*="发送" i]',
      'button[title*="发送" i]',
      'button[data-testid*="send" i]',
      'button[class*="send" i]',
      'div[role="button"][aria-label*="Send" i]',
      'div[role="button"][aria-label*="发送" i]',
      'button[type="submit"]'
    ],
    stopSelectors: [
      'button[aria-label*="Stop" i]',
      'button[title*="Stop" i]',
      'button[aria-label*="停止" i]',
      'button[title*="停止" i]',
      'button[data-testid*="stop" i]',
      'div[role="button"][aria-label*="Stop" i]',
      'div[role="button"][aria-label*="停止" i]',
      'div[aria-label*="Stop" i]',
      'div[title*="Stop" i]',
      'div[aria-label*="停止" i]',
      'div[title*="停止" i]'
    ],
  },
  gemini: {
    matches: () => /(^|\.)gemini\.google\.com$/.test(location.hostname),
    composerSelectors: [
      'div[contenteditable="true"]',
      'textarea',
      'rich-textarea [contenteditable="true"]',
    ],
    sendSelectors: [
      'button[aria-label="Send message"]',
      'button[aria-label="Send message" i]',
    ],
    stopSelectors: [
      'button[aria-label*="Stop" i]',
      'button[aria-label*="stop generating" i]',
      'button[aria-label*="Stop response" i]',
    ],
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
    style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
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

function findActiveStopButton() {
  const adapter = getAdapter();
  if (adapter) {
    const direct = findFirst(adapter.stopSelectors);
    if (direct && visible(direct)) return direct;
  }

  const composer = findComposer();
  let searchArea = composer ? composer.parentElement : document.body;
  for (let depth = 0; composer && searchArea && depth < 6; depth++, searchArea = searchArea.parentElement) {
    const btns = searchArea.querySelectorAll("button, [role='button'], div[class*='button'], div[class*='ds-button']");
    for (const b of btns) {
      if (!visible(b)) continue;
      const label = `${b.getAttribute("aria-label") || ""} ${b.getAttribute("title") || ""} ${b.textContent || ""}`.toLowerCase();
      if (label.includes("stop generating") || label.includes("停止生成") || label === "stop" || label === "停止") {
        return b;
      }
    }
  }

  const allButtons = document.querySelectorAll("button, [role='button'], div[class*='ds-button']");
  for (const b of allButtons) {
    if (!visible(b)) continue;
    const label = `${b.getAttribute("aria-label") || ""} ${b.getAttribute("title") || ""} ${b.textContent || ""}`.toLowerCase();
    if (label.includes("stop generating") || label.includes("停止生成")) return b;
  }

  return null;
}

function isDeepSeekActive() {
  if (!adapters.deepseek.matches()) return false;

  // 1. Explicit visible stop button
  if (findActiveStopButton()) return true;

  // 2. Identify latest assistant turn
  const assistantNodes = Array.from(
    document.querySelectorAll(".ds-message, [class*='ds-message'], [class*='message'], .ds-markdown")
  );
  if (assistantNodes.length === 0) return false;

  const latest = assistantNodes[assistantNodes.length - 1];

  // 3. Active typing cursor
  const cursor = latest.querySelector(".ds-cursor, [class*='cursor-blink'], [class*='streaming']");
  if (cursor && visible(cursor)) return true;

  // 4. Thinking state: only active if spinning/loading icon exists
  const think = latest.querySelector(".ds-think-content, [class*='think-content'], [class*='thinking']");
  if (think && visible(think)) {
    const spinner = think.querySelector("svg.ds-icon-spin, svg[class*='spin'], [class*='loading'], .ds-loading");
    if (spinner && visible(spinner)) return true;

    const thinkText = (think.textContent || "").toLowerCase();
    if (
      (thinkText.includes("thinking...") || thinkText.includes("思考中")) &&
      !thinkText.includes("thought for") &&
      !thinkText.includes("用时") &&
      !thinkText.includes("已深度思考")
    ) {
      return true;
    }
  }

  return false;
}

async function getAssistantSignature() {
  try {
    const active = window.ExporterExtractors?.findActive?.();
    let assistants = [];
    if (active?.extract) {
      const result = await active.extract();
      assistants = (result?.messages || [])
        .filter(m => m?.role === "assistant" && typeof m.markdown === "string" && m.markdown.trim());
    }

    let domTail = "";
    const lastAssistant = document.querySelector(
      ".ds-message:last-of-type, [data-message-author-role='assistant']:last-of-type, [class*='message']:last-of-type, .ds-markdown:last-of-type"
    );
    if (lastAssistant) {
      domTail = (lastAssistant.textContent || "").trim().slice(-1000);
    }

    const latest = assistants.length ? assistants[assistants.length - 1].markdown.trim() : "";
    return `${assistants.length}:${latest.length}:${latest.slice(-400)}:${domTail.length}:${domTail.slice(-300)}`;
  } catch {
    return "";
  }
}

function controlsGenerating() {
  const adapter = getAdapter();
  if (!adapter) return false;

  if (findActiveStopButton()) return true;

  if (adapter === adapters.deepseek && isDeepSeekActive()) {
    return true;
  }

  // Universal streaming cursors
  const genericCursor = document.querySelector(".result-streaming, .ds-cursor, span[class*='cursor']");
  if (genericCursor && visible(genericCursor)) return true;

  return false;
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
      cancelable: true,
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

  // ContentEditable / Rich editors
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

  if (!inserted) {
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
    if (value.trim().length > 0) return composer;
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  return findComposer();
}

function findDeepSeekSendButton(composer) {
  const adapter = getAdapter();
  for (const sel of adapter?.sendSelectors || []) {
    try {
      const found = Array.from(document.querySelectorAll(sel)).find(el => 
        visible(el) && !el.disabled && !el.classList.contains("ds-button--disabled") && el.getAttribute("aria-disabled") !== "true"
      );
      if (found) return found;
    } catch {}
  }

  if (!composer) return null;

  let parent = composer;
  for (let depth = 0; parent && depth < 7; depth++, parent = parent.parentElement) {
    const candidates = Array.from(parent.querySelectorAll("button, [role='button'], div[class*='ds-button'], div[class*='button']")).filter(visible);
    const activeBtn = candidates.find(btn => {
      if (btn.disabled || btn.classList.contains("ds-button--disabled") || btn.getAttribute("aria-disabled") === "true") return false;
      const label = `${btn.getAttribute("aria-label") || ""} ${btn.getAttribute("title") || ""} ${btn.textContent || ""}`.toLowerCase();
      if (/send|submit|发送/.test(label)) return true;
      if (btn.classList.contains("ds-button--primary") || btn.classList.contains("ds-button--filled")) return true;
      return false;
    });
    if (activeBtn) return activeBtn;
  }

  const cr = composer.getBoundingClientRect();
  const allPossible = Array.from(document.querySelectorAll("button, [role='button'], div[class*='ds-button'], div[class*='button']")).filter(visible);
  const nearby = allPossible.filter(b => {
    if (b.disabled || b.classList.contains("ds-button--disabled") || b.getAttribute("aria-disabled") === "true") return false;
    const br = b.getBoundingClientRect();
    return br.top >= cr.top - 140 && br.bottom <= cr.bottom + 140 &&
           br.left >= cr.left - 60 && br.right <= cr.right + 140;
  });
  if (nearby.length) return nearby[nearby.length - 1];

  return null;
}

function findNearbySendButton(composer) {
  const adapter = getAdapter();
  const direct = findFirst(adapter?.sendSelectors);
  if (direct && !direct.disabled) return direct;

  if (!composer) return null;

  let parent = composer;
  for (let depth = 0; parent && depth < 7; depth++, parent = parent.parentElement) {
    const buttons = Array.from(parent.querySelectorAll("button")).filter(visible);

    const semantic = buttons.find(button => {
      if (button.disabled) return false;
      const label = [
        button.getAttribute("aria-label"),
        button.getAttribute("data-tooltip"),
        button.getAttribute("title"),
        button.getAttribute("mattooltip"),
        button.textContent,
      ].filter(Boolean).join(" ").toLowerCase();

      return /\b(send|submit)\b/.test(label);
    });

    if (semantic) return semantic;

    const cr = composer.getBoundingClientRect();
    const nearby = buttons.filter(button => {
      if (button.disabled) return false;
      const br = button.getBoundingClientRect();
      return (
        br.top >= cr.top - 120 &&
        br.bottom <= cr.bottom + 180 &&
        br.right >= cr.left - 120 &&
        br.left <= cr.right + 180
      );
    });

    if (nearby.length) return nearby[nearby.length - 1];
  }

  return null;
}

async function pressEnter(composer) {
  composer.focus();

  const options = {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    charCode: 13,
    bubbles: true,
    cancelable: true,
    composed: true,
  };

  const down = new KeyboardEvent("keydown", options);
  const pressed = new KeyboardEvent("keypress", options);
  const up = new KeyboardEvent("keyup", options);

  composer.dispatchEvent(down);
  if (!down.defaultPrevented) composer.dispatchEvent(pressed);
  composer.dispatchEvent(up);

  if (!down.defaultPrevented && !pressed.defaultPrevented) {
    const form = composer.closest("form");
    if (form) {
      try {
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit();
          return true;
        }
        form.dispatchEvent(new Event("submit", {
          bubbles: true,
          cancelable: true,
        }));
        return true;
      } catch {}
    }
  }

  return true;
}

async function waitUntilSubmitted(composer, timeout = 3000) {
  const started = Date.now();

  while (Date.now() - started < timeout) {
    const current = findComposer();
    const value = current
      ? ("value" in current
          ? String(current.value || "")
          : String(current.innerText || current.textContent || ""))
      : "";

    if (!value.trim() || controlsGenerating()) return true;

    await new Promise(resolve => setTimeout(resolve, 80));
  }

  return false;
}

async function sendPrompt(prompt) {
  const adapter = getAdapter();
  if (!adapter) throw new Error("No supported AI platform adapter is active.");

  const composer = findComposer(adapter);
  if (!composer) throw new Error("Message composer not found.");

  state.internalSend = true;

  try {
    await setComposerText(composer, prompt);
    const acceptedComposer = await waitForComposerText(prompt);
    if (!acceptedComposer) {
      throw new Error("The message composer did not accept the automatic message.");
    }

    let send = adapter === adapters.deepseek
      ? findDeepSeekSendButton(acceptedComposer)
      : adapter === adapters.gemini
        ? findFirst(adapter.sendSelectors)
        : findNearbySendButton(acceptedComposer);

    let consumed = false;

    // 1) Click real send button if found & enabled
    if (send && !send.disabled) {
      send.click();
      consumed = await waitUntilSubmitted(acceptedComposer, 2000);
    }

    // 2) Simulate Enter
    if (!consumed) {
      await pressEnter(acceptedComposer);
      consumed = await waitUntilSubmitted(acceptedComposer, 2000);
    }

    // 3) Retry send button
    if (!consumed) {
      const retryComposer = findComposer(adapter);
      const retrySend = retryComposer
        ? (adapter === adapters.deepseek
            ? findDeepSeekSendButton(retryComposer)
            : adapter === adapters.gemini
              ? findFirst(adapter.sendSelectors)
              : findNearbySendButton(retryComposer))
        : null;

      if (retrySend && !retrySend.disabled) {
        retrySend.click();
        consumed = await waitUntilSubmitted(retryComposer, 2000);
      }
    }

    if (!consumed) {
      throw new Error("The AI site did not accept the automatic message. The prompt is still in the composer.");
    }
  } finally {
    setTimeout(() => { state.internalSend = false; }, 1000);
  }
}

async function monitorGeneration() {
  if (!state.enabled) return;

  const signature = await getAssistantSignature();
  const generating = controlsGenerating();

  if (signature && signature !== state.lastSignature) {
    state.lastSignature = signature;
    state.stableSince = 0;
    status("generating", `AI is answering… ${state.sent}/${state.total} sent`);
  }

  if (generating) {
    state.stableSince = 0;
    status("generating", `AI is answering… ${state.sent}/${state.total} sent`);
    schedule(monitorGeneration, POLL_MS);
    return;
  }

  // If text stopped changing and no active indicator is visible, settle for SETTLE_MS
  if (!state.stableSince) {
    state.stableSince = Date.now();
    status("settling", `AI finished response. Settle check…`);
    schedule(monitorGeneration, SETTLE_MS);
    return;
  }

  if (Date.now() - state.stableSince < SETTLE_MS) {
    schedule(monitorGeneration, Math.max(100, SETTLE_MS - (Date.now() - state.stableSince)));
    return;
  }

  const confirmed = await getAssistantSignature();
  if (confirmed !== state.lastSignature) {
    state.lastSignature = confirmed;
    state.stableSince = 0;
    schedule(monitorGeneration, POLL_MS);
    return;
  }

  state.stableSince = 0;

  // Record response in memory
  try {
    window.__universalLLMRecorder?.recordNow?.();
  } catch {}

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

  status("sending", `Sending message ${number}/${state.total}…`);

  try {
    await sendPrompt(prompt);
    state.sent += 1;
    state.remaining -= 1;
    status("waiting", `Sent ${state.sent}/${state.total}. Waiting for response…`);

    const started = Date.now();
    while (state.enabled && Date.now() - started < START_TIMEOUT_MS) {
      const signature = await getAssistantSignature();

      if (controlsGenerating() || (signature && signature !== baselineSignature)) {
        state.waitingForSignatureChange = false;
        state.lastSignature = signature || baselineSignature;
        state.stableSince = 0;
        status("generating", `AI is answering… ${state.sent}/${state.total} sent`);
        schedule(monitorGeneration, POLL_MS);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, POLL_MS));
    }

    stop(`Stopped: the AI did not start a new response after message ${state.sent}.`);
  } catch (err) {
    stop(`Stopped: ${err?.message || "couldn't send message."}`);
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

  // If the AI is currently answering, wait for that response to finish before sending follow-up
  if (controlsGenerating()) {
    state.lastSignature = baselineSignature;
    status("generating", `Waiting for current response to finish… 0/${total} sent`);
    schedule(monitorGeneration, POLL_MS);
    return;
  }

  // Otherwise, immediately send the first prompt!
  state.lastSignature = baselineSignature;
  status("ready", `Starting Auto Prompter… 0/${total} sent`);
  await sendNext();
}

function userInteraction(event) {
  if (!state.enabled || state.internalSend) return;
  const adapter = getAdapter();
  if (!adapter || !(event.target instanceof Element)) return;

  let composer = null;
  let send = null;
  try { composer = event.target.closest(adapter.composerSelectors.join(",")); } catch {}
  try { send = event.target.closest(adapter.sendSelectors.join(",")); } catch {}

  if (composer || send) {
    stop("Stopped because you interacted with the composer.");
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
        error: err?.message || "Couldn't start Auto Prompter on this page.",
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

// Global API export
window.__universalLLMAutoContinue = {
  start,
  stop,
  sendNext,
  getStatus: snapshot,
};

chrome.runtime.onMessage.addListener(onRuntimeMessage);
document.addEventListener("click", userInteraction, true);

window.addEventListener("pagehide", () => {
  window.__universalLLMAutoContinueCleanup?.();
});

window.__universalLLMAutoContinueCleanup = () => {
  state.enabled = false;
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
  try {
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
  } catch {}
  try {
    document.removeEventListener("click", userInteraction, true);
  } catch {}
};

/**
 * popup/popup.js
 *
 * Compact message picker for copying LLM responses as Markdown.
 * The popup extracts the currently open conversation, shows every
 * extracted message in order, and lets the user select exactly what
 * should be copied or exported.
 */

const SUPPORTED_HOSTS = [
  { host: "chatgpt.com", label: "ChatGPT" },
  { host: "chat.openai.com", label: "ChatGPT" },
  { host: "claude.ai", label: "Claude" },
  { host: "chat.deepseek.com", label: "DeepSeek" },
  { host: "gemini.google.com", label: "Gemini" },
  { host: "grok.com", label: "Grok" },
  { host: "x.com", label: "Grok" },
];

const el = {
  siteBadge: document.getElementById("site-badge"),
  statusBanner: document.getElementById("status-banner"),
  messageList: document.getElementById("message-list"),
  selectionCount: document.getElementById("selection-count"),
  selectAll: document.getElementById("btn-select-all"),
  deselectAll: document.getElementById("btn-deselect-all"),
  refresh: document.getElementById("btn-refresh"),
  copy: document.getElementById("btn-copy"),
  openMd: document.getElementById("btn-open-md"),
};

let activeTab = null;
let conversation = null;
let selected = new Set();

function showStatus(message, kind = "info") {
  el.statusBanner.textContent = message;
  el.statusBanner.className = `status-banner ${kind}`;
}

function clearStatus() {
  el.statusBanner.className = "status-banner hidden";
}

function getSiteLabel(url) {
  try {
    const hostname = new URL(url).hostname;
    return SUPPORTED_HOSTS.find(
      (s) => hostname === s.host || hostname.endsWith(`.${s.host}`)
    )?.label || null;
  } catch {
    return null;
  }
}

function updateSelectionUI() {
  const count = selected.size;
  const total = conversation?.messages?.length || 0;
  el.selectionCount.textContent = `${count} of ${total} selected`;
  el.copy.disabled = count === 0;
  el.openMd.disabled = false;
}

function renderMessages() {
  el.messageList.replaceChildren();

  const messages = conversation?.messages || [];
  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No messages found.";
    el.messageList.appendChild(empty);
    updateSelectionUI();
    return;
  }

  messages.forEach((message, index) => {
    const row = document.createElement("label");
    row.className = "message-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selected.has(index);
    checkbox.dataset.index = String(index);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selected.add(index);
      else selected.delete(index);
      updateSelectionUI();
    });

    const body = document.createElement("span");
    body.className = "message-body";

    const meta = document.createElement("span");
    meta.className = "message-meta";

    const role = document.createElement("span");
    role.className = `role-badge ${message.role}`;
    role.textContent = message.role === "assistant" ? "AI" : "You";

    const number = document.createElement("span");
    number.textContent = `#${index + 1}`;

    meta.append(role, number);

    const preview = document.createElement("span");
    preview.className = "message-preview";
    preview.textContent = message.markdown
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180) || "(empty)";

    body.append(meta, preview);
    row.append(checkbox, body);
    el.messageList.appendChild(row);
  });

  updateSelectionUI();
}

async function extractConversation() {
  if (!activeTab?.id) {
    showStatus("Couldn't find the active tab.", "error");
    return false;
  }

  clearStatus();
  el.refresh.disabled = true;
  el.copy.disabled = true;
  el.messageList.innerHTML = '<div class="loading-state">Reading conversation…</div>';

  const response = await new Promise((resolve) => {
    chrome.tabs.sendMessage(
      activeTab.id,
      { type: "EXPORTER_EXTRACT_REQUEST" },
      (result) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            error: "Couldn't read this page. Reload the chat and try again.",
          });
          return;
        }
        resolve(result || { ok: false, error: "No response from the page." });
      }
    );
  });

  el.refresh.disabled = false;

  if (!response.ok) {
    conversation = null;
    selected.clear();
    el.messageList.innerHTML = "";
    updateSelectionUI();
    showStatus(response.error || "Couldn't read the conversation.", "error");
    return false;
  }

  conversation = response.conversation;

  // This tool is primarily for collecting AI output, so assistant messages
  // are selected by default. User messages remain selectable for flexibility.
  selected = new Set(
    conversation.messages
      .map((message, index) => (message.role === "assistant" ? index : -1))
      .filter((index) => index >= 0)
  );

  renderMessages();
  return true;
}

function getSelectedConversation() {
  if (!conversation) return null;

  const messages = conversation.messages.filter((_, index) => selected.has(index));
  return { ...conversation, messages };
}

function selectedMarkdown() {
  return getSelectedConversation()
    ?.messages
    .map((message) => message.markdown.trim())
    .filter(Boolean)
    .join("\n\n") || "";
}

async function copySelected() {
  const markdown = selectedMarkdown();
  if (!markdown) {
    showStatus("Select at least one message.", "error");
    return;
  }

  el.copy.disabled = true;
  el.copy.textContent = "Copying…";

  try {
    await navigator.clipboard.writeText(markdown);
    showStatus(
      `${selected.size} message${selected.size === 1 ? "" : "s"} copied as Markdown.`,
      "success"
    );
  } catch (err) {
    console.error("[LLM Exporter] clipboard error:", err);
    showStatus(
      "Clipboard access failed. Try clicking the button again or check browser permissions.",
      "error"
    );
  } finally {
    el.copy.disabled = selected.size === 0;
    el.copy.textContent = "Copy selected Markdown";
  }
}

function openMarkdownStudio() {
  chrome.tabs.create({
    url: "https://sinariahi.github.io/Utilities/MD_Studio/index.html",
  });
}

async function detectSiteAndLoad() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;

  const site = tab?.url ? getSiteLabel(tab.url) : null;
  if (!site) {
    el.siteBadge.textContent = "Unsupported";
    el.siteBadge.className = "site-badge unsupported";
    showStatus(
      "Open a conversation on ChatGPT, Claude, DeepSeek, Gemini, or Grok.",
      "info"
    );
    el.refresh.disabled = true;
    return;
  }

  el.siteBadge.textContent = site;
  el.siteBadge.className = "site-badge supported";
  await extractConversation();
}

function setAllSelected(value) {
  if (!conversation) return;
  selected = value
    ? new Set(conversation.messages.map((_, index) => index))
    : new Set();
  renderMessages();
}

function init() {
  el.selectAll.addEventListener("click", () => setAllSelected(true));
  el.deselectAll.addEventListener("click", () => setAllSelected(false));
  el.refresh.addEventListener("click", extractConversation);
  el.copy.addEventListener("click", copySelected);
  el.openMd.addEventListener("click", openMarkdownStudio);
  detectSiteAndLoad();
}

init();

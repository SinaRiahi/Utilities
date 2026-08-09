/** Compact message picker + Auto Continue controller. */
const SUPPORTED_HOSTS = [
  { host: "chatgpt.com", label: "ChatGPT" },
  { host: "chat.openai.com", label: "ChatGPT" },
  { host: "claude.ai", label: "Claude" },
  { host: "chat.deepseek.com", label: "DeepSeek" },
  { host: "gemini.google.com", label: "Gemini" },
  { host: "grok.com", label: "Grok" },
  { host: "x.com", label: "Grok" },
];
const MD_STUDIO_URL = "https://sinariahi.github.io/Utilities/MD_Studio/index.html";
const el = {
  siteBadge: document.getElementById("site-badge"), statusBanner: document.getElementById("status-banner"),
  messageList: document.getElementById("message-list"), selectionCount: document.getElementById("selection-count"),
  selectAll: document.getElementById("btn-select-all"), deselectAll: document.getElementById("btn-deselect-all"),
  scroll: document.getElementById("btn-scroll"), refresh: document.getElementById("btn-refresh"), copy: document.getElementById("btn-copy"), openMd: document.getElementById("btn-open-md"),
  autoToggle: document.getElementById("auto-toggle"), autoState: document.getElementById("auto-state"), autoConfig: document.getElementById("auto-config"),
  autoPrompt: document.getElementById("auto-prompt"), autoCount: document.getElementById("auto-count"), autoStatus: document.getElementById("auto-status"),
};
let activeTab = null, conversation = null, selected = new Set(), autoStatusTimer = null;

function showStatus(message, kind = "info") { el.statusBanner.textContent = message; el.statusBanner.className = `status-banner ${kind}`; }
function clearStatus() { el.statusBanner.className = "status-banner hidden"; }
function getSiteLabel(url) { try { const hostname = new URL(url).hostname; return SUPPORTED_HOSTS.find(s => hostname === s.host || hostname.endsWith(`.${s.host}`))?.label || null; } catch { return null; } }
function updateSelectionUI() { const count = selected.size, total = conversation?.messages?.length || 0; el.selectionCount.textContent = `${count} of ${total} selected`; el.copy.disabled = count === 0; el.openMd.disabled = false; }
function renderMessages() {
  el.messageList.replaceChildren(); const messages = conversation?.messages || [];
  if (!messages.length) { const empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = "No messages found."; el.messageList.appendChild(empty); updateSelectionUI(); return; }
  messages.forEach((message, index) => {
    const row = document.createElement("label"); row.className = "message-row";
    const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = selected.has(index); checkbox.dataset.index = String(index);
    checkbox.addEventListener("change", () => { if (checkbox.checked) selected.add(index); else selected.delete(index); updateSelectionUI(); });
    const body = document.createElement("span"); body.className = "message-body";
    const meta = document.createElement("span"); meta.className = "message-meta";
    const role = document.createElement("span"); role.className = `role-badge ${message.role}`; role.textContent = message.role === "assistant" ? "AI" : "You";
    const number = document.createElement("span"); number.textContent = `#${index + 1}`; meta.append(role, number);
    const preview = document.createElement("span"); preview.className = "message-preview"; preview.textContent = message.markdown.replace(/\s+/g, " ").trim().slice(0, 180) || "(empty)";
    body.append(meta, preview); row.append(checkbox, body); el.messageList.appendChild(row);
  });
  updateSelectionUI();
}
function sendToPage(message) {
  return new Promise(resolve => chrome.tabs.sendMessage(activeTab.id, message, result => { if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message }); else resolve(result || { ok: false }); }));
}
async function extractConversation() {
  if (!activeTab?.id) { showStatus("Couldn't find the active tab.", "error"); return false; }
  clearStatus(); el.refresh.disabled = true; el.copy.disabled = true; el.messageList.innerHTML = '<div class="loading-state">Reading conversation…</div>';
  const response = await sendToPage({ type: "EXPORTER_EXTRACT_CURRENT_REQUEST" }); el.refresh.disabled = false;
  if (!response.ok) { conversation = null; selected.clear(); el.messageList.innerHTML = ""; updateSelectionUI(); showStatus(response.error || "Couldn't read the conversation.", "error"); return false; }
  conversation = response.conversation;
  selected = new Set(conversation.messages.map((m, i) => m.role === "assistant" ? i : -1).filter(i => i >= 0));
  renderMessages();
  if (response.conversation.traversal?.traversed) showStatus(`Found ${conversation.messages.length} messages after checking the conversation history.`, "success");
  return true;
}
async function scrollConversation() {
  if (!activeTab?.id) return;
  el.scroll.disabled = true;
  el.refresh.disabled = true;
  clearStatus();
  showStatus("Scrolling through the conversation…", "info");

  const response = await sendToPage({ type: "EXPORTER_TRAVERSE_REQUEST_V2" });

  el.scroll.disabled = false;
  el.refresh.disabled = false;

  if (!response.ok) {
    showStatus(response.error || "Couldn't scroll through the conversation.", "error");
    return;
  }

  conversation = response.conversation;
  selected = new Set(
    conversation.messages
      .map((m, i) => m.role === "assistant" ? i : -1)
      .filter(i => i >= 0)
  );
  renderMessages();
  showStatus(
    `Loaded ${conversation.messages.length} messages from the conversation.`,
    "success"
  );
}

function selectedMarkdown() { return conversation?.messages.filter((_, i) => selected.has(i)).map(m => m.markdown.trim()).filter(Boolean).join("\n\n") || ""; }
async function copySelected() {
  const markdown = selectedMarkdown(); if (!markdown) { showStatus("Select at least one message.", "error"); return; }
  el.copy.disabled = true; el.copy.textContent = "Copying…";
  try { await navigator.clipboard.writeText(markdown); showStatus(`${selected.size} message${selected.size === 1 ? "" : "s"} copied as Markdown.`, "success"); }
  catch (err) { console.error(err); showStatus("Clipboard access failed. Try again or check browser permissions.", "error"); }
  finally { el.copy.disabled = selected.size === 0; el.copy.textContent = "Copy selected Markdown"; }
}
function openMarkdownStudio() { chrome.tabs.create({ url: MD_STUDIO_URL }); }
function setAllSelected(value) { if (!conversation) return; selected = value ? new Set(conversation.messages.map((_, i) => i)) : new Set(); renderMessages(); }
function renderAutoStatus(status) {
  if (!status) return;
  el.autoToggle.checked = !!status.enabled;
  el.autoState.textContent = status.enabled ? "ON" : "OFF";
  el.autoState.className = `auto-state ${status.enabled ? "on" : ""}`;
  el.autoConfig.classList.toggle("disabled", !status.enabled && status.phase === "off");
  el.autoStatus.textContent = status.lastStatus || (status.enabled ? `Waiting… ${status.sent}/${status.total}` : "Waiting for the next generation.");
  if (status.enabled) el.autoStatus.textContent = `${status.lastStatus}  •  ${status.remaining} remaining`;
}
async function loadAutoStatus() {
  const response = await sendToPage({ type: "AUTO_CONTINUE_V2_GET_STATUS" }); if (response.ok) renderAutoStatus(response.status);
}
async function toggleAuto() {
  if (!el.autoToggle.checked) {
    const response = await sendToPage({ type: "AUTO_CONTINUE_V2_STOP" });
    if (response.ok) renderAutoStatus(response.status);
    return;
  }

  const prompt = el.autoPrompt.value.trim() || "Continue";
  const count = Math.min(50, Math.max(1, Number.parseInt(el.autoCount.value, 10) || 5));
  el.autoCount.value = String(count);

  // Explicitly inject the Auto Continue controller into the active tab.
  // This makes the feature resilient if another content script on the page
  // failed during startup or Chrome loaded the extension before the tab did.
  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ["content/auto-continue.js"],
    });
  } catch (err) {
    el.autoToggle.checked = false;
    showStatus(
      `Couldn't inject Auto Continue: ${err?.message || "Chrome rejected the script."}`,
      "error"
    );
    return;
  }

  const ping = await sendToPage({ type: "AUTO_CONTINUE_V2_PING" });
  if (!ping.ok) {
    el.autoToggle.checked = false;
    showStatus(
      `Auto Continue still isn't connected: ${ping.error || "unknown error"}`,
      "error"
    );
    return;
  }

  const response = await sendToPage({ type: "AUTO_CONTINUE_V2_START", prompt, count });
  if (response.ok) {
    clearStatus();
    renderAutoStatus(response.status);
  } else {
    el.autoToggle.checked = false;
    showStatus(response.error || "Couldn't start Auto Continue on this page.", "error");
  }
}
async function detectSiteAndLoad() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); activeTab = tab;
  const site = tab?.url ? getSiteLabel(tab.url) : null;
  if (!site) { el.siteBadge.textContent = "Unsupported"; el.siteBadge.className = "site-badge unsupported"; showStatus("Open a conversation on ChatGPT, Claude, DeepSeek, Gemini, or Grok.", "info"); el.refresh.disabled = true; el.autoToggle.disabled = true; return; }
  el.siteBadge.textContent = site; el.siteBadge.className = "site-badge supported";
  await extractConversation();
  await loadAutoStatus();
}
function init() {
  el.selectAll.addEventListener("click", () => setAllSelected(true)); el.deselectAll.addEventListener("click", () => setAllSelected(false));
  el.scroll.addEventListener("click", scrollConversation);
  el.refresh.addEventListener("click", extractConversation); el.copy.addEventListener("click", copySelected); el.openMd.addEventListener("click", openMarkdownStudio);
  el.autoToggle.addEventListener("change", toggleAuto);
  chrome.runtime.onMessage.addListener(message => { if (message?.type === "AUTO_CONTINUE_V2_STATUS") renderAutoStatus(message.status); });
  detectSiteAndLoad();
}
init();

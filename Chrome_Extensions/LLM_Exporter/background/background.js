/**
 * background/background.js
 *
 * MV3 service worker. Renders a conversation supplied by the popup and
 * downloads the resulting PDF/DOCX. Extraction normally happens directly
 * in the popup so the message picker can be populated without a second
 * extraction pass.
 */

const OFFSCREEN_URL = chrome.runtime.getURL("offscreen/offscreen.html");
let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts?.({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [OFFSCREEN_URL],
  });
  if (existing && existing.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: "offscreen/offscreen.html",
    reasons: ["DOM_SCRAPING"],
    justification:
      "Renders the selected LLM conversation messages to PDF or DOCX entirely offline.",
  });

  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

async function renderAndDownload(format, conversation, settings) {
  await ensureOffscreenDocument();

  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "OFFSCREEN_RENDER", format, conversation, settings },
      (res) => resolve(res || { ok: false, error: "No response from renderer." })
    );
  });

  if (!response.ok) return response;

  const downloadId = await chrome.downloads.download({
    url: response.dataUrl,
    filename: response.filename,
    saveAs: false,
  });

  return { ok: true, downloadId, filename: response.filename };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXPORT_CONVERSATION_REQUEST") return false;

  (async () => {
    try {
      if (!message.conversation?.messages?.length) {
        sendResponse({ ok: false, error: "No messages were selected." });
        return;
      }

      const result = await renderAndDownload(
        message.format || "pdf",
        message.conversation,
        message.settings || {}
      );
      sendResponse(result);
    } catch (err) {
      console.error("[LLM Exporter] export failed:", err);
      sendResponse({
        ok: false,
        error: err?.message || "Export failed unexpectedly.",
      });
    }
  })();

  return true;
});

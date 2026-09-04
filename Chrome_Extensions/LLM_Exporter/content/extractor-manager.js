/**
 * Content-script message bridge and long-conversation traversal.
 */

function messageKey(message) {
  return `${message.role}\n${message.markdown.trim()}`;
}

function mergeMessages(target, incoming) {
  const seen = new Set(target.map(messageKey));
  for (const message of incoming || []) {
    if (!message?.markdown?.trim()) continue;
    const key = messageKey(message);
    if (!seen.has(key)) {
      target.push(message);
      seen.add(key);
    }
  }
}

(function () {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "EXPORTER_EXTRACT_CURRENT_REQUEST" && message?.type !== "EXPORTER_TRAVERSE_REQUEST_V2") return false;

    (async () => {
      try {
        const extractor = ExporterExtractors.findActive();
        if (!extractor) {
          sendResponse({ ok: false, error: "This site isn't supported yet." });
          return;
        }

        const ready = await extractor.isReady();
        if (!ready) {
          sendResponse({
            ok: false,
            error: "Couldn't find a conversation on this page. Make sure you're viewing an open chat, then try again.",
          });
          return;
        }

        // First capture what is already rendered. Then traverse only when the
        // page has a substantial scrollable chat area, accumulating newly
        // revealed turns as the DOM changes.
        const initial = await extractor.extract();
        const messages = [];

        // If the in-memory recorder has captured messages across this session,
        // merge them first so virtualized/unloaded messages are preserved.
        if (window.__universalLLMRecorder) {
          try {
            await window.__universalLLMRecorder.recordNow();
            const ledger = window.__universalLLMRecorder.getLedger();
            if (Array.isArray(ledger) && ledger.length > 0) {
              mergeMessages(messages, ledger);
            }
          } catch {}
        }

        mergeMessages(messages, initial.messages);

        // Do not scroll or traverse automatically. The user can explicitly
        // request full-history traversal from the popup.
        let traversal = { traversed: false, reason: "manual-only" };
        if (message?.type === "EXPORTER_TRAVERSE_REQUEST_V2" &&
            typeof ExporterUtils.traverseConversation === "function") {
          traversal = await ExporterUtils.traverseConversation(async () => {
            const snapshot = await extractor.extract();
            mergeMessages(messages, snapshot.messages);
          });
        }

        if (!messages.length) {
          sendResponse({
            ok: false,
            error: "No messages were found to export. The page layout may have changed, or the conversation is empty.",
          });
          return;
        }

        // Traversal starts at the top and discovers turns in conversation order.
        // If a platform exposes a reversed DOM order, its extractor can still
        // return that order; we preserve the extractor's first-seen sequence.
        sendResponse({
          ok: true,
          conversation: {
            ...initial,
            messages,
            traversal,
          },
        });
      } catch (err) {
        console.error("[LLM Exporter] extraction failed:", err);
        sendResponse({ ok: false, error: "Something went wrong reading this conversation. Please try again." });
      }
    })();

    return true;
  });
})();

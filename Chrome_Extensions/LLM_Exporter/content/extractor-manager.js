/**
 * content/extractor-manager.js
 *
 * Injected into every supported LLM site. Loads the shared utils, the
 * extractor base registry, and every site-specific extractor module, then
 * listens for a "EXPORTER_EXTRACT_REQUEST" message from the popup.
 *
 * The renderer (popup + renderer/*) never talks to the DOM directly - this
 * is the only file that touches document.querySelector on the host page.
 * It always responds with a plain, serializable ExtractedConversation
 * object (or an error), never DOM nodes.
 */

(function loadExtractorScripts() {
  // Content scripts declared in manifest.json already run in order
  // (utils -> base -> chatgpt -> claude -> ...), so by the time this file's
  // own top-level code runs, `ExporterUtils`, `ExporterExtractors`, and all
  // registered site extractors are already available on `self`.

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "EXPORTER_EXTRACT_REQUEST") return false;

    (async () => {
      try {
        const extractor = ExporterExtractors.findActive();
        if (!extractor) {
          sendResponse({
            ok: false,
            error: "This site isn't supported yet.",
          });
          return;
        }

        const ready = await extractor.isReady();
        if (!ready) {
          sendResponse({
            ok: false,
            error:
              "Couldn't find a conversation on this page. Make sure you're viewing an open chat, then try again.",
          });
          return;
        }

        const conversation = await extractor.extract();
        if (!conversation.messages || conversation.messages.length === 0) {
          sendResponse({
            ok: false,
            error:
              "No messages were found to export. The page layout may have changed, or the conversation is empty.",
          });
          return;
        }

        sendResponse({ ok: true, conversation });
      } catch (err) {
        console.error("[LLM Exporter] extraction failed:", err);
        sendResponse({
          ok: false,
          error: "Something went wrong reading this conversation. Please try again.",
        });
      }
    })();

    return true; // keep the message channel open for the async response
  });
})();

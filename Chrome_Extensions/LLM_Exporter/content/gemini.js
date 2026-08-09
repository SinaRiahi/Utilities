/**
 * content/gemini.js
 *
 * Extractor for gemini.google.com.
 *
 * Stability notes:
 *  - Gemini's web UI is built with Angular and uses custom element tag
 *    names for conversation turns - `<user-query>` for the user's message
 *    and `<message-content>` (inside a `<model-response>`) for Gemini's
 *    reply. Custom element tag names are effectively part of the
 *    Angular component's public contract and have proven more stable
 *    than the surrounding utility classes, so we anchor on tag names
 *    here rather than any `class="..."`.
 *  - Fails closed (zero messages) rather than throwing if Google changes
 *    this structure.
 */

(function registerGeminiExtractor() {
  const USER_TAG = "user-query";
  const ASSISTANT_TAG = "message-content";

  function getConversationTitle() {
    const titleEl = document.querySelector("title");
    let title = titleEl ? titleEl.textContent.trim() : "";
    title = title.replace(/\s*[|\u2013-]\s*Gemini\s*$/i, "").trim();
    return title || "Gemini Conversation";
  }

  function collectTurnsInOrder() {
    const candidates = document.querySelectorAll(`${USER_TAG}, ${ASSISTANT_TAG}`);
    const turns = [];
    candidates.forEach((el) => {
      if (el.tagName.toLowerCase() === USER_TAG) {
        turns.push({ role: "user", el });
      } else if (el.tagName.toLowerCase() === ASSISTANT_TAG) {
        turns.push({ role: "assistant", el });
      }
    });
    return turns;
  }

  async function isReady() {
    const el = await ExporterUtils.waitForSelector(`${USER_TAG}, ${ASSISTANT_TAG}`, 8000);
    return !!el;
  }

  async function extract() {
    const turns = collectTurnsInOrder();
    const messages = [];

    for (const { role, el } of turns) {
      const markdown = ExporterUtils.domToMarkdown(el);
      if (!markdown.trim()) continue;
      messages.push({ role, markdown });
    }

    return {
      site: "gemini",
      title: getConversationTitle(),
      url: location.href,
      extractedAt: new Date().toISOString(),
      messages,
    };
  }

  ExporterExtractors.register({
    id: "gemini",
    matches() {
      return /(^|\.)gemini\.google\.com$/.test(location.hostname);
    },
    isReady,
    extract,
  });
})();

/**
 * content/gemini.js
 *
 * Extractor for gemini.google.com.
 *
 * Gemini's chat DOM is organized around conversation-turn custom elements:
 *   user-query
 *   model-response
 *
 * A model-response normally contains:
 *   message-content.model-response-text
 *     -> div.markdown.markdown-main-panel
 *
 * The previous extractor treated every `message-content` element as a
 * top-level assistant turn. That is too granular and can make the Auto
 * Continue controller see the wrong response count/signature.
 *
 * This extractor anchors assistant turns on `model-response` and only uses
 * message-content/markdown wrappers as the content root.
 */

(function registerGeminiExtractor() {
  const USER_SELECTOR = "user-query";
  const MODEL_SELECTOR = "model-response";

  const MODEL_CONTENT_SELECTORS = [
    "message-content.model-response-text",
    "message-content",
    ".response-content",
    "div.markdown.markdown-main-panel",
    ".markdown-main-panel",
  ];

  const USER_CONTENT_SELECTORS = [
    ".query-text",
    ".user-query-text",
    "[data-message-author-role='user']",
  ];

  function getConversationTitle() {
    const titleEl =
      document.querySelector("title") ||
      document.querySelector('[data-test-id="chat-title"]');

    let title = titleEl ? titleEl.textContent.trim() : "";
    title = title.replace(/\s*[|\u2013-]\s*Gemini\s*$/i, "").trim();

    return title || "Gemini Conversation";
  }

  function firstDescendant(root, selectors) {
    if (!root) return null;

    for (const selector of selectors) {
      try {
        const found = root.querySelector(selector);
        if (found) return found;
      } catch {}
    }

    return null;
  }

  function collectTurnsInOrder() {
    /*
     * Prefer the actual turn containers. This gives us one assistant message
     * per Gemini response instead of one entry for every nested message-
     * content element.
     */
    const turnNodes = Array.from(
      document.querySelectorAll(`${USER_SELECTOR}, ${MODEL_SELECTOR}`)
    );

    if (turnNodes.length) {
      return turnNodes
        .map((el) => ({
          role:
            el.tagName.toLowerCase() === USER_SELECTOR
              ? "user"
              : "assistant",
          el,
        }))
        .filter(({ el }) => (el.textContent || "").trim().length > 0);
    }

    /*
     * Fallback for UI variants where model-response isn't present but the
     * rendered response wrapper still is.
     */
    const fallback = [];

    document.querySelectorAll("message-content").forEach((el) => {
      if (!(el.textContent || "").trim()) return;

      const isModel =
        el.classList.contains("model-response-text") ||
        !!el.closest("model-response") ||
        !!el.querySelector(".markdown.markdown-main-panel");

      if (isModel) {
        fallback.push({ role: "assistant", el });
      }
    });

    return fallback;
  }

  function getContentNode(turnEl, role) {
    if (!turnEl) return null;

    if (role === "assistant") {
      return (
        firstDescendant(turnEl, MODEL_CONTENT_SELECTORS) ||
        turnEl
      );
    }

    return (
      firstDescendant(turnEl, USER_CONTENT_SELECTORS) ||
      turnEl
    );
  }

  async function isReady() {
    const el = await ExporterUtils.waitForSelector(
      `${USER_SELECTOR}, ${MODEL_SELECTOR}, message-content`,
      10000
    );

    return !!el;
  }

  async function extract() {
    const turns = collectTurnsInOrder();
    const messages = [];

    for (const { role, el } of turns) {
      const contentNode = getContentNode(el, role);
      if (!contentNode) continue;

      const markdown = ExporterUtils.domToMarkdown(contentNode);
      if (!markdown.trim()) continue;

      messages.push({
        role,
        markdown,
      });
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

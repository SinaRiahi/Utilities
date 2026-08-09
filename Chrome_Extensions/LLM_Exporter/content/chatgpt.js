/**
 * content/chatgpt.js
 *
 * Extractor for chatgpt.com / chat.openai.com.
 *
 * Stability notes:
 *  - ChatGPT tags each conversation turn's content wrapper with
 *    `data-message-author-role="user"|"assistant"` — this is a semantic
 *    attribute (not a styling class) and has been the most stable hook
 *    across ChatGPT UI redesigns, so we anchor extraction on it rather
 *    than any `class="..."` name.
 *  - We deliberately do NOT depend on specific class names for layout
 *    (flex containers, avatar wrappers, etc). Only the author-role
 *    attribute and standard rendered-markdown tags (h1-h6, p, pre, code,
 *    ul/ol, table, blockquote, img, a) are relied upon.
 *  - If OpenAI changes this attribute, extraction will fail closed (return
 *    zero messages) rather than throw, and the popup surfaces a friendly
 *    "couldn't find a conversation" message per the spec.
 */

(function registerChatGPTExtractor() {
  const SELECTOR_TURN = "[data-message-author-role]";

  function getConversationTitle() {
    const titleEl =
      document.querySelector('[data-testid="conversation-title"]') ||
      document.querySelector("title");
    let title = titleEl ? titleEl.textContent.trim() : "";
    // <title> is usually "My Chat Title" or "My Chat Title | ChatGPT"
    title = title.replace(/\s*[|\u2013-]\s*ChatGPT\s*$/i, "").trim();
    return title || "ChatGPT Conversation";
  }

  function roleFromAttr(el) {
    const role = el.getAttribute("data-message-author-role");
    if (role === "user") return "user";
    if (role === "assistant") return "assistant";
    return null; // system/tool turns are skipped
  }

  /**
   * The author-role attribute sits on an inner content node; the actual
   * rendered Markdown body is usually a sibling/descendant with the
   * `.markdown` rendering wrapper for assistant turns, or plain text
   * paragraphs for user turns. We search a small neighborhood rather than
   * assuming an exact depth, since OpenAI has shifted nesting before.
   */
  function findContentRoot(turnEl) {
    return (
      turnEl.querySelector(".markdown") || // assistant rich-rendered markdown
      turnEl.querySelector("[data-message-author-role] > div") ||
      turnEl
    );
  }

  async function isReady() {
    const el = await ExporterUtils.waitForSelector(SELECTOR_TURN, 8000);
    return !!el;
  }

  async function extract() {
    const turns = Array.from(document.querySelectorAll(SELECTOR_TURN));
    const messages = [];

    for (const turn of turns) {
      const role = roleFromAttr(turn);
      if (!role) continue;

      const contentRoot = findContentRoot(turn);
      const markdown = ExporterUtils.domToMarkdown(contentRoot);
      if (!markdown.trim()) continue;

      messages.push({ role, markdown });
    }

    return {
      site: "chatgpt",
      title: getConversationTitle(),
      url: location.href,
      extractedAt: new Date().toISOString(),
      messages,
    };
  }

  ExporterExtractors.register({
    id: "chatgpt",
    matches() {
      return /(^|\.)chatgpt\.com$/.test(location.hostname) || /(^|\.)chat\.openai\.com$/.test(location.hostname);
    },
    isReady,
    extract,
  });
})();

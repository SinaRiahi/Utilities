/**
 * DeepSeek extractor.
 *
 * DeepSeek's current chat UI uses `.ds-message` for individual turns and
 * `.ds-markdown` for rendered Markdown. Assistant turns additionally expose
 * `.ds-assistant-message-main-content`; thinking/reasoning is rendered under
 * `.ds-think-content` and is deliberately excluded from the normal response.
 *
 * We keep a few historical fallbacks because DeepSeek changes generated class
 * names fairly often.
 */
(function registerDeepSeekExtractor() {
  const MESSAGE_SELECTOR = ".ds-message";
  const ASSISTANT_CONTENT_SELECTOR = [
    ".ds-assistant-message-main-content",
    ".ds-markdown",
    "[class*='markdown-body']",
  ].join(", ");
  const USER_CONTENT_SELECTOR = [
    "._9663006",
    ".fbb737a4",
    "[data-message-author-role='user']",
  ].join(", ");

  function getConversationTitle() {
    const titleEl = document.querySelector("title");
    let title = titleEl ? titleEl.textContent.trim() : "";
    title = title.replace(/\s*[|\u2013-]\s*DeepSeek\s*$/i, "").trim();
    return title || "DeepSeek Conversation";
  }

  function isAssistantTurn(node) {
    if (!node) return false;
    return !!node.querySelector(
      ".ds-assistant-message-main-content, .ds-think-content"
    );
  }

  function getContentNode(node, role) {
    if (!node) return null;

    if (role === "assistant") {
      return (
        node.querySelector(".ds-assistant-message-main-content") ||
        Array.from(node.querySelectorAll(".ds-markdown")).find(
          (el) => !el.closest(".ds-think-content")
        ) ||
        node.querySelector("[class*='markdown-body']") ||
        node
      );
    }

    return node.querySelector(USER_CONTENT_SELECTOR) || node;
  }

  function collectTurnsInOrder() {
    // Preferred/current structure: one `.ds-message` per turn.
    const messageNodes = Array.from(document.querySelectorAll(MESSAGE_SELECTOR));
    if (messageNodes.length) {
      return messageNodes
        .map((node) => ({
          role: isAssistantTurn(node) ? "assistant" : "user",
          el: node,
        }))
        .filter(({ el }) => el.textContent.trim().length > 0);
    }

    // Fallback for older DeepSeek builds where message wrappers used generated
    // classes. This is intentionally broad but only accepts blocks containing
    // the known DeepSeek Markdown marker.
    const assistantBlocks = Array.from(
      document.querySelectorAll(ASSISTANT_CONTENT_SELECTOR)
    ).filter((el) => el.textContent.trim().length > 0);

    if (!assistantBlocks.length) return [];

    const turns = [];
    const seen = new Set();
    assistantBlocks.forEach((assistantEl) => {
      const assistantRoot =
        assistantEl.closest("[class*='message'], [class*='Message']") ||
        assistantEl;
      if (!seen.has(assistantRoot)) {
        turns.push({ role: "assistant", el: assistantRoot });
        seen.add(assistantRoot);
      }

      // Walk backward until we find a sibling containing user text. This is
      // only the compatibility path; the `.ds-message` path above is preferred.
      let node = assistantRoot.previousElementSibling;
      let guard = 0;
      while (node && guard++ < 8) {
        if (
          node.textContent?.trim() &&
          !node.querySelector(ASSISTANT_CONTENT_SELECTOR)
        ) {
          if (!seen.has(node)) {
            turns.splice(Math.max(0, turns.length - 1), 0, {
              role: "user",
              el: node,
            });
            seen.add(node);
          }
          break;
        }
        node = node.previousElementSibling;
      }
    });

    return turns;
  }

  async function isReady() {
    // DeepSeek is a SPA and can take a moment to hydrate. `.ds-message` is
    // the strongest current signal; Markdown is the fallback.
    const el = await ExporterUtils.waitForSelector(
      `${MESSAGE_SELECTOR}, ${ASSISTANT_CONTENT_SELECTOR}`,
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

      messages.push({ role, markdown });
    }

    return {
      site: "deepseek",
      title: getConversationTitle(),
      url: location.href,
      extractedAt: new Date().toISOString(),
      messages,
    };
  }

  ExporterExtractors.register({
    id: "deepseek",
    matches() {
      return /(^|\.)chat\.deepseek\.com$/.test(location.hostname);
    },
    isReady,
    extract,
  });
})();

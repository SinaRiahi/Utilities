/**
 * content/claude.js
 *
 * Extractor for claude.ai.
 *
 * Stability notes:
 *  - Claude's web UI marks human turns with `[data-testid="user-message"]`.
 *    `data-testid` is a semantic test hook (not a styling class) and is
 *    the most stable anchor available, same reasoning as the ChatGPT
 *    extractor's `data-message-author-role`.
 *  - Assistant turns don't carry as clean a `data-testid` in all UI
 *    versions, so we fall back to a secondary class-name signal
 *    (`.font-claude-message`) for the assistant's rendered prose
 *    container. This is more fragile than the ChatGPT path and is called
 *    out explicitly here for future maintenance.
 *  - Fails closed (returns zero messages) rather than throwing if Anthropic
 *    changes this structure, per the spec's "friendly error, not a crash"
 *    requirement.
 */

(function registerClaudeExtractor() {
  const USER_TURN_SELECTOR = '[data-testid="user-message"]';
  const ASSISTANT_CONTENT_SELECTOR = ".font-claude-message";

  function getConversationTitle() {
    const titleEl = document.querySelector("title");
    let title = titleEl ? titleEl.textContent.trim() : "";
    title = title.replace(/\s*[|\u2013-]\s*Claude\s*$/i, "").trim();
    return title || "Claude Conversation";
  }

  /**
   * Builds the ordered list of {role, el} turns by walking the DOM in
   * document order and classifying each recognized turn container, rather
   * than querying user/assistant separately and trying to interleave
   * them - this keeps conversation order correct even when the two turn
   * types use different DOM shapes.
   */
  function collectTurnsInOrder() {
    const candidates = document.querySelectorAll(
      `${USER_TURN_SELECTOR}, ${ASSISTANT_CONTENT_SELECTOR}`
    );
    const turns = [];
    candidates.forEach((el) => {
      if (el.matches(USER_TURN_SELECTOR)) {
        turns.push({ role: "user", el });
      } else if (el.matches(ASSISTANT_CONTENT_SELECTOR)) {
        turns.push({ role: "assistant", el });
      }
    });
    return turns;
  }

  async function isReady() {
    const el = await ExporterUtils.waitForSelector(
      `${USER_TURN_SELECTOR}, ${ASSISTANT_CONTENT_SELECTOR}`,
      8000
    );
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
      site: "claude",
      title: getConversationTitle(),
      url: location.href,
      extractedAt: new Date().toISOString(),
      messages,
    };
  }

  ExporterExtractors.register({
    id: "claude",
    matches() {
      return /(^|\.)claude\.ai$/.test(location.hostname);
    },
    isReady,
    extract,
  });
})();

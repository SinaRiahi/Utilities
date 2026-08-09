/**
 * content/grok.js
 *
 * Extractor for grok.com and x.com/i/grok.
 *
 * Stability notes - READ BEFORE RELYING ON THIS ONE:
 *  - Grok's standalone web UI is newer and changes shape frequently, and
 *    (unlike ChatGPT's `data-message-author-role` or Gemini's
 *    `<user-query>`/`<message-content>` custom elements) it does not have
 *    a well-established semantic attribute this extractor could confidently
 *    anchor on from static knowledge alone.
 *  - This extractor uses `[class*="message-bubble"]` as a best-effort
 *    structural signal and classifies user vs assistant by DOM position
 *    (alternating turns, starting with user) as a fallback when no
 *    clearer role signal is present. That fallback is fragile - if Grok
 *    ever renders consecutive same-role turns (e.g. two assistant replies
 *    in a row after a regenerate), the alternating-role assumption will
 *    mislabel one of them.
 *  - Treat this extractor as the first candidate for a rewrite once
 *    Grok's DOM can be inspected directly; the approach here is
 *    deliberately conservative (fails closed to zero messages) rather
 *    than guessing at attributes that may not exist.
 */

(function registerGrokExtractor() {
  const TURN_SELECTOR = "[class*='message-bubble'], [class*='message-row']";

  function getConversationTitle() {
    const titleEl = document.querySelector("title");
    let title = titleEl ? titleEl.textContent.trim() : "";
    title = title.replace(/\s*[|\u2013-]\s*Grok\s*$/i, "").trim();
    return title || "Grok Conversation";
  }

  /**
   * Alternating-role fallback: assumes turns strictly alternate
   * user/assistant starting with user. This is the weakest extraction
   * strategy of the five sites and is called out prominently in the
   * module docstring above.
   */
  function collectTurnsInOrder() {
    const nodes = Array.from(document.querySelectorAll(TURN_SELECTOR)).filter(
      (el) => el.textContent.trim().length > 0
    );
    return nodes.map((el, idx) => ({ role: idx % 2 === 0 ? "user" : "assistant", el }));
  }

  async function isReady() {
    const el = await ExporterUtils.waitForSelector(TURN_SELECTOR, 8000);
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
      site: "grok",
      title: getConversationTitle(),
      url: location.href,
      extractedAt: new Date().toISOString(),
      messages,
    };
  }

  ExporterExtractors.register({
    id: "grok",
    matches() {
      return (
        /(^|\.)grok\.com$/.test(location.hostname) ||
        (/(^|\.)x\.com$/.test(location.hostname) && location.pathname.startsWith("/i/grok"))
      );
    },
    isReady,
    extract,
  });
})();

/**
 * content/extractor-base.js
 *
 * Every site extractor (chatgpt.js, claude.js, deepseek.js, gemini.js,
 * grok.js) implements this same shape and registers itself with
 * `ExporterExtractors.register(...)`. The extractor-manager picks the
 * right one based on `matches()` and the renderer never needs to know
 * which site produced the data — see shared/utils.js for the
 * ExtractedConversation shape this must return.
 *
 * Contract:
 *   id: string                          - unique extractor id, e.g. "chatgpt"
 *   matches(): boolean                  - true if this extractor applies to
 *                                          the current page (location.hostname)
 *   isReady(): Promise<boolean>         - resolves once the conversation DOM
 *                                          has loaded enough to extract
 *   extract(): Promise<ExtractedConversation>
 *
 * Extractors should never throw for "just no messages found" - return an
 * ExtractedConversation with an empty messages array instead, and let the
 * popup show a friendly "no conversation found" state. Reserve thrown
 * errors for truly unexpected failures (and even then, catch them in the
 * manager so the popup gets a clean error message instead of a crash).
 */

const ExporterExtractors = {
  _registry: [],
  register(extractor) {
    this._registry.push(extractor);
  },
  /** Returns the first extractor whose matches() is true for this page. */
  findActive() {
    return this._registry.find((e) => {
      try {
        return e.matches();
      } catch {
        return false;
      }
    });
  },
};

// Loaded as a plain global script by every content_scripts entry in
// manifest.json (see extractor-manager.js), so the only real export path
// is attaching to `self` — no module system involved. See the equivalent
// note in shared/utils.js.
self.ExporterExtractors = ExporterExtractors;

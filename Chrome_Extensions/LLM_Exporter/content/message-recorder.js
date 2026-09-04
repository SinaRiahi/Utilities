/**
 * content/message-recorder.js
 *
 * Real-time In-Memory & Storage Message Recorder.
 *
 * Automatically records and preserves completed AI conversation turns in
 * memory and chrome.storage.local as they happen.
 *
 * This solves the virtualization unloading problem (e.g., in ChatGPT and long chats)
 * where scrolling up or down unloads DOM sections, causing missing responses,
 * duplicates, or broken traversals.
 *
 * With the recorder, every finished AI response is immediately captured in memory,
 * pre-selected in the popup, and ready to be copied with a single click.
 */

(function initMessageRecorder() {
  const DEBOUNCE_MS = 1500;
  let debounceTimer = null;
  let observer = null;
  let inMemoryLedger = [];
  let storageKey = "";

  function computeStorageKey() {
    try {
      const host = location.hostname.replace(/^www\./, "").toLowerCase();
      // Keep path clean (e.g. /c/uuid or /chat/uuid or /a/chat/s/uuid)
      const path = location.pathname.replace(/\/$/, "");
      return `llm_rec_${host}_${encodeURIComponent(path || "root")}`;
    } catch {
      return `llm_rec_${encodeURIComponent(location.href.slice(0, 80))}`;
    }
  }

  function messageKey(m) {
    if (!m || !m.markdown) return "";
    return `${m.role || "unknown"}::${m.markdown.trim()}`;
  }

  /**
   * Intelligently merges incoming messages into the existing ledger.
   * Preserves chronological order, prevents duplicates, and updates in-place
   * if an assistant response was partially recorded while streaming.
   */
  function mergeIntoLedger(existing, incoming) {
    const result = [...existing];
    const seenKeys = new Set(result.map(messageKey));

    for (const msg of incoming || []) {
      if (!msg?.markdown?.trim()) continue;
      const key = messageKey(msg);

      if (seenKeys.has(key)) continue;

      // Check if this incoming message is a completed or extended version of the
      // latest message in the ledger (e.g. previously captured while streaming)
      const lastIdx = result.length - 1;
      if (lastIdx >= 0 && result[lastIdx].role === msg.role) {
        const prevText = result[lastIdx].markdown.trim();
        const nextText = msg.markdown.trim();

        // If the new text begins with the previous text or is a superset
        if (nextText.length > prevText.length && (nextText.startsWith(prevText) || nextText.includes(prevText.slice(-100)))) {
          seenKeys.delete(messageKey(result[lastIdx]));
          result[lastIdx] = {
            role: msg.role,
            markdown: nextText,
            timestamp: Date.now(),
          };
          seenKeys.add(key);
          continue;
        }
      }

      result.push({
        role: msg.role,
        markdown: msg.markdown.trim(),
        timestamp: Date.now(),
      });
      seenKeys.add(key);
    }

    return result;
  }

  async function loadFromStorage() {
    storageKey = computeStorageKey();
    return new Promise((resolve) => {
      try {
        if (!chrome?.storage?.local) return resolve([]);
        chrome.storage.local.get([storageKey], (res) => {
          if (chrome.runtime.lastError) {
            return resolve([]);
          }
          const saved = res?.[storageKey];
          if (saved && Array.isArray(saved.messages)) {
            inMemoryLedger = saved.messages;
            resolve(inMemoryLedger);
          } else {
            resolve([]);
          }
        });
      } catch {
        resolve([]);
      }
    });
  }

  async function saveToStorage() {
    storageKey = computeStorageKey();
    return new Promise((resolve) => {
      try {
        if (!chrome?.storage?.local) return resolve(false);
        const payload = {
          url: location.href,
          title: document.title,
          updatedAt: Date.now(),
          messages: inMemoryLedger,
        };
        chrome.storage.local.set({ [storageKey]: payload }, () => {
          resolve(!chrome.runtime.lastError);
        });
      } catch {
        resolve(false);
      }
    });
  }

  async function recordNow() {
    try {
      const extractor = window.ExporterExtractors?.findActive?.();
      if (!extractor?.extract) return inMemoryLedger;

      // Check if page is currently generating. If generating, we can still capture,
      // but completed messages will be finalized once settled.
      const snapshot = await extractor.extract();
      const domMessages = snapshot?.messages || [];

      if (!domMessages.length) return inMemoryLedger;

      const previousCount = inMemoryLedger.length;
      inMemoryLedger = mergeIntoLedger(inMemoryLedger, domMessages);

      if (inMemoryLedger.length !== previousCount || domMessages.length > 0) {
        await saveToStorage();
      }

      return inMemoryLedger;
    } catch (err) {
      console.warn("[LLM Recorder] Error recording messages:", err);
      return inMemoryLedger;
    }
  }

  function scheduleRecord(delay = DEBOUNCE_MS) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      recordNow();
    }, delay);
  }

  function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(() => {
      scheduleRecord(DEBOUNCE_MS);
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      characterData: false,
    });
  }

  // Load existing storage and perform initial scan
  loadFromStorage().then(() => {
    scheduleRecord(800);
    startObserver();
  });

  // Re-check storage key if SPA navigation occurs (e.g. chat URL changes)
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      loadFromStorage().then(() => {
        scheduleRecord(600);
      });
    }
  }, 2000);

  // Runtime message handler
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "EXPORTER_GET_RECORDED_REQUEST") {
      recordNow().then((msgs) => {
        sendResponse({
          ok: true,
          messages: msgs,
          count: msgs.length,
          aiCount: msgs.filter((m) => m.role === "assistant").length,
          key: storageKey,
        });
      });
      return true;
    }

    if (message?.type === "EXPORTER_CLEAR_RECORDED_REQUEST") {
      inMemoryLedger = [];
      storageKey = computeStorageKey();
      try {
        chrome.storage.local.remove([storageKey], () => {
          sendResponse({ ok: true });
        });
      } catch {
        sendResponse({ ok: true });
      }
      return true;
    }

    return false;
  });

  // Expose global interface for auto-continue and extractor-manager
  window.__universalLLMRecorder = {
    recordNow,
    getLedger: () => inMemoryLedger,
    mergeIntoLedger,
    clear: () => {
      inMemoryLedger = [];
      storageKey = computeStorageKey();
      try {
        chrome.storage.local.remove([storageKey]);
      } catch {}
    },
  };
})();

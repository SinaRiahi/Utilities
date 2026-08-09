/**
 * shared/utils.js
 *
 * Small, dependency-free helpers shared across content scripts, the popup,
 * and the background service worker. Kept framework-free so it can be
 * imported (or inlined) anywhere without a build step.
 */

/**
 * @typedef {Object} ConversationMessage
 * @property {"user"|"assistant"} role
 * @property {string} markdown  - message body, already converted to Markdown
 * @property {string} [name]    - optional display name (e.g. custom GPT name)
 */

/**
 * @typedef {Object} ExtractedConversation
 * @property {string} site        - id of the source site, e.g. "chatgpt"
 * @property {string} title       - conversation title, best-effort
 * @property {string} url         - source URL
 * @property {string} extractedAt - ISO timestamp
 * @property {ConversationMessage[]} messages
 */

/**
 * Turns a rendered DOM subtree back into reasonably-faithful Markdown.
 * This is intentionally conservative: LLM chat UIs already render Markdown
 * to HTML, so extractors mostly need to reverse that transform, not do
 * general-purpose HTML->MD conversion. Handles the common block/inline
 * elements produced by ChatGPT/Claude/Gemini/Grok/DeepSeek renderers.
 *
 * @param {HTMLElement} root
 * @returns {string}
 */
function domToMarkdown(root) {
  if (!root) return "";

  const lines = [];

  function textOf(node) {
    return (node.textContent || "").replace(/\u00a0/g, " ");
  }

  function inline(node) {
    let out = "";
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent;
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const tag = child.tagName.toLowerCase();
      switch (tag) {
        case "strong":
        case "b":
          out += `**${inline(child)}**`;
          break;
        case "em":
        case "i":
          out += `*${inline(child)}*`;
          break;
        case "code":
          out += `\`${textOf(child)}\``;
          break;
        case "a": {
          const href = child.getAttribute("href") || "";
          out += `[${inline(child)}](${href})`;
          break;
        }
        case "br":
          out += "\n";
          break;
        case "del":
        case "s":
          out += `~~${inline(child)}~~`;
          break;
        default:
          out += inline(child);
      }
    });
    return out;
  }

  function block(node, listDepth = 0) {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent.trim();
        if (t) lines.push(t);
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const tag = child.tagName.toLowerCase();

      switch (tag) {
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6": {
          const level = parseInt(tag[1], 10);
          lines.push(`${"#".repeat(level)} ${inline(child).trim()}`);
          lines.push("");
          break;
        }
        case "p":
          lines.push(inline(child).trim());
          lines.push("");
          break;
        case "pre": {
          const codeEl = child.querySelector("code");
          const langMatch = codeEl?.className.match(/language-(\S+)/);
          const lang = langMatch ? langMatch[1] : "";
          const code = textOf(codeEl || child).replace(/\n$/, "");
          lines.push("```" + lang);
          lines.push(code);
          lines.push("```");
          lines.push("");
          break;
        }
        case "ul":
        case "ol": {
          let i = 1;
          child.querySelectorAll(":scope > li").forEach((li) => {
            const marker = tag === "ol" ? `${i++}.` : "-";
            const prefix = "  ".repeat(listDepth) + marker + " ";
            const nested = li.querySelector(":scope > ul, :scope > ol");
            const liClone = li.cloneNode(true);
            if (nested) liClone.removeChild(liClone.querySelector(":scope > ul, :scope > ol"));
            lines.push(prefix + inline(liClone).trim());
            if (nested) block(nested, listDepth + 1);
          });
          lines.push("");
          break;
        }
        case "blockquote": {
          const inner = [];
          child.querySelectorAll("p").forEach((p) => inner.push(inline(p).trim()));
          inner
            .join("\n")
            .split("\n")
            .forEach((l) => lines.push("> " + l));
          lines.push("");
          break;
        }
        case "table": {
          const rows = Array.from(child.querySelectorAll("tr"));
          rows.forEach((row, idx) => {
            const cells = Array.from(row.querySelectorAll("th,td")).map((c) => inline(c).trim());
            lines.push("| " + cells.join(" | ") + " |");
            if (idx === 0) {
              lines.push("| " + cells.map(() => "---").join(" | ") + " |");
            }
          });
          lines.push("");
          break;
        }
        case "hr":
          lines.push("---");
          lines.push("");
          break;
        case "img": {
          const alt = child.getAttribute("alt") || "";
          const src = child.getAttribute("src") || "";
          lines.push(`![${alt}](${src})`);
          break;
        }
        default:
          block(child, listDepth);
      }
    });
  }

  block(root);

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Waits for a selector to appear in the DOM, useful for SPA sites that
 * render conversation content asynchronously.
 * @param {string} selector
 * @param {number} timeoutMs
 * @returns {Promise<Element|null>}
 */
function waitForSelector(selector, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(selector));
    }, timeoutMs);
  });
}

/**
 * Best-effort slugify for filenames.
 * @param {string} str
 */
function slugify(str, maxLen = 60) {
  return (str || "conversation")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, maxLen)
    .replace(/-+$/, "") || "conversation";
}

// Content scripts load this as a plain global script (no module system),
// so the only real export path is attaching to `self`. Node-based tests
// (see test/run-render-test.mjs) don't `require()` this file directly for
// that reason — they eval it against a mock `self`, which is a closer
// simulation of the actual Chrome content-script environment than CJS
// interop would be.
self.ExporterUtils = { domToMarkdown, waitForSelector, slugify };

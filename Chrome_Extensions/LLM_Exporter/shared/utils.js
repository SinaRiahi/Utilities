/**
 * shared/utils.js
 *
 * Helpers shared by the content scripts.
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
        case "b": out += `**${inline(child)}**`; break;
        case "em":
        case "i": out += `*${inline(child)}*`; break;
        case "code": out += `\`${textOf(child)}\``; break;
        case "a": {
          const href = child.getAttribute("href") || "";
          out += `[${inline(child)}](${href})`;
          break;
        }
        case "br": out += "\n"; break;
        case "del":
        case "s": out += `~~${inline(child)}~~`; break;
        default: out += inline(child);
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
        case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
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
          inner.join("\n").split("\n").forEach((l) => lines.push("> " + l));
          lines.push("");
          break;
        }
        case "table": {
          const rows = Array.from(child.querySelectorAll("tr"));
          rows.forEach((row, idx) => {
            const cells = Array.from(row.querySelectorAll("th,td")).map((c) => inline(c).trim());
            lines.push("| " + cells.join(" | ") + " |");
            if (idx === 0) lines.push("| " + cells.map(() => "---").join(" | ") + " |");
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
        default: block(child, listDepth);
      }
    });
  }

  block(root);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getScrollableContainers() {
  const candidates = [document.scrollingElement, ...document.querySelectorAll("*")];
  const seen = new Set();
  const result = [];

  for (const el of candidates) {
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const isDocument = el === document.scrollingElement;
    const scrollHeight = isDocument ? el.scrollHeight : el.scrollHeight;
    const clientHeight = isDocument ? window.innerHeight : el.clientHeight;
    if (scrollHeight - clientHeight < 350) continue;

    const style = isDocument ? null : getComputedStyle(el);
    const overflowY = style?.overflowY || "auto";
    if (!isDocument && !["auto", "scroll", "overlay"].includes(overflowY)) continue;

    result.push({ el, distance: scrollHeight - clientHeight });
  }

  return result.sort((a, b) => b.distance - a.distance).map(({ el }) => el);
}

/**
 * Walks a likely chat scroll container in both directions. This is designed
 * for SPA chat UIs where older turns are lazy-loaded only after scrolling.
 * It returns the original scroll positions so the user's page can be restored.
 */
async function traverseConversation(loadStep, options = {}) {
  const maxMs = options.maxMs ?? 12000;
  const maxSteps = options.maxSteps ?? 80;
  const pauseMs = options.pauseMs ?? 180;
  const containers = getScrollableContainers();
  if (!containers.length) return { traversed: false, reason: "no-scroll-container" };

  const container = containers[0];
  const isDocument = container === document.scrollingElement;
  const getTop = () => isDocument ? window.scrollY : container.scrollTop;
  const setTop = (value) => {
    if (isDocument) window.scrollTo(0, value);
    else container.scrollTop = value;
  };
  const viewport = () => isDocument ? window.innerHeight : container.clientHeight;

  const original = getTop();
  const started = Date.now();
  let steps = 0;

  // Start at the oldest visible region so upward lazy-loading has a chance to
  // reveal the beginning of a long conversation.
  setTop(0);
  await sleep(pauseMs);
  await loadStep();

  let stable = 0;
  while (steps++ < maxSteps && Date.now() - started < maxMs) {
    const beforeHeight = container.scrollHeight;
    const beforeTop = getTop();
    const next = Math.min(
      Math.max(0, container.scrollHeight - viewport()),
      beforeTop + Math.max(200, viewport() * 0.85)
    );
    if (next <= beforeTop + 2) {
      stable++;
    } else {
      setTop(next);
      await sleep(pauseMs);
      await loadStep();
    }

    const afterHeight = container.scrollHeight;
    if (next >= afterHeight - viewport() - 2 && afterHeight === beforeHeight) stable++;
    if (stable >= 3) break;
  }

  // Return to where the user was. The extraction has already accumulated any
  // messages discovered during traversal.
  setTop(original);
  return { traversed: true, steps };
}

function slugify(str, maxLen = 60) {
  return (str || "conversation")
    .trim().toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, maxLen)
    .replace(/-+$/, "") || "conversation";
}

self.ExporterUtils = {
  domToMarkdown,
  waitForSelector,
  sleep,
  getScrollableContainers,
  traverseConversation,
  slugify,
};

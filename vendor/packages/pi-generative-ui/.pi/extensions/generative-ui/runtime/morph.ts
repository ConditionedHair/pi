import morphdom from "morphdom";

/**
 * Apply an HTML fragment to a root element by morphing — preserves DOM
 * identity across updates (no script re-execution, no focus/scroll loss).
 *
 * Scripts inside the fragment are inert until `runScripts()` is called,
 * which clones each <script> in #root into a fresh element so the browser
 * actually executes it. Call once on the final chunk only.
 */

const FADE_IN = "_glimpseUiFadeIn 0.3s ease both";

export function applyHTML(root: HTMLElement, html: string): void {
  const next = document.createElement(root.tagName.toLowerCase());
  next.id = root.id;
  // Copy attributes from root so morphdom doesn't try to remove them
  for (const attr of Array.from(root.attributes)) {
    if (attr.name !== "id") next.setAttribute(attr.name, attr.value);
  }
  next.innerHTML = html;

  morphdom(root, next, {
    onBeforeElUpdated(from, to) {
      if (from.isEqualNode(to)) return false;
      return true;
    },
    onNodeAdded(node) {
      if (node.nodeType === 1) {
        const el = node as HTMLElement;
        if (el.tagName !== "STYLE" && el.tagName !== "SCRIPT") {
          el.style.animation = FADE_IN;
        }
      }
      return node;
    },
  });
}

/**
 * Execute every <script> in #root, in document order.
 *
 * Sequential awaiting matters: dynamically-inserted external scripts load
 * asynchronously, so the naive "replace them all in a loop" approach runs
 * inline scripts before their CDN deps finish loading (Chart.js / D3 /
 * mermaid not yet defined → ReferenceError → blank widget).
 *
 * For each script we clone into a fresh element so the browser actually
 * executes it (innerHTML alone doesn't run scripts). External scripts: we
 * await `load`. Inline: synchronous on append.
 */
export async function runScripts(root: HTMLElement): Promise<void> {
  const scripts = Array.from(root.querySelectorAll("script"));
  for (const old of scripts) {
    const s = document.createElement("script");
    for (const attr of Array.from(old.attributes)) {
      s.setAttribute(attr.name, attr.value);
    }
    if (old.src) {
      const loaded = new Promise<void>((resolve, reject) => {
        s.addEventListener("load",  () => resolve(), { once: true });
        s.addEventListener("error", () => reject(new Error(`Failed to load ${old.src}`)), { once: true });
      });
      old.parentNode?.replaceChild(s, old);
      await loaded;
    } else {
      s.textContent = old.textContent ?? "";
      old.parentNode?.replaceChild(s, old);
    }
  }
}

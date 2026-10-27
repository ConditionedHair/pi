import { install as installBridge, on } from "./bridge.js";
import { applyHTML, runScripts } from "./morph.js";
import { install as installSvgSaver } from "./features/svg-saver.js";

/**
 * Runtime entry — runs once inside the webview at document load.
 *
 *   - Install the host→page deliver hook (so eval'd messages route here).
 *   - Subscribe to `content` messages and morph #root accordingly.
 *   - On the final chunk, execute <script> tags.
 *   - Mount feature modules. Each feature subscribes to whatever bridge
 *     events it cares about — the entry knows nothing about them.
 */

function boot(): void {
  installBridge();

  const root = document.getElementById("root");
  if (!root) {
    console.error("[glimpse-ui] #root missing; aborting boot");
    return;
  }

  // The bundle is inlined at end of <body>, so by the time we run, the
  // parser has built #root and we can morph immediately. Guard anyway.
  let queued: { html: string; final: boolean } | null = null;
  let domReady = document.readyState !== "loading";

  function flushQueued(): void {
    if (!queued) return;
    const { html, final } = queued;
    queued = null;
    applyHTML(root!, html);
    if (final) {
      runScripts(root!).catch((err) => console.error("[glimpse-ui] runScripts failed:", err));
    }
  }

  on("content", (msg) => {
    queued = { html: msg.html, final: msg.final };
    if (domReady) flushQueued();
  });

  if (!domReady) {
    document.addEventListener("DOMContentLoaded", () => {
      domReady = true;
      flushQueued();
    }, { once: true });
  }

  installSvgSaver();
}

boot();

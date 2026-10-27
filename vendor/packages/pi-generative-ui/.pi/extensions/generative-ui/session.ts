import { attach as attachRpc, type RpcHost } from "./rpc.js";
import { attach as attachSvgSaver } from "./features/svg-saver.js";
import { RUNTIME_HTML } from "./runtime.bundle.js";
import type { GlimpseWindowLike, OpenOptions, Opener } from "./glimpse-window.js";

/**
 * Owns one Glimpse window for the lifetime of a show_widget call.
 *
 *   - `onChunk(html)` is called repeatedly while the model streams.
 *   - `onComplete(html)` is called when the tool call finishes — final
 *     content is pushed with `final: true` and scripts execute.
 *   - `close()` closes the window.
 *
 * The session does not wait for or surface user interactions. Once
 * `onComplete` resolves, the agent's tool call is free to return; the
 * window stays open and the user closes it whenever they like.
 *
 * The page receives `{type: "content", html, final}` messages; nothing
 * else. RPC features (svg.copy, svg.save, …) are attached once on open()
 * and live until the window closes.
 */

const FLUSH_DEBOUNCE_MS = 150;
// Skip noise chunks before the model has emitted enough HTML for the page
// to display anything meaningful (a stray `<d` or `<svg`). 20 bytes is just
// past the threshold of "tag with at least one attribute and a closing >".
const MIN_CHUNK_BYTES = 20;

export type { OpenOptions, Opener } from "./glimpse-window.js";

export class WidgetSession {
  readonly win: GlimpseWindowLike;
  private readonly rpc: RpcHost;
  private readonly readyPromise: Promise<void>;
  private latestHTML = "";
  private hasContent = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private finalized = false;
  private closed = false;

  constructor(open: Opener, opts: OpenOptions) {
    this.win = open(RUNTIME_HTML, opts);
    this.win.on("closed", () => { this.closed = true; });
    this.win.on("error",  (err) => {
      this.closed = true;
      console.error("[glimpse-ui] window error:", err);
    });

    this.readyPromise = new Promise<void>((resolve) => {
      this.win.on("ready", () => resolve());
    });

    this.rpc = attachRpc(this.win);
    attachSvgSaver(this.rpc);
  }

  /** Streaming chunk. Coalesces rapid updates within FLUSH_DEBOUNCE_MS. */
  onChunk(html: string): void {
    if (this.finalized || this.closed) return;
    if (!html || html.length < MIN_CHUNK_BYTES) return;
    if (html === this.latestHTML) return;
    this.latestHTML = html;
    this.hasContent = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush(false);
    }, FLUSH_DEBOUNCE_MS);
  }

  /** Final content. Cancels any pending debounce and pushes with final=true. */
  async onComplete(html: string): Promise<void> {
    if (this.finalized || this.closed) return;
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    if (html) {
      this.latestHTML = html;
      this.hasContent = true;
    }
    this.finalized = true;
    await this.flush(true);
  }

  private async flush(final: boolean): Promise<void> {
    if (!this.hasContent) return;
    await this.readyPromise;
    if (this.closed) return;
    try {
      this.rpc.push({ type: "content", html: this.latestHTML, final });
    } catch (err) {
      console.error("[glimpse-ui] push failed:", err);
    }
  }

  /** Register a callback for when the window is closed by the user. */
  onClosed(fn: () => void): void {
    this.win.on("closed", fn);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    try { this.win.close(); } catch {}
  }
}

import type { HostToPage } from "./protocol.js";
import { isPageToHost } from "./protocol.js";
import type { GlimpseWindowLike } from "./glimpse-window.js";

/**
 * Host-side RPC handler registry attached to a Glimpse window.
 *
 * One `attach(win)` per window installs a single `message` listener that
 * routes `rpc-call` envelopes to handlers. Idempotent: a second call
 * returns the same `RpcHost`. Anything that isn't a protocol message
 * (e.g. raw `window.glimpse.send(...)` payloads from widget code) is
 * dropped — we deliberately don't surface widget interactions to the agent.
 */

export type RpcHandler = (params: unknown) => Promise<unknown> | unknown;

export interface RpcHost {
  handle(method: string, fn: RpcHandler): void;
  push(msg: HostToPage): void;
}

const installed = new WeakMap<GlimpseWindowLike, RpcHost>();

/**
 * Encode a value for safe embedding in `webView.evaluateJavaScript(...)`.
 *
 * The host calls `win.send("window.__glimpseUI.deliver(<this>)")` — the
 * argument is evaluated as JavaScript, not parsed as HTML, so we only need
 * JSON-safety plus one defense: `</script>` would break callers that ever
 * splice this into an HTML script context. JSON.stringify already escapes
 * everything else; we just neutralize the closing tag with a unicode escape
 * so the resulting JS string still decodes to the same value.
 */
function jsLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/<\/script/gi, "\\u003C/script");
}

export function attach(win: GlimpseWindowLike): RpcHost {
  const existing = installed.get(win);
  if (existing) return existing;

  const handlers = new Map<string, RpcHandler>();

  function push(msg: HostToPage): void {
    win.send(`window.__glimpseUI&&window.__glimpseUI.deliver(${jsLiteral(msg)})`);
  }

  function handle(method: string, fn: RpcHandler): void {
    handlers.set(method, fn);
  }

  win.on("message", async (raw) => {
    // Only RPC traffic is routed; everything else (including widget
    // glimpse.send payloads) is dropped on the floor by design.
    if (!isPageToHost(raw)) return;

    const handler = handlers.get(raw.method);
    if (!handler) {
      push({ type: "rpc-result", id: raw.id, ok: false, error: `Unknown RPC method: ${raw.method}` });
      return;
    }
    try {
      const value = await handler(raw.params);
      push({ type: "rpc-result", id: raw.id, ok: true, value });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      push({ type: "rpc-result", id: raw.id, ok: false, error: message });
    }
  });

  const host: RpcHost = { handle, push };
  installed.set(win, host);
  return host;
}

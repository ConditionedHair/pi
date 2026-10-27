/**
 * Wire protocol between the host (Node) and the runtime (page).
 *
 * Host → page: emitted via `win.send("__glimpseUI.deliver(<json>)")` (eval).
 * Page → host: emitted via `glimpse.send(<json>)` (native bridge, structured).
 *
 * Both sides agree on a single discriminated union per direction. Anything
 * else is malformed and dropped.
 *
 * Note: this extension does not surface widget interactions back to the
 * agent. Widget code can call `window.glimpse.send(...)`; those payloads
 * still reach the native message channel but are ignored host-side. The
 * only host-bound traffic we care about is RPC.
 */

// ── Host → Page ─────────────────────────────────────────────────────────

export interface ContentMessage {
  type: "content";
  html: string;
  final: boolean;
}

export interface RpcOk {
  type: "rpc-result";
  id: string;
  ok: true;
  value?: unknown;
}

export interface RpcErr {
  type: "rpc-result";
  id: string;
  ok: false;
  error: string;
}

export type HostToPage = ContentMessage | RpcOk | RpcErr;

// ── Page → Host ─────────────────────────────────────────────────────────
//
// Kept as a discriminated union (even with one variant today) so adding
// a new page→host shape later is a single-line change and the type guard
// still narrows correctly.

export interface RpcCall {
  type: "rpc-call";
  id: string;
  method: string;
  params: unknown;
}

export type PageToHost = RpcCall;

// ── Type guards (cheap, used on both sides) ─────────────────────────────

export function isHostToPage(v: unknown): v is HostToPage {
  if (!v || typeof v !== "object") return false;
  const t = (v as { type?: unknown }).type;
  return t === "content" || t === "rpc-result";
}

export function isPageToHost(v: unknown): v is PageToHost {
  if (!v || typeof v !== "object") return false;
  return (v as { type?: unknown }).type === "rpc-call";
}

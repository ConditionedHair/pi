/**
 * Structural type for a Glimpse window — only what we actually consume.
 * Defined here so session.ts, rpc.ts, and tests share one shape and we
 * never need `as never` casts at call sites.
 */
export interface GlimpseWindowLike {
  send(js: string): void;
  close(): void;
  on(event: "ready",   listener: () => void): void;
  on(event: "message", listener: (data: unknown) => void): void;
  on(event: "closed",  listener: () => void): void;
  on(event: "error",   listener: (err: Error) => void): void;
}

export interface OpenOptions {
  title: string;
  width: number;
  height: number;
  floating?: boolean;
  /** Open hidden (no flash) — useful for tests. */
  hidden?: boolean;
}

export type Opener = (html: string, opts: OpenOptions) => GlimpseWindowLike;

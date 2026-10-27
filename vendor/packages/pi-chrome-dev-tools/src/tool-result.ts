import type { AgentToolResult } from "@mariozechner/pi-coding-agent";

export function textResult(text: string, details?: Record<string, unknown>): AgentToolResult<Record<string, unknown>> {
  return {
    content: [{ type: "text", text }],
    details: details ?? {},
  };
}

export function errorResult<T = Record<string, unknown>>(message: string): AgentToolResult<T> {
  return {
    content: [{ type: "text", text: message }],
    details: { error: true } as T,
  };
}

export function wrapError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes("Executable doesn't exist") || msg.includes("channel"))
      return "Chrome not found. Install Google Chrome or check that it's on your PATH.";
    if (msg.includes("Target closed") || msg.includes("Browser closed"))
      return "Browser was closed unexpectedly. It will relaunch on next tool call.";
    if (msg.includes("Timeout"))
      return `Timed out: ${msg}`;
    if (msg.includes("net::ERR_"))
      return `Navigation failed: ${msg}`;
    return msg;
  }
  return String(err);
}

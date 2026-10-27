import * as darwin from "./darwin.js";
import * as linux from "./linux.js";
import * as win32 from "./win32.js";

/**
 * Thin OS abstraction for the two things features need from the host:
 *   - copying text to the system clipboard
 *   - showing a native "Save As" dialog and returning the chosen path
 *
 * Each implementation throws a descriptive error if its required CLI is
 * missing, so the user sees something actionable in the UI.
 */

export type PlatformName = "darwin" | "linux" | "win32" | "unsupported";

export interface Platform {
  readonly name: PlatformName;
  copyText(text: string): Promise<void>;
  chooseSavePath(suggestedName: string): Promise<string | null>;
}

function unsupported(): Platform {
  const reason = `unsupported platform: ${process.platform}`;
  return {
    name: "unsupported",
    async copyText() { throw new Error(`Clipboard ${reason}`); },
    async chooseSavePath() { throw new Error(`Save dialog ${reason}`); },
  };
}

let cached: Platform | null = null;

export function getPlatform(): Platform {
  if (cached) return cached;
  switch (process.platform) {
    case "darwin": cached = darwin; break;
    case "linux":  cached = linux;  break;
    case "win32":  cached = win32;  break;
    default:       cached = unsupported();
  }
  return cached;
}

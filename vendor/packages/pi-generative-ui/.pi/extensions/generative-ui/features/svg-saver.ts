import { writeFile } from "node:fs/promises";
import type { RpcHost } from "../rpc.js";
import { getPlatform } from "../platform/index.js";

/**
 * Host side of the SVG saver. Registers two RPC methods:
 *   - svg.copy({svg})                 → copy SVG text to system clipboard
 *   - svg.save({svg, suggestedName?}) → show native Save dialog, write file
 *
 * The host is the sole authority on filenames: the client may pass a
 * human-friendly hint (the SVG's <title>, aria-label, or document.title),
 * which we sanitize and guarantee a `.svg` extension. The client does no
 * sanitization of its own.
 */

interface CopyParams { svg: string; }
interface SaveParams { svg: string; suggestedName?: string; }

function safeFilename(hint: string | undefined): string {
  const raw = (hint ?? "diagram").toLowerCase();
  const slug = raw.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const base = slug || "diagram";
  return base.endsWith(".svg") ? base : `${base}.svg`;
}

export function attach(rpc: RpcHost): void {
  const platform = getPlatform();

  rpc.handle("svg.copy", async (params) => {
    const { svg } = params as CopyParams;
    if (typeof svg !== "string") throw new Error("svg.copy: missing svg");
    await platform.copyText(svg);
    return { ok: true };
  });

  rpc.handle("svg.save", async (params) => {
    const { svg, suggestedName } = params as SaveParams;
    if (typeof svg !== "string") throw new Error("svg.save: missing svg");
    const path = await platform.chooseSavePath(safeFilename(suggestedName));
    if (!path) return { cancelled: true };
    await writeFile(path, svg, "utf8");
    return { path };
  });
}

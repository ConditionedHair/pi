import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const name = "linux" as const;

async function which(cmd: string): Promise<boolean> {
  try {
    await execFileAsync("which", [cmd]);
    return true;
  } catch { return false; }
}

async function pipeIn(cmd: string, args: string[], stdinText: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, args);
    proc.on("error", reject);
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)));
    proc.stdin.end(stdinText);
  });
}

export async function copyText(text: string): Promise<void> {
  // Prefer Wayland tool, fall back to X11.
  if (process.env.WAYLAND_DISPLAY && await which("wl-copy")) {
    return pipeIn("wl-copy", [], text);
  }
  if (await which("xclip")) return pipeIn("xclip", ["-selection", "clipboard"], text);
  if (await which("xsel"))  return pipeIn("xsel", ["--clipboard", "--input"], text);
  throw new Error("No clipboard tool available (install wl-clipboard, xclip, or xsel)");
}

export async function chooseSavePath(suggestedName: string): Promise<string | null> {
  if (await which("zenity")) {
    try {
      const { stdout } = await execFileAsync("zenity", [
        "--file-selection",
        "--save",
        "--confirm-overwrite",
        `--filename=${suggestedName}`,
      ]);
      const path = stdout.trim();
      return path || null;
    } catch (err) {
      // Zenity exits non-zero on cancel.
      if ((err as { code?: number }).code === 1) return null;
      throw err;
    }
  }
  if (await which("kdialog")) {
    try {
      const { stdout } = await execFileAsync("kdialog", ["--getsavefilename", suggestedName]);
      const path = stdout.trim();
      return path || null;
    } catch (err) {
      if ((err as { code?: number }).code === 1) return null;
      throw err;
    }
  }
  throw new Error("No save dialog available (install zenity or kdialog)");
}

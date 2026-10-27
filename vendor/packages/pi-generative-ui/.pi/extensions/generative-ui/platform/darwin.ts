import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const name = "darwin" as const;

export async function copyText(text: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("pbcopy");
    proc.on("error", reject);
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`pbcopy exited with ${code}`)));
    proc.stdin.end(text);
  });
}

export async function chooseSavePath(suggestedName: string): Promise<string | null> {
  const script = [
    `set defaultName to ${JSON.stringify(suggestedName)}`,
    "try",
    '  set chosenFile to choose file name with prompt "Save as:" default name defaultName',
    "  return POSIX path of chosenFile",
    "on error number -128",
    '  return ""',
    "end try",
  ].join("\n");
  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  const path = stdout.trim();
  return path ? path : null;
}

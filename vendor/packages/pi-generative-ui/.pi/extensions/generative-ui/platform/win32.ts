import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const name = "win32" as const;

/**
 * PowerShell handles both clipboard (Set-Clipboard) and the native Save
 * As dialog (System.Windows.Forms.SaveFileDialog). We invoke pwsh/powershell
 * with `-EncodedCommand` (UTF-16 LE + base64) to sidestep quoting entirely.
 */

function encodeCommand(ps: string): string {
  return Buffer.from(ps, "utf16le").toString("base64");
}

function psExecutable(): string {
  return process.env.GLIMPSE_PS_PATH || "powershell.exe";
}

async function runPS(ps: string, stdinText?: string): Promise<string> {
  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-EncodedCommand", encodeCommand(ps),
  ];
  if (stdinText === undefined) {
    const { stdout } = await execFileAsync(psExecutable(), args);
    return stdout;
  }
  return new Promise<string>((resolve, reject) => {
    const proc = execFile(psExecutable(), args, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
    proc.stdin?.end(stdinText);
  });
}

export async function copyText(text: string): Promise<void> {
  await runPS("[Console]::In.ReadToEnd() | Set-Clipboard", text);
}

export async function chooseSavePath(suggestedName: string): Promise<string | null> {
  const ps = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dlg = New-Object System.Windows.Forms.SaveFileDialog",
    `$dlg.FileName = ${JSON.stringify(suggestedName)}`,
    "$dlg.OverwritePrompt = $true",
    "if ($dlg.ShowDialog() -eq 'OK') { Write-Output $dlg.FileName }",
  ].join("; ");
  const stdout = await runPS(ps);
  const path = stdout.trim();
  return path || null;
}

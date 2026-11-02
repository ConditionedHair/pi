# Pi configuration

Personal Pi coding agent configuration, package declarations, lockfile, and custom skills.

## Contents

- `settings.json`: package declarations and extension preferences.
- `mcp.json`: Context7 and Google Services MCP servers; Context7 credentials come from `CONTEXT7_API_KEY`.
- `mcp.composio.example.json`: optional manual Composio configuration template; not needed for the `/mcp-auth composio` sign-in flow and not loaded automatically.
- `npm/package.json` and `npm/package-lock.json`: installed extension and skill packages, with resolved versions.
- `skills/`: local code review, codebase design, bug diagnosis, and test-driven development skills.
- `vendor/packages/`: committed source snapshots of all 14 configured skill and extension packages, including their skill files, extension entry points, supporting code, documentation, and packaged license files. Scoped packages retain their scope directory (for example, `vendor/packages/@feniix/pi-sequential-thinking/`).
- MCP onboarding/version state and `pi-web-access/` version state.

Other files are tracked by default unless excluded by `.gitignore`. Review changes for secrets before publishing, especially MCP headers and URLs.

## Install on macOS, Linux, or Windows

Requires Git and Node.js **22.19 or newer** (including npm). These instructions use the default Pi config directory: `~/.pi/agent` on macOS/Linux, `$HOME\.pi\agent` on Windows. If you set `PI_CODING_AGENT_DIR`, use that directory instead.

Close Pi before restoring configuration. The commands below move any existing config into a timestamped backup, including credentials and sessions; keep that backup private. They then clone this repository into the active config directory. Do not run them again merely to update an existing checkout.

### macOS

Install Git and Node.js 22.19+ first. With [Homebrew](https://brew.sh/):

```sh
brew install git node
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
node --version
pi --version

mkdir -p "$HOME/.pi"
if [ -e "$HOME/.pi/agent" ]; then
  mv "$HOME/.pi/agent" "$HOME/.pi/agent.backup-$(date +%Y%m%d-%H%M%S)"
fi
git clone https://github.com/ConditionedHair/pi.git "$HOME/.pi/agent"
cd "$HOME/.pi/agent/npm"
npm ci --ignore-scripts
```

### Linux

Install Git using your distribution's package manager (for example, `sudo apt-get install git` on Debian/Ubuntu). Install Node.js 22.19+ with npm using your preferred Node version manager or the [Node.js downloads](https://nodejs.org/en/download). Distribution repositories may contain older Node versions; check before proceeding.

```sh
node --version
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
pi --version

mkdir -p "$HOME/.pi"
if [ -e "$HOME/.pi/agent" ]; then
  mv "$HOME/.pi/agent" "$HOME/.pi/agent.backup-$(date +%Y%m%d-%H%M%S)"
fi
git clone https://github.com/ConditionedHair/pi.git "$HOME/.pi/agent"
cd "$HOME/.pi/agent/npm"
npm ci --ignore-scripts
```

Use a user-owned Node installation rather than running npm with `sudo`.

### Windows (native PowerShell)

Install [Git for Windows](https://git-scm.com/download/win) (including Git Bash) and [Node.js](https://nodejs.org/en/download) 22.19+ with npm. Alternatively, install them with WinGet:

```powershell
winget install --id Git.Git --exact
winget install --id OpenJS.NodeJS.LTS --exact
```

Open a **new PowerShell window** so PATH changes take effect, then run:

```powershell
node --version
git --version
npm.cmd install -g --ignore-scripts @earendil-works/pi-coding-agent
pi.cmd --version

New-Item -ItemType Directory -Force "$HOME\.pi" | Out-Null
if (Test-Path "$HOME\.pi\agent") {
    Move-Item "$HOME\.pi\agent" "$HOME\.pi\agent.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}
git clone https://github.com/ConditionedHair/pi.git "$HOME\.pi\agent"
if ($LASTEXITCODE -ne 0) { throw 'Clone failed; stop before restoring packages.' }
Set-Location "$HOME\.pi\agent\npm"
npm.cmd ci --ignore-scripts
```

The `.cmd` suffix avoids PowerShell execution-policy errors from npm's `.ps1` shims; no execution-policy change is necessary. Pi uses Git Bash for its Bash tool even when launched from PowerShell. If Bash is not discovered, merge a `shellPath` such as `"C:\\Program Files\\Git\\bin\\bash.exe"` into `settings.json` (adjust for your installation).

**WSL alternative:** install Git, Node, and Pi inside your WSL distribution, then follow the Linux steps using the Linux home directory. Do not share `node_modules` or native binaries between Windows and WSL.

### Finish setup (all platforms)

1. **Restore the Git extension.** The npm lockfile covers npm packages only. From any directory, run:

   ```sh
   pi install https://github.com/fitchmultz/pi-edit-session-in-place
   ```

   Use `pi.cmd` on PowerShell. This installs the already-declared Git package without intentionally updating the locked npm packages. The Git source is not pinned to a commit, so its version can change.

2. **Configure MCP before starting Pi.** This config uses `pi-mcp-adapter` and disables Pi's built-in MCP extension. In `mcp.json`:
   - Set `CONTEXT7_API_KEY` in the environment that launches Pi, or remove the `context7` entry if unused.
   - The committed `google-services.command` is the original author's macOS path. Install your Google Services MCP executable separately and replace that path with its executable path on your machine, or remove the `google-services` entry if unused. This repository does not install that executable. Escape backslashes in Windows JSON paths.
   - Authenticate MCP services separately through `/mcp`. For Composio, see below.

   Environment examples (current shell only; replace the placeholder privately):

   ```sh
   # macOS/Linux
   export CONTEXT7_API_KEY='your-key'
   ```

   ```powershell
   # Windows PowerShell
   $env:CONTEXT7_API_KEY = 'your-key'
   ```

   For persistence, use your shell profile or Windows user environment settings. Never commit API keys or private MCP URLs.

3. **Start Pi from a project directory**, not the config directory. Run `pi` (`pi.cmd` in PowerShell), then `/login` for your model provider and `/model` to select a model. Existing credentials are not included in this repository; authenticate again or carefully restore your own credentials from your private backup.
4. **Verify:** run `pi list` in your shell and `/mcp` inside Pi. On native Windows, enter `!printf 'Bash is working\n'` inside Pi to check Git Bash. If optional extensions report missing tools, install the prerequisites below or disable those packages with `pi config`.

### Optional extension prerequisites

The core config can be restored without these tools, but the corresponding features need extra setup. Platform support varies by extension; restoring npm packages alone does not guarantee every tool works on every OS.

| Feature | Additional setup |
|---|---|
| Chrome DevTools | Install Google Chrome. |
| Playwright | From the config's `npm` directory, run `npx playwright install chromium` (`npx.cmd` in PowerShell). Linux may also need browser system dependencies; see [Playwright's instructions](https://playwright.dev/docs/browsers). |
| Graphify | Install its Python CLI separately, for example `uv tool install graphifyy`, with Python/uv available. |
| Generative UI | Native Glimpse windows need Xcode Command Line Tools on macOS; Rust plus GTK4/WebKitGTK development packages on Linux; .NET 8 SDK plus WebView2 Runtime on Windows. Linux also supports a Chromium fallback. |

`npm ci --ignore-scripts` intentionally skips dependency lifecycle scripts. For native Glimpse UI, install the prerequisites and, after reviewing the package's build scripts, run `npm rebuild glimpseui` from the config's `npm` directory (`npm.cmd` in PowerShell). See the [vendored UI package documentation](vendor/packages/pi-generative-ui/README.md) for details.

## Update an existing checkout

Close Pi, review local changes, then pull without overwriting them:

```sh
cd ~/.pi/agent
git status
git pull --ff-only
cd npm
npm ci --ignore-scripts
```

On PowerShell use `Set-Location "$HOME\.pi\agent"`, then the same Git commands, `Set-Location npm`, and `npm.cmd ci --ignore-scripts`. If Git reports conflicts or local changes, stop and reconcile them; do not reset your personal configuration to force an update.

The commands above restore the committed npm lockfile. `pi update --extensions` instead reconciles all packages from `settings.json` and **may update versions**, including the unpinned Git extension. Repeat any required native rebuild after `npm ci`, then restart Pi. Review changes for secrets before committing or pushing.

### Composio MCP

The author's Composio sign-in flow uses the installed `pi-mcp-adapter`. Inside Pi, run:

```text
/mcp-auth composio
```

Follow the authentication prompts, then inspect the connection with `/mcp`. Authentication is machine-local and is not included in this repository.

`/mcp-auth composio` authenticates a server named `composio`; it is not a package-install command. If the adapter reports an unknown server on a fresh machine, configure your Composio MCP connection first, then run the sign-in command again. The author's existing server configuration lives outside this repository in `~/.config/mcp/mcp.json`.

`mcp.composio.example.json` is only an optional manual-config template for supplying a private endpoint through `COMPOSIO_MCP_URL`. Pi does not load that example file automatically. You do not need to copy it or set that variable when using an already-configured Composio connection. Never commit private endpoints or authentication tokens.

## Exclusions

Credentials (`auth.json`, `mcp-auth.json`), model store, private session history and memory, caches, dependency `node_modules` directories, environment files, and private keys stay local.

## Source snapshots

Browse `vendor/packages/<package>/` for the actual installed skill and extension source. Snapshots preserve the published package layout, including hidden resource directories such as `pi-generative-ui/.pi/extensions/`. They are historical snapshots and may differ from the versions in the current npm lockfile; the Git extension is restored from its declared URL rather than these snapshots.

Pi still loads active installations from `npm/node_modules`; these snapshots are for version control and do not change runtime configuration. Restore dependencies with the command above. Package updates do not automatically refresh snapshots. Third-party code retains its original licensing; see each package's manifest and included license files.

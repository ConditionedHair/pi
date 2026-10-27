# Pi configuration

Personal Pi coding agent configuration, package declarations, lockfile, and custom skills.

## Contents

- `settings.json`: package declarations and extension preferences.
- `mcp.json`: MCP servers; Context7 credentials come from `CONTEXT7_API_KEY`.
- `npm/package.json` and `npm/package-lock.json`: installed extension and skill packages, with resolved versions.
- `skills/`: custom local skills (currently empty). Package-provided skills live in `npm/node_modules` after installation.
- MCP onboarding/version state and `pi-web-access/` version state.

Other files are tracked by default unless excluded by `.gitignore`. Review changes for secrets before publishing, especially MCP headers and URLs.

## Restore

Install Pi, then copy this repository's files into `~/.pi/agent/` after backing up existing configuration. Restore locked packages:

```sh
cd ~/.pi/agent/npm
npm ci --ignore-scripts
```

Restart Pi. Alternatively, `pi update --extensions` reconciles packages from settings, but may update versions.

Set `CONTEXT7_API_KEY` in your environment. Install the Google services MCP executable separately and adjust its machine-specific path in `mcp.json`. Authenticate providers and MCP services separately.

## Exclusions

Credentials (`auth.json`, `mcp-auth.json`), model store, private session history and memory, caches, installed dependencies, environment files, and private keys stay local. Installed extension/skill code is restored from the committed npm manifest and lockfile, not vendored into Git.

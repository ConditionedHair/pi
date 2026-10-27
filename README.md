# Pi configuration

Personal Pi coding agent configuration, package declarations, lockfile, and custom skills.

## Contents

- `settings.json`: package declarations and extension preferences.
- `mcp.json`: MCP servers; Context7 credentials come from `CONTEXT7_API_KEY`.
- `npm/package.json` and `npm/package-lock.json`: installed extension and skill packages, with resolved versions.
- `skills/`: custom local skills (currently empty).
- `vendor/packages/`: committed source snapshots of all 14 configured skill and extension packages, including their skill files, extension entry points, supporting code, documentation, and packaged license files. Scoped packages retain their scope directory (for example, `vendor/packages/@feniix/pi-sequential-thinking/`).
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

Credentials (`auth.json`, `mcp-auth.json`), model store, private session history and memory, caches, dependency `node_modules` directories, environment files, and private keys stay local.

## Source snapshots

Browse `vendor/packages/<package>/` for the actual installed skill and extension source. Snapshots preserve the published package layout, including hidden resource directories such as `pi-generative-ui/.pi/extensions/`.

Pi still loads active installations from `npm/node_modules`; these snapshots are for version control and do not change runtime configuration. Restore dependencies with the command above. Package updates do not automatically refresh snapshots. Third-party code retains its original licensing; see each package's manifest and included license files.

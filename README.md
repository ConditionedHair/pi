# Pi configuration

Personal Pi coding agent configuration, package declarations, lockfile, and custom skills.

## Contents

- `settings.json`: package declarations and extension preferences.
- `mcp.json`: Context7 and Google Services MCP servers; Context7 credentials come from `CONTEXT7_API_KEY`.
- `mcp.composio.example.json`: sanitized Composio MCP configuration template; the private endpoint comes from `COMPOSIO_MCP_URL`.
- `npm/package.json` and `npm/package-lock.json`: installed extension and skill packages, with resolved versions.
- `skills/`: local code review, codebase design, bug diagnosis, and test-driven development skills.
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

### Composio MCP

Composio is configured locally in `~/.config/mcp/mcp.json`, outside this repository. The installed `pi-mcp-adapter` loads that configuration; Composio is a remote service, not a separate vendored package. Its private endpoint is intentionally not committed.

To restore Composio:

1. Set `COMPOSIO_MCP_URL` to your full private Composio MCP endpoint in the environment that launches Pi. Treat the full URL as a credential.
2. Merge the `composio` entry from `mcp.composio.example.json` into `mcpServers` in `~/.config/mcp/mcp.json`, preserving any existing servers. If that file does not exist, copy the template there after creating the parent directory.
3. Restart Pi and inspect Composio with `/mcp`.

The template uses environment-variable URL interpolation supported by the installed `pi-mcp-adapter`. It is documentation only: Pi does not automatically load `mcp.composio.example.json`. Existing local Composio configuration remains unchanged.

## Exclusions

Credentials (`auth.json`, `mcp-auth.json`), model store, private session history and memory, caches, dependency `node_modules` directories, environment files, and private keys stay local.

## Source snapshots

Browse `vendor/packages/<package>/` for the actual installed skill and extension source. Snapshots preserve the published package layout, including hidden resource directories such as `pi-generative-ui/.pi/extensions/`.

Pi still loads active installations from `npm/node_modules`; these snapshots are for version control and do not change runtime configuration. Restore dependencies with the command above. Package updates do not automatically refresh snapshots. Third-party code retains its original licensing; see each package's manifest and included license files.

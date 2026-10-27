# Pi settings

Personal configuration for the Pi coding agent.

## Files

- `settings.json`: installed package declarations and extension preferences.
- `mcp.json`: MCP server configuration; secrets come from environment variables.

## Restore

Install Pi, then copy `settings.json` and `mcp.json` into `~/.pi/agent/` (back up existing files first). Run `pi update --extensions` to install configured packages, then restart Pi.

Set `CONTEXT7_API_KEY` in your environment. The Google services MCP command points to a machine-specific executable; install it separately and adjust its path on other machines. Authenticate providers and MCP services separately.

## Privacy

Git uses an explicit file allowlist. Credentials, session history, memory, installed dependencies, model stores, and caches remain local. Review configuration for secrets before each commit, especially MCP headers and URLs. New files must be explicitly allowed in `.gitignore` before tracking.

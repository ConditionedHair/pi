# graphify-pi parity matrix

Target upstream: [`safishamsi/graphify`](https://github.com/safishamsi/graphify) v0.5.x, with emphasis on Claude Code integration and the `/graphify` skill workflow.

Last reviewed: 2026-04-25.

## Summary

`graphify-pi` aims for **practical Pi parity** rather than a byte-for-byte port of Claude Code files. Pi uses a TypeScript extension and Agent Skills instead of `CLAUDE.md` plus Claude `PreToolUse` hooks.

| Area | Upstream Claude behavior | graphify-pi parity | Notes |
| --- | --- | --- | --- |
| Always-on graph reminder | `graphify claude install` writes `CLAUDE.md` and `.claude/settings.json` `PreToolUse` hook for `Glob|Grep` | Implemented via `extensions/graphify.ts` system prompt injection, tool-result reminders, and UI status | Pi can also redirect raw `read` and search-like `bash` results. |
| Preferred artifact order | `GRAPH_REPORT.md`, with wiki instruction in persistent rules | Implemented as wiki → report → graph.json | Pi intentionally improves fallback behavior when only `graph.json` exists. |
| Graph-first raw-search avoidance | Hook reminds before broad searches | Implemented for raw `read`, `grep`/`find`/`ls`, and search-like `bash` | Reminder fires once per turn and avoids loops on graph artifact reads. |
| Targeted raw follow-up | Claude rules ask for graph-first orientation | Implemented with explicit post-artifact guidance to read one targeted raw file when confirmation/debugging requires it | Prevents broad reorientation after graph artifact inspection. |
| Cross-module relationship questions | Latest rules prefer `graphify query`, `graphify path`, `graphify explain` over grep | Implemented in extension prompt and skill docs | Use CLI or MCP depending on query volume. |
| Freshness after edits | Latest rules recommend `graphify update .` after code changes | Implemented with code-edit detection, `needs_update` handling, stale status, and reminders | Pi does not silently run updates; it guides the agent/user. |
| `/graphify` trigger | Claude skill trigger is `/graphify` | Implemented as Pi extension command `/graphify` that delegates to the graphify skill | Pi skill commands also remain available as `/skill:graphify`. |
| Full build workflow | Upstream `graphify/skill.md` describes detection, AST extraction, semantic extraction, exports, and summaries | Pi skill now documents the Pi-native CLI workflow and safety rules | Pi does not reimplement upstream Python internals; it drives the `graphify` CLI. |
| `query`, `path`, `explain` | Supported by upstream skill and CLI | Documented in Pi skill and prompted by extension | Uses `graphify-out/graph.json`. |
| `update`, `cluster-only`, `watch` | Supported by upstream CLI/skill | Documented and surfaced by freshness reminders | `graphify update .` preferred; older `graphify . --update` remains documented. |
| Wiki output | `--wiki` builds agent-crawlable wiki | Documented and preferred by extension | Pi reads wiki first when present. |
| Exports | HTML default; optional SVG, GraphML, Neo4j, Obsidian | Documented in Pi skill | Pi package does not add wrappers around these CLI commands. |
| MCP server | `python -m graphify.serve graphify-out/graph.json`, plus `--mcp` guidance | Documented in Pi skill and README | No package-managed MCP registration yet; users can start/connect MCP explicitly. |
| GitHub clone | v0.5.0 `graphify clone <github-url>` and `/graphify https://github.com/...` workflow | Documented in Pi skill | `/graphify` command delegates arguments to the skill; the CLI performs clone/reuse. |
| Cross-repo graphs | v0.5.0 `graphify merge-graphs` | Documented in Pi skill | No extra Pi wrapper. |
| Data-loss/shrink guard | Upstream Python library behavior | Inherited from installed `graphifyy` version | Pi does not duplicate this logic. |
| `CLAUDE_CONFIG_DIR` | Upstream Claude installer respects it | Not applicable | Pi packages install through Pi package settings instead of Claude config dirs. |
| Platform installers for other agents | Upstream supports Claude, Codex, OpenCode, Cursor, Gemini, etc. | Out of scope | `graphify-pi` targets Pi only. |

## Intentional non-goals

- `graphify-pi` does not vendor or fork the upstream Python graph builder.
- `graphify-pi` does not recreate Claude-specific `CLAUDE.md` or `.claude/settings.json`; Pi has extension hooks and package manifests instead.
- `graphify-pi` does not automatically run expensive graph builds/updates without user/agent action.
- `graphify-pi` does not register MCP servers automatically because Pi MCP configuration is environment-specific.

## Verification coverage

Deterministic evals in `evals/graphify-agent.test.ts` cover:

- system prompt graph guidance
- report-first, wiki-first, and graph.json fallback behavior
- raw read/search reminders
- redirect-loop prevention
- targeted raw follow-up guidance
- `graphify-out/needs_update` stale state
- code edit stale state and `graphify update .` clearing
- native `/graphify` command delegation

Live/judge eval scenarios in `evals/scenarios/` cover graph-first behavior across report, wiki, graph.json fallback, raw-name bait, and targeted raw follow-up cases.

## Maintenance checklist for future upstream releases

1. Review latest upstream release notes.
2. Compare `graphify/skill.md` usage table and always-on rules with `skills/graphify/SKILL.md`.
3. Compare `graphify/__main__.py` Claude persistent rules with `extensions/graphify.ts` prompt rules.
4. Add/adjust deterministic evals for any new always-on behavior.
5. Update this matrix and README before publishing.

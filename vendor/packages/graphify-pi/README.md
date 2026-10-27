# graphify-pi

Pi extension and skill package for [graphify](https://github.com/safishamsi/graphify).

It brings graphify's Claude-style graph-first workflow to pi:

- injects graphify guidance into the system prompt when `graphify-out/` exists
- reminds the agent to read graph artifacts before broad raw search/read operations
- prefers `graphify-out/wiki/index.md` when present, then `GRAPH_REPORT.md`, then `graph.json`
- marks stale graphs when `graphify-out/needs_update` exists or code files changed in-session
- recommends `graphify update .` before relying on modified areas
- registers a native `/graphify ...` pi command that delegates to the graphify skill
- shows a small graphify status indicator in pi
- includes a `/skill:graphify` skill for build/update/query/path/explain/clone/merge/MCP workflows

## Parity target

Current parity target: upstream `safishamsi/graphify` v0.5.x Claude integration and skill workflow.

See [`docs/PARITY.md`](docs/PARITY.md) for the detailed parity matrix, intentional non-goals, and maintenance checklist.

Short version:

| Area | Status |
| --- | --- |
| Always-on Claude-style graph reminder | Implemented in Pi extension |
| Wiki/report/graph artifact preference | Implemented; Pi prefers wiki first |
| `needs_update` and post-edit freshness | Implemented |
| `/graphify` trigger | Implemented as Pi command |
| Full graphify CLI workflow guidance | Implemented in Pi skill docs |
| Upstream Python graph building internals | Inherited from installed `graphifyy`, not vendored |
| Claude-specific files/hooks | Not applicable; Pi uses extensions/skills |

## Install

From a local checkout:

```bash
pi install .
```

Or for just the current project:

```bash
pi install -l .
```

From npm:

```bash
pi install npm:graphify-pi
```

From git:

```bash
pi install git:github.com/juhas96/graphify-pi
```

Graphify itself is a Python package. If the `graphify` CLI is not installed:

```bash
uv tool install graphifyy
# or
pipx install graphifyy
# or
python3 -m pip install graphifyy
```

## Usage

### Native Pi command

```text
/graphify .
/graphify update .
/graphify query "show the auth flow"
/graphify path "AuthModule" "Database"
/graphify explain "DigestAuth"
/graphify https://github.com/owner/repo
```

The command sends a user message instructing the agent to use the packaged graphify skill with your arguments.

### Skill command

```text
/skill:graphify .
/skill:graphify update .
/skill:graphify query "show the auth flow"
```

### Direct CLI commands

```bash
graphify .
graphify update .
graphify . --wiki
graphify query "show the auth flow" --graph graphify-out/graph.json
graphify path "AuthModule" "Database" --graph graphify-out/graph.json
graphify explain "DigestAuth" --graph graphify-out/graph.json
graphify clone https://github.com/owner/repo
graphify merge-graphs repo-a/graphify-out/graph.json repo-b/graphify-out/graph.json --out graphify-out/cross-repo-graph.json
python -m graphify.serve graphify-out/graph.json
```

## What the extension does

When a graph exists, the extension adds graph-first guidance equivalent to the Claude/OpenCode reminder:

> graphify: Knowledge graph exists. Read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure before searching raw files.

Pi adds more context than the simple Claude hook:

- wiki-first preference when `graphify-out/wiki/index.md` exists
- `graph.json` fallback when report/wiki are absent
- cross-module query guidance for `graphify query`, `graphify path`, and `graphify explain`
- targeted raw-file follow-up after graph artifact inspection
- stale graph warnings from `needs_update` or in-session code edits

## Files

- `extensions/graphify.ts` — pi extension
- `skills/graphify/SKILL.md` — pi graphify skill
- `docs/PARITY.md` — parity matrix against upstream graphify Claude integration
- `evals/graphify-agent.test.ts` — deterministic extension behavior evals
- `evals/run-live.ts` — model-in-the-loop, rule-based live eval runner
- `evals/run-judge.ts` — LLM-as-judge eval runner for live traces
- `evals/render-report.ts` — compact leaderboard/report generator
- `evals/judge-rubric.md` — scoring rubric for the judge run
- `evals/scenarios/*.json` — live eval scenarios
- `package.json` — pi package manifest

## Evals

Deterministic behavior evals:

```bash
npm run evals
```

LLM-driven evals:

```bash
npm run evals:live:dry
npm run evals:live
npm run evals:judge:dry
npm run evals:judge
npm run evals:report
```

Run the full pipeline:

```bash
npm run evals:full
```

Optional model selection:

```bash
PI_EVAL_MODEL=anthropic/claude-sonnet-4-20250514 npm run evals:live
PI_JUDGE_MODEL=anthropic/claude-sonnet-4-20250514 npm run evals:judge
```

Current deterministic eval coverage includes:

- graph-first prompt injection
- report-first orientation
- wiki-first orientation
- graph.json-only fallback
- redirect-loop prevention
- targeted raw-file follow-up
- stale graph status for `graphify-out/needs_update`
- stale graph status after code edits
- `/graphify` command delegation

Live scenarios cover:

- report-first orientation
- wiki-first orientation
- graph.json-only fallback
- graph.json-only adversarial search bait
- raw filename bait vs graph report
- refresh-loop triage with targeted code follow-up
- semantic routing triage with wiki + targeted router follow-up
- wiki ownership chain with targeted raw follow-up
- stale graph / `needs_update` guidance
- graph query/path command selection for relationship questions

Outputs:

- live trace summary: `evals/results/last-live.json`
- judge summary: `evals/results/last-judge.json`
- compact leaderboard/report: `evals/results/last-report.md`

## Publishing

Dry-run the package contents:

```bash
npm run pack:check
```

Publish to npm:

```bash
npm publish
```

The package is configured to publish:

- `extensions/`
- `skills/`
- `docs/`
- `README.md`
- `LICENSE`

Local helper/reference folders such as `upstream-graphify/` are not shipped.

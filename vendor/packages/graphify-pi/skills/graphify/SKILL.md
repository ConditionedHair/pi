---
name: graphify
description: Build, update, query, and navigate graphify knowledge graphs in pi. Use for codebase/corpus architecture questions, /graphify requests, GRAPH_REPORT.md, graph.json, wiki navigation, graph freshness, clone/merge-graphs, MCP graph access, or turning code/docs/papers/images/audio/video into a persistent graph.
---

# graphify for pi

Use graphify from pi to build and navigate persistent project knowledge graphs.

Graphify upstream target for this skill: `safishamsi/graphify` v0.5.x. The Python package is `graphifyy`; the CLI is `graphify`.

## Pi-specific behavior

This package includes a pi extension that makes graphify semi-always-on:

- if `graphify-out/GRAPH_REPORT.md` exists, pi is reminded to consult it before broad raw search
- if `graphify-out/wiki/index.md` exists, prefer the wiki for agent-crawlable navigation
- if only `graphify-out/graph.json` exists, use it as the fallback map
- `/graphify ...` is registered as a pi command that delegates to this skill workflow
- if `graphify-out/needs_update` exists or code files changed during the session, update guidance should recommend `graphify update .`

When working on architecture/codebase questions in a project that already has graphify output, read these first:

1. `graphify-out/wiki/index.md` if present and sufficient
2. `graphify-out/GRAPH_REPORT.md`
3. `graphify-out/graph.json` only when wiki/report are absent or a deeper graph-level inspection is needed

## Command map

```bash
graphify .                                      # build graph for current directory
graphify ./raw                                 # build graph for a target folder
graphify https://github.com/owner/repo          # clone a public GitHub repo and graph it
graphify https://github.com/owner/repo --branch main
graphify . --mode deep                         # richer inferred semantic edges
graphify update .                              # safe incremental update after edits
graphify . --update                            # skill-compatible update flag
graphify cluster-only                          # recluster existing graph
graphify . --cluster-only
graphify . --directed                          # preserve edge direction in graph.json
graphify . --wiki                              # write graphify-out/wiki/
graphify . --obsidian --obsidian-dir ~/vaults/project
graphify . --svg                               # write graph.svg
graphify . --graphml                           # write graph.graphml
graphify . --neo4j                             # write cypher.txt
graphify . --neo4j-push bolt://localhost:7687
graphify . --mcp                               # start MCP stdio server when supported
graphify add https://example.com/post          # fetch URL into corpus and update
graphify add https://example.com/post --author "Name" --contributor "You"
graphify query "show the auth flow" --graph graphify-out/graph.json
graphify query "what connects DigestAuth to Response?" --dfs --budget 1500
graphify path "AuthModule" "Database" --graph graphify-out/graph.json
graphify explain "SwinTransformer" --graph graphify-out/graph.json
graphify watch .                               # or: python3 -m graphify.watch . --debounce 3
graphify hook install                          # post-commit/post-checkout graph refresh
graphify hook status
graphify merge-graphs repo1/graphify-out/graph.json repo2/graphify-out/graph.json --out graphify-out/cross-repo-graph.json
```

## Standard workflows

### 1. Existing graph: answer graph-first

1. Check for `graphify-out/wiki/index.md`, `GRAPH_REPORT.md`, and `graph.json`.
2. Read the best graph artifact before raw grep/find.
3. Use graph edges to choose targeted raw files only when implementation confirmation is needed.
4. For cross-module relationship questions, prefer:
   - `graphify query "QUESTION" --graph graphify-out/graph.json`
   - `graphify path "A" "B" --graph graphify-out/graph.json`
   - `graphify explain "NODE" --graph graphify-out/graph.json`
5. If the graph lacks enough information, say so; do not invent nodes, edges, or source paths.

### 2. Fresh build

Use this when no `graphify-out/` exists or the user explicitly asks to build a graph.

```bash
graphify .
```

For a large or risky corpus, first inspect scope cheaply:

```bash
find . -maxdepth 3 -type f | wc -l
find . -maxdepth 3 -type d \( -name node_modules -o -name .git -o -name dist -o -name build \) -prune -o -type f -print | head -50
```

If the corpus is huge, ask which subfolder to graph instead of running an expensive broad build. Respect `.graphifyignore` for exclusions.

After the build, read `graphify-out/GRAPH_REPORT.md` and summarize only:

- God Nodes
- Surprising Connections
- Suggested Questions

Do not dump the whole report unless asked.

### 3. Update after code or corpus changes

If code files changed during the session or `graphify-out/needs_update` exists:

```bash
graphify update .
```

Use update instead of a full rebuild when a graph already exists. `graphify update .` is the latest upstream shorthand for the safe AST/incremental path; `graphify . --update` remains acceptable when matching older skill docs.

For clustering-only changes:

```bash
graphify cluster-only
# or
graphify . --cluster-only
```

### 4. Query, path, and explain

Use graph queries when the user asks how concepts relate, where a flow crosses modules, or why a component exists.

```bash
graphify query "show the auth flow" --graph graphify-out/graph.json
graphify path "AuthModule" "Database" --graph graphify-out/graph.json
graphify explain "DigestAuth" --graph graphify-out/graph.json
```

Answer from the returned subgraph. Cite source files/locations from the query output when present.

### 5. GitHub clone and cross-repo graphs

Upstream v0.5 adds direct GitHub cloning:

```bash
graphify clone https://github.com/owner/repo
graphify clone https://github.com/owner/repo --branch feature-x
```

Graphify clones into `~/.graphify/repos/<owner>/<repo>` and reuses existing clones. If the user gives `/graphify https://github.com/owner/repo`, treat the resolved local clone path as the corpus target.

For multiple repos:

```bash
graphify clone https://github.com/owner/repo-a
graphify clone https://github.com/owner/repo-b
graphify ~/.graphify/repos/owner/repo-a
graphify ~/.graphify/repos/owner/repo-b
graphify merge-graphs \
  ~/.graphify/repos/owner/repo-a/graphify-out/graph.json \
  ~/.graphify/repos/owner/repo-b/graphify-out/graph.json \
  --out graphify-out/cross-repo-graph.json
```

Merged nodes carry repo metadata so answers can distinguish origins.

### 6. Add URLs or media

```bash
graphify add https://arxiv.org/abs/1706.03762
graphify add https://example.com/article --author "Author" --contributor "Your Name"
graphify add https://youtube.com/watch?v=...   # requires graphifyy video extras when transcription is needed
```

Video/audio transcription requires upstream optional dependencies, usually:

```bash
pip install 'graphifyy[video]'
```

Office/PDF extras may similarly require upstream extras. If a command reports a missing optional dependency, tell the user the exact install hint.

### 7. MCP graph access

For repeated structured graph queries, prefer MCP instead of pasting all of `graph.json` into context.

```bash
python -m graphify.serve graphify-out/graph.json
```

The upstream MCP server exposes tools such as `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, and `shortest_path`.

Use MCP when:

- the user will ask many graph questions in one session
- `graph.json` is too large to read directly
- tool-level node/edge lookup is more reliable than text search

Use CLI `graphify query/path/explain` when a single focused answer is enough.

### 8. Watch and git hooks

For long agentic edit sessions:

```bash
graphify watch .
```

Code changes can rebuild graph artifacts automatically. Non-code/docs/media changes may write `graphify-out/needs_update`, after which you should run a manual update.

For commit-based refresh:

```bash
graphify hook install
graphify hook status
graphify hook uninstall
```

## Safety and honesty rules

- Do not read or paste all of `graph.json` unless it is small and necessary.
- Prefer wiki/report/query output over broad raw grep.
- Never invent edges, source paths, or ownership from labels alone.
- If a graph artifact gives an exact path, use that exact path.
- If no exact path is present, do one narrow lookup and then read the real file.
- When graph output is stale, say so and run or recommend `graphify update .`.
- Keep summaries concise and cite graph artifacts clearly.

## Output summary pattern

After build/update:

- “I built/updated the graph at `graphify-out/`.”
- “I read `graphify-out/GRAPH_REPORT.md`.”
- “Top god nodes: ...”
- “Surprising connections: ...”
- “Suggested follow-up questions: ...”

After query/path/explain:

- “I queried `graphify-out/graph.json` with `graphify query ...`.”
- “Relevant nodes/edges: ...”
- “Source files cited by the graph: ...”
- “Confidence caveat: EXTRACTED vs INFERRED/AMBIGUOUS where relevant.”

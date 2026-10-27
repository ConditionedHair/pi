import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type GraphState = {
  hasGraph: boolean;
  hasReport: boolean;
  hasWiki: boolean;
  hasNeedsUpdate: boolean;
  reportPath: string;
  wikiPath: string;
  graphPath: string;
  needsUpdatePath: string;
};

const GRAPH_DIR = "graphify-out";
const REPORT_REL = path.join(GRAPH_DIR, "GRAPH_REPORT.md");
const WIKI_REL = path.join(GRAPH_DIR, "wiki", "index.md");
const GRAPH_REL = path.join(GRAPH_DIR, "graph.json");
const NEEDS_UPDATE_REL = path.join(GRAPH_DIR, "needs_update");

const CODE_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".dart",
  ".ex",
  ".exs",
  ".go",
  ".java",
  ".jl",
  ".js",
  ".jsx",
  ".kt",
  ".kts",
  ".lua",
  ".m",
  ".mjs",
  ".mm",
  ".php",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".scala",
  ".sv",
  ".swift",
  ".ts",
  ".tsx",
  ".v",
  ".vue",
  ".zig",
]);

function exists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function refreshGraphState(cwd: string): GraphState {
  const reportPath = path.join(cwd, REPORT_REL);
  const wikiPath = path.join(cwd, WIKI_REL);
  const graphPath = path.join(cwd, GRAPH_REL);
  const needsUpdatePath = path.join(cwd, NEEDS_UPDATE_REL);

  const hasReport = exists(reportPath);
  const hasWiki = exists(wikiPath);
  const hasGraph = exists(graphPath) || hasReport;
  const hasNeedsUpdate = exists(needsUpdatePath);

  return { hasGraph, hasReport, hasWiki, hasNeedsUpdate, reportPath, wikiPath, graphPath, needsUpdatePath };
}

function getPrimaryArtifact(graph: GraphState): string {
  if (graph.hasWiki) return WIKI_REL;
  if (graph.hasReport) return REPORT_REL;
  return GRAPH_REL;
}

function normalizeToolPath(value?: string): string {
  if (!value) return "";
  return value.startsWith("@") ? value.slice(1) : value;
}

function isGraphArtifactPath(value?: string): boolean {
  const normalized = normalizeToolPath(value).replaceAll("\\", "/");
  return (
    normalized.includes("graphify-out/GRAPH_REPORT.md") ||
    normalized.includes("graphify-out/wiki/index.md") ||
    normalized.includes("graphify-out/graph.json")
  );
}

function isGraphifyOutputPath(value?: string): boolean {
  const normalized = normalizeToolPath(value).replaceAll("\\", "/");
  return normalized.includes("graphify-out/");
}

function isSearchLikeBash(command: string | undefined): boolean {
  if (!command) return false;
  return /(^|\s)(rg|grep|find|fd|ls|tree)(\s|$)/.test(command);
}

function isGraphUpdateCommand(command: string | undefined): boolean {
  if (!command) return false;
  return (
    /(^|\s)graphify\s+(update|watch|cluster-only)\b/.test(command) ||
    command.includes("from graphify.watch import _rebuild_code") ||
    command.includes("python -m graphify.watch") ||
    command.includes("python3 -m graphify.watch")
  );
}

function isLikelyCodePath(value?: string): boolean {
  if (!value || isGraphifyOutputPath(value)) return false;
  return CODE_EXTENSIONS.has(path.extname(normalizeToolPath(value)).toLowerCase());
}

function mutatesCode(toolName: string, input: Record<string, any> | undefined): boolean {
  if ((toolName === "write" || toolName === "edit") && isLikelyCodePath(input?.path)) return true;
  if (toolName === "bash") {
    const command = String(input?.command ?? "");
    if (isGraphUpdateCommand(command)) return false;
    return /(^|\s)(python|python3|node|npm|pnpm|yarn|bun|go|cargo|ruby|perl|sed|awk)\b/.test(command) &&
      /(>|>>|--write|-w\b|--fix\b|format|fmt|prettier|eslint|ruff|black|cargo\s+fmt|gofmt)/.test(command);
  }
  return false;
}

function shouldRemind(toolName: string, input: Record<string, any> | undefined): boolean {
  if (toolName === "grep" || toolName === "find" || toolName === "ls") return true;
  if (toolName === "bash") return isSearchLikeBash(input?.command);
  if (toolName === "read") return !isGraphArtifactPath(input?.path);
  return false;
}

function prependReminder(
  content: Array<{ type: string; text?: string; [key: string]: any }>,
  reminder: string,
) {
  if (!content || content.length === 0) {
    return [{ type: "text", text: reminder }];
  }

  const next = [...content];
  const firstTextIndex = next.findIndex((part) => part.type === "text");

  if (firstTextIndex === -1) {
    return [{ type: "text", text: reminder }, ...next];
  }

  const part = next[firstTextIndex];
  next[firstTextIndex] = {
    ...part,
    text: `${reminder}\n\n${part.text ?? ""}`,
  };
  return next;
}

export default function graphifyPiExtension(pi: ExtensionAPI) {
  let graph = refreshGraphState(process.cwd());
  let remindedThisTurn = false;
  let graphInspectedThisTurn = false;
  let followUpGuidedThisTurn = false;
  let updateGuidedThisTurn = false;
  let codeChangedThisSession = false;

  const graphMayBeStale = () => graph.hasNeedsUpdate || codeChangedThisSession;

  const buildStaleSuffix = () =>
    graphMayBeStale() ? " Graph may be stale because files changed; after inspecting it, run `graphify update .` before relying on modified areas." : "";

  const buildReminder = () => {
    const target = getPrimaryArtifact(graph);
    return `graphify: Knowledge graph exists. Read ${target} for god nodes and community structure before searching raw files.${buildStaleSuffix()}`;
  };

  const setGraphStatus = (ctx: any) => {
    if (!graph.hasGraph) {
      ctx.ui.setStatus("graphify", undefined);
      return;
    }

    const availability = graph.hasWiki ? "wiki + report" : graph.hasReport ? "report" : "graph";
    const freshness = graphMayBeStale() ? " · update recommended" : "";
    ctx.ui.setStatus("graphify", `graphify active · ${availability} available${freshness}`);
  };

  pi.registerCommand("graphify", {
    description: "Run the graphify skill workflow (build, update, query, path, explain, clone, merge, MCP).",
    handler: async (args, ctx) => {
      const trimmed = args.trim();
      if (!ctx.isIdle()) {
        pi.sendUserMessage(`Use the graphify skill for this follow-up: ${trimmed || "."}`, { deliverAs: "followUp" });
        ctx.ui.notify("Queued /graphify request as a follow-up", "info");
        return;
      }
      pi.sendUserMessage(`Use the graphify skill now. User arguments: ${trimmed || "."}`);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    graph = refreshGraphState(ctx.cwd);
    remindedThisTurn = false;
    codeChangedThisSession = false;
    setGraphStatus(ctx);
  });

  pi.on("turn_start", async () => {
    remindedThisTurn = false;
    graphInspectedThisTurn = false;
    followUpGuidedThisTurn = false;
    updateGuidedThisTurn = false;
  });

  pi.on("before_agent_start", async (event, ctx) => {
    graph = refreshGraphState(ctx.cwd);
    if (!graph.hasGraph) return;

    const primaryArtifact = getPrimaryArtifact(graph);
    const extra = [
      "## graphify",
      "",
      `This project has a graphify knowledge graph at ${GRAPH_DIR}/.`,
      "",
      "Rules:",
      `- Before answering architecture or codebase questions, read ${primaryArtifact} first.`,
      `- If ${WIKI_REL} exists, navigate it instead of reading raw files when it is sufficient.`,
      `- If ${REPORT_REL} exists, use it for god nodes and community structure.`,
      "- Prefer the graph summary before broad file searches.",
      "- For cross-module or relationship questions such as \"how does X relate to Y\", prefer `graphify query`, `graphify path`, or `graphify explain` over grep because those commands traverse EXTRACTED and INFERRED graph edges.",
      "- If the task asks for the next implementation file, debugging follow-up, or code confirmation, use the graph artifact to choose one targeted raw file and read it before answering.",
      "- Never invent a source path from a component name. If the graph artifact gives an exact path, use that exact path. If it does not, do one narrow lookup to find the existing path and then read it before answering.",
      "- After you have inspected a graph artifact this turn, do not go back and re-orient with broad raw searches unless the graph artifacts were insufficient.",
      `- If ${NEEDS_UPDATE_REL} exists or code files changed in this session, tell the user the graph may be stale and run \`graphify update .\` before relying on modified areas.`,
    ].join("\n");

    return {
      systemPrompt: `${event.systemPrompt}\n\n${extra}`,
    };
  });

  pi.on("tool_result", async (event, ctx) => {
    graph = refreshGraphState(ctx.cwd);

    const input = event.input as Record<string, any> | undefined;
    if (event.toolName === "bash" && isGraphUpdateCommand(input?.command)) {
      codeChangedThisSession = false;
      setGraphStatus(ctx);
      return;
    }

    if (graph.hasGraph && mutatesCode(event.toolName, input)) {
      codeChangedThisSession = true;
      setGraphStatus(ctx);
      if (!updateGuidedThisTurn) {
        updateGuidedThisTurn = true;
        return {
          content: prependReminder(
            event.content as Array<{ type: string; text?: string }>,
            "graphify: Code changed while a knowledge graph exists. Run `graphify update .` after this edit before relying on graph answers about modified areas.",
          ),
        };
      }
    }

    if (!graph.hasGraph) return;

    const graphArtifactRead = event.toolName === "read" && isGraphArtifactPath(input?.path);

    if (graphArtifactRead) {
      graphInspectedThisTurn = true;
      if (followUpGuidedThisTurn) return;
      followUpGuidedThisTurn = true;

      return {
        content: prependReminder(
          event.content as Array<{ type: string; text?: string }>,
          `graphify: Graph artifact inspected. If the task asks for implementation confirmation, the next file to debug, or code ownership, now read one targeted raw file chosen from the graph before answering. Use an exact path from the graph when available; otherwise do one narrow lookup for the real path. Avoid broad raw searches and do not invent file paths from component names.${buildStaleSuffix()}`,
        ),
      };
    }

    if (graphInspectedThisTurn || remindedThisTurn) return;
    if (!shouldRemind(event.toolName, input)) return;

    const reminder = buildReminder();
    remindedThisTurn = true;

    return {
      content: prependReminder(event.content as Array<{ type: string; text?: string }>, reminder),
    };
  });
}

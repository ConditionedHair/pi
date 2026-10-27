import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getGuidelines, AVAILABLE_MODULES, type Module } from "./guidelines.js";
import { WidgetSession } from "./session.js";
import type { Opener } from "./glimpse-window.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GLIMPSE_PATH = join(__dirname, "../../../node_modules/glimpseui/src/glimpse.mjs");

// ── Tool schemas ───────────────────────────────────────────────────────
const ReadMeParams = Type.Object({
  modules: Type.Array(StringEnum(AVAILABLE_MODULES), {
    description: "Which module(s) to load. Pick all that fit.",
  }),
});

const ShowWidgetParams = Type.Object({
  i_have_seen_read_me: Type.Boolean({
    description: "Confirm you have already called visualize_read_me in this conversation.",
  }),
  title: Type.String({
    description: "Short snake_case identifier for this widget (used as window title).",
  }),
  widget_code: Type.String({
    description:
      "HTML or SVG code to render. For SVG: raw SVG starting with <svg>. " +
      "For HTML: raw content fragment, no DOCTYPE/<html>/<head>/<body>.",
  }),
  width:    Type.Optional(Type.Number({ description: "Window width in pixels. Default: 800." })),
  height:   Type.Optional(Type.Number({ description: "Window height in pixels. Default: 600." })),
  floating: Type.Optional(Type.Boolean({ description: "Keep window always on top. Default: false." })),
});

interface ReadMeDetails    { modules: readonly Module[]; }
interface ShowWidgetDetails { title: string; width: number; height: number; isSVG: boolean; }

export default function (pi: ExtensionAPI) {
  const activeSessions = new Set<WidgetSession>();
  let openCache: Opener | null = null;

  async function getOpen(): Promise<Opener> {
    if (!openCache) {
      const mod = await import(GLIMPSE_PATH) as { open: Opener };
      openCache = mod.open;
    }
    return openCache;
  }

  // ── Streaming bridge ───────────────────────────────────────────────────
  //
  // While show_widget streams, we want the user to see partial content
  // before the tool call finishes. The session is created on toolcall_start
  // and `execute()` later picks it up by content index.

  let pendingIndex: number | null = null;
  let pendingSession: WidgetSession | null = null;

  function clearPending(): void { pendingIndex = null; pendingSession = null; }

  pi.on("message_update", async (event) => {
    const raw = (event as { assistantMessageEvent?: {
      type: string;
      contentIndex: number;
      partial?: { content?: Array<{ type: string; name?: string; arguments?: Record<string, unknown> }> };
      toolCall?: { arguments?: Record<string, unknown> };
    } }).assistantMessageEvent;
    if (!raw) return;

    if (raw.type === "toolcall_start") {
      const block = raw.partial?.content?.[raw.contentIndex];
      if (block?.type !== "toolCall" || block.name !== "show_widget") return;

      const args = block.arguments ?? {};
      const title = String(args.title ?? "Widget").replace(/_/g, " ");
      const width  = typeof args.width  === "number" ? args.width  : 800;
      const height = typeof args.height === "number" ? args.height : 600;

      try {
        const open = await getOpen();
        const session = new WidgetSession(open, { title, width, height });
        activeSessions.add(session);
        pendingIndex = raw.contentIndex;
        pendingSession = session;
      } catch (err) {
        console.error("[generative-ui] failed to open streaming window:", err);
      }
      return;
    }

    if (raw.type === "toolcall_delta" && pendingSession && raw.contentIndex === pendingIndex) {
      const block = raw.partial?.content?.[raw.contentIndex];
      const html = block?.arguments?.widget_code;
      if (typeof html === "string") pendingSession.onChunk(html);
      return;
    }

    if (raw.type === "toolcall_end" && pendingSession && raw.contentIndex === pendingIndex) {
      const html = raw.toolCall?.arguments?.widget_code;
      if (typeof html === "string") await pendingSession.onComplete(html);
      // execute() picks up the session via the pending* lets
      return;
    }
  });

  // ── read_me tool ───────────────────────────────────────────────────────

  pi.registerTool<typeof ReadMeParams, ReadMeDetails>({
    name: "visualize_read_me",
    label: "Read Guidelines",
    description:
      "Returns design guidelines for show_widget (CSS patterns, colors, typography, layout rules, examples). " +
      "Call once before your first show_widget call. Do NOT mention this call to the user — it is an internal setup step.",
    promptSnippet: "Load design guidelines before creating widgets. Call silently before first show_widget use.",
    promptGuidelines: [
      "Call visualize_read_me once before your first show_widget call to load design guidelines.",
      "Do NOT mention the read_me call to the user — call it silently, then proceed directly to building the widget.",
      "Pick the modules that match your use case: interactive, chart, mockup, art, diagram.",
    ],
    parameters: ReadMeParams,

    async execute(_id, params) {
      const modules = params.modules as readonly Module[];
      return {
        content: [{ type: "text" as const, text: getGuidelines(modules) }],
        details: { modules },
      };
    },

    renderCall(args, theme) {
      const mods = (args.modules ?? []).join(", ");
      return new Text(theme.fg("toolTitle", theme.bold("read_me ")) + theme.fg("muted", mods), 0, 0);
    },

    renderResult(_result, { isPartial }, theme) {
      if (isPartial) return new Text(theme.fg("warning", "Loading guidelines..."), 0, 0);
      return new Text(theme.fg("dim", "Guidelines loaded"), 0, 0);
    },
  });

  // ── show_widget tool ───────────────────────────────────────────────────

  pi.registerTool<typeof ShowWidgetParams, ShowWidgetDetails>({
    name: "show_widget",
    label: "Show Widget",
    description:
      "Show visual content — SVG graphics, diagrams, charts, or interactive HTML/JS widgets — in a native window. " +
      "Supports macOS, Linux, and Windows. " +
      "The HTML is rendered in a native WebView with full CSS/JS support including Canvas, animations, and CDN libraries. " +
      "Widgets are display-only from the agent's perspective: there is no return channel for clicks/input. " +
      "In-widget interactivity (sliders that update charts, hover states, animations, click handlers driving local state) all works — " +
      "but the agent does not receive callbacks. Do NOT write `glimpse.send(...)` or `sendPrompt(...)` patterns; they are no-ops here. " +
      "IMPORTANT: Call visualize_read_me once before your first show_widget call.",
    promptSnippet:
      "Render interactive HTML/SVG widgets in a native window. Full CSS, JS, Canvas, Chart.js. Display-only — no callbacks to the agent.",
    promptGuidelines: [
      "Use show_widget when the user asks for visual content: charts, diagrams, interactive explainers, UI mockups, art.",
      "Always call visualize_read_me first to load design guidelines, then set i_have_seen_read_me: true.",
      "The widget opens in a native window with full browser capabilities (Canvas, JS, CDN libraries).",
      "Structure HTML as fragments: no DOCTYPE/<html>/<head>/<body>. Style first, then HTML, then scripts.",
      "Widgets are display-only. The agent does not receive widget interactions — do not emit `glimpse.send(...)` or `sendPrompt(...)`. " +
        "In-widget interactivity (sliders, hovers, controls that mutate the widget's own DOM) is fully supported and encouraged.",
      "Keep widgets focused and appropriately sized. Default is 800x600 but adjust to fit content.",
      "For SVG: start code with <svg> tag.",
    ],
    parameters: ShowWidgetParams,

    async execute(_id, params, signal) {
      if (!params.i_have_seen_read_me) {
        throw new Error("You must call visualize_read_me before show_widget. Set i_have_seen_read_me: true after doing so.");
      }
      if (signal?.aborted) {
        throw new Error("show_widget aborted before execution");
      }

      const code = params.widget_code;
      const isSVG = code.trimStart().startsWith("<svg");
      const title = params.title.replace(/_/g, " ");
      const width  = params.width  ?? 800;
      const height = params.height ?? 600;

      // Reuse the streaming session if present; otherwise open one now.
      let session: WidgetSession;
      if (pendingSession) {
        session = pendingSession;
        clearPending();
      } else {
        const open = await getOpen();
        session = new WidgetSession(open, { title, width, height, floating: params.floating });
        activeSessions.add(session);
      }

      // Wire abort BEFORE the async onComplete await — abort during
      // streaming flush must close the window. The listener also stays
      // attached for after we return, so an abort that arrives after the
      // tool resolves still cleans up the still-open window.
      session.onClosed(() => activeSessions.delete(session));
      if (signal) {
        if (signal.aborted) {
          session.close();
          throw new Error("show_widget aborted before execution");
        }
        signal.addEventListener("abort", () => session.close(), { once: true });
      }

      await session.onComplete(code);

      return {
        content: [{
          type: "text" as const,
          text: `Widget "${title}" rendered (${width}×${height}).`,
        }],
        details: { title: params.title, width, height, isSVG },
      };
    },

    renderCall(args, theme) {
      const title = (args.title ?? "widget").replace(/_/g, " ");
      const size = args.width && args.height ? ` ${args.width}×${args.height}` : "";
      let text = theme.fg("toolTitle", theme.bold("show_widget ")) + theme.fg("accent", title);
      if (size) text += theme.fg("dim", size);
      return new Text(text, 0, 0);
    },

    renderResult(result, { isPartial }, theme) {
      if (isPartial) return new Text(theme.fg("warning", "⟳ Widget rendering..."), 0, 0);
      const d = result.details;
      const title = (d?.title ?? "widget").replace(/_/g, " ");
      let text = theme.fg("success", "✓ ") + theme.fg("accent", title);
      text += theme.fg("dim", ` ${d?.width ?? 800}×${d?.height ?? 600}`);
      if (d?.isSVG) text += theme.fg("dim", " (SVG)");
      return new Text(text, 0, 0);
    },
  });

  // ── shutdown ───────────────────────────────────────────────────────────

  pi.on("session_shutdown", async () => {
    if (pendingSession) { pendingSession.close(); clearPending(); }
    for (const s of activeSessions) s.close();
    activeSessions.clear();
  });
}

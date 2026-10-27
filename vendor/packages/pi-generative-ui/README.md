# pi-generative-ui

Claude.ai's generative UI - reverse-engineered, rebuilt for [pi](https://github.com/badlogic/pi-mono).

Ask pi to "show me how compound interest works" and get a live interactive widget - sliders, charts, animations - rendered in a native window. Not a screenshot. Not a code block. A real HTML application with JavaScript, streaming live as the LLM generates it.

Runs on macOS, Linux, and Windows via [Glimpse](https://github.com/hazat/glimpse) 0.8+.

<img src="media/dashboard.gif" width="32%"> <img src="media/simulator.gif" width="32%"> <img src="media/diagram.gif" width="32%">

## How it works

On claude.ai, when you ask Claude to visualize something, it calls a tool called `show_widget` that renders HTML inline in the conversation. The HTML streams live - you see cards, charts, and sliders appear as tokens arrive.

This extension replicates that system for pi:

1. **LLM calls `visualize_read_me`** - loads design guidelines (lazy, only the relevant modules)
2. **LLM calls `show_widget`** - generates an HTML fragment as a tool call parameter
3. **Extension intercepts the stream** - opens a native window via [Glimpse](https://github.com/hazat/glimpse) and feeds partial HTML as tokens arrive
4. **[morphdom](https://github.com/patrick-steele-idem/morphdom) diffs the DOM** - new elements fade in smoothly, unchanged elements stay untouched
5. **Scripts execute on completion** - Chart.js, D3, Three.js, anything from CDN
6. **Hover any `<svg>` for export** - built-in floating menu copies SVG to clipboard or saves it via the native Save dialog

The widget window has full browser capabilities. Widgets are display-only from the agent's perspective — there's no return channel for clicks or input. In-widget interactivity (sliders, hover states, animations, controls that drive the widget's own DOM) is fully supported. Features that need host-side capabilities (like SVG copy/save) call into the host via `window.__glimpseUI.rpc(method, params)`.

## Install

```bash
pi install git:github.com/Michaelliv/pi-generative-ui
```

> Cross-platform — Glimpse 0.8 compiles a tiny native binary on `postinstall`:
>
> - **macOS** — Xcode Command Line Tools (`xcode-select --install`)
> - **Linux** — Rust + GTK4/WebKitGTK dev packages, or just use the Chromium fallback (any Chromium-based browser)
> - **Windows** — .NET 8 SDK + WebView2 Runtime

## Usage

Just ask pi to visualize things. The extension adds two tools that the LLM calls automatically:

- **"Show me how compound interest works"** → interactive explainer with sliders and Chart.js
- **"Visualize the architecture of a transformer"** → SVG diagram with labeled components  
- **"Create a dashboard for this data"** → metric cards, charts, tables
- **"Draw a particle system"** → Canvas animation

The LLM decides when to use widgets vs text based on the request. Explanatory/visual requests trigger widgets; code/text requests stay in the terminal.

## What's inside

### The guidelines - extracted from Claude

The design guidelines aren't hand-written. They're **extracted verbatim from claude.ai**.

Here's the trick: you can export any claude.ai conversation as JSON. The export includes full tool call payloads - including the complete `read_me` tool results containing Anthropic's actual design system. 72K of production rules covering typography, color palettes, streaming-safe CSS patterns, Chart.js configuration, SVG diagram engineering, and more.

We triggered `read_me` with each module combination, exported the conversation, parsed the JSON, split the responses into deduplicated sections, and verified byte-level accuracy against the originals. The result: our LLM gets the exact same instructions Claude gets on claude.ai.

Five modules, loaded on demand:

| Module | Size | What it covers |
|---|---|---|
| `interactive` | 19KB | Sliders, metric cards, live calculations |
| `chart` | 22KB | Chart.js setup, custom legends, number formatting |
| `mockup` | 19KB | UI component tokens, cards, forms, skeleton loading |
| `art` | 17KB | SVG illustration, Canvas animation, creative patterns |
| `diagram` | 59KB | Flowcharts, architecture diagrams, SVG arrow systems |

### Streaming architecture

The extension intercepts pi's streaming events (`toolcall_start` / `toolcall_delta` / `toolcall_end`). A `WidgetSession` owns one Glimpse window for the duration of a `show_widget` call:

```
toolcall_start    → new WidgetSession(open, {title, width, height})
toolcall_delta    → session.onChunk(html)     # debounced 150ms
toolcall_end      → session.onComplete(html)  # final + run scripts
execute()         → returns immediately; window stays open
```

The agent's tool call resolves the moment the final HTML lands; the window stays open until the user dismisses it. No 2-minute "waiting for interaction" timeout.

The page-side runtime is a real TypeScript module bundled by esbuild into a single IIFE inlined into the shell HTML. It speaks a typed JSON protocol with the host: `{type: "content", html, final}` host→page, `{type: "user-message" | "rpc-call", ...}` page→host. No `escapeJS`, no eval-strings-as-business-logic.

Key details:
- **One source of truth per concern** — protocol types in `protocol.ts`, window shape in `glimpse-window.ts`, OS bindings in `platform/{darwin,linux,win32}.ts`
- **Typed RPC** — features register `{name, handler}` once; widget code calls `window.__glimpseUI.rpc(method, params)` with a 30s default timeout
- **morphdom DOM diffing** — only changed nodes update; new nodes get a 0.3s fade-in animation; scripts run exactly once on the final chunk
- **150ms debounce** — batches rapid token updates for smooth visual rendering
- **Dark mode by default** — `#1a1a1a` background

### Glimpse

[Glimpse](https://github.com/hazat/glimpse) is a native macOS micro-UI library. It opens a WKWebView window in under 50ms via a tiny Swift binary. No Electron, no browser tab, no runtime dependencies beyond the system WebKit.

The Swift source compiles automatically on `npm install` via `postinstall`.

## Project structure

```
pi-generative-ui/
├── .pi/extensions/generative-ui/
│   ├── index.ts                 # Tool registration; streaming → session handoff
│   ├── session.ts               # WidgetSession — owns one window for its lifetime
│   ├── rpc.ts                   # Host-side RPC: routes rpc-call, forwards user-message
│   ├── protocol.ts              # Shared discriminated-union message types
│   ├── glimpse-window.ts        # Structural type for a Glimpse window
│   ├── features/svg-saver.ts    # svg.copy / svg.save RPC handlers
│   ├── platform/{darwin,linux,win32}.ts  # OS clipboard + save-dialog shims
│   ├── runtime/                 # Page-side TypeScript (bundled by build.mjs)
│   │   ├── index.ts             #   Boot: bridge + morph loop + features
│   │   ├── bridge.ts            #   Host↔page channel + RPC layer
│   │   ├── morph.ts             #   morphdom + runScripts
│   │   └── features/svg-saver.ts#   Hover menu UI
│   ├── runtime.bundle.ts        # AUTO-GENERATED: shell HTML + IIFE'd runtime
│   ├── build.mjs                # esbuild step → runtime.bundle.ts
│   ├── guidelines.ts            # 72K of verbatim claude.ai design guidelines
│   └── claude-guidelines/       # Raw extracted markdown (reference)
├── tests/                       # protocol + rpc + session + platform + integration
└── package.json                 # pi-package manifest
```

Rebuild the page-side bundle with `npm run build:runtime` after editing anything under `runtime/`. The bundle is committed so end users don't need a build step.

## How the guidelines were extracted

1. Start a conversation on claude.ai that triggers `show_widget`
2. Call `read_me` with each module combination (`art`, `chart`, `diagram`, `interactive`, `mockup`)
3. Export the conversation as JSON from claude.ai settings
4. Parse the JSON - every `tool_result` for `visualize:read_me` contains the complete guidelines
5. Split each response at `##` heading boundaries
6. Deduplicate shared sections (e.g., "Color palette" appears in chart, mockup, interactive, diagram)
7. Verify reconstruction matches the originals (4/5 exact, 1 has a single whitespace char difference)

The raw `read_me` responses are preserved in [`claude-guidelines/`](.pi/extensions/generative-ui/claude-guidelines/) - the original markdown exactly as claude.ai returned it, before splitting and deduplication. The conversation export JSON is not included in this repo.

## Credits

- [pi](https://github.com/badlogic/pi-mono) - the extensible coding agent that makes this possible
- [Glimpse](https://github.com/hazat/glimpse) - native macOS WKWebView windows
- [morphdom](https://github.com/patrick-steele-idem/morphdom) - DOM diffing for smooth streaming
- Anthropic - for building the generative UI system we reverse-engineered

## License

MIT

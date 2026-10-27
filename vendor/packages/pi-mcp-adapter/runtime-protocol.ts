/** Mediated protocol extensions. Raw SDK clients and transports stay inside the adapter. */
import { randomUUID } from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Transport } from "@modelcontextprotocol/client";
import type { ServerConnection } from "./server-manager.ts";
import { untracedMessageHandler } from "./mcp-trace.ts";

export const MCP_PROTOCOL_EVENT = "pi-mcp-adapter:protocol:v1";
export interface McpProtocolDefinition {
  namespace: string;
  requests: string[];
  streams: string[];
  notifications: string[];
}
export interface McpProtocolEnd {
  reason: "cancelled" | "ended" | "error" | "disconnected";
  error?: string;
  /** Preserve JSON-RPC error details for capability-specific recovery decisions. */
  protocolError?: { code: number; message: string; data?: unknown };
}
export interface McpProtocolWatch {
  readonly closed: Promise<McpProtocolEnd>;
  close(): void;
}
export interface McpProtocolStream {
  readonly id: string;
  readonly sent: Promise<void>;
  readonly closed: Promise<McpProtocolEnd>;
  cancel(): Promise<void>;
}
export interface McpProtocolSession {
  readonly signal: AbortSignal;
  /** Observe declared notifications outside this adapter's extension streams. */
  watchNotifications(
    methods: string[],
    onNotification: (method: string, params: Record<string, unknown>) => void,
  ): McpProtocolWatch;
  request(
    method: string,
    params?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
  openStream(
    method: string,
    params: Record<string, unknown>,
    onNotification: (method: string, params: Record<string, unknown>) => void,
  ): McpProtocolStream;
  close(): void;
}
export interface McpProtocol {
  connect(server: string): Promise<McpProtocolSession>;
  dispose(): void;
}
// Core methods must continue through the adapter's existing APIs and approval paths.
const reserved = new Set([
  "tools",
  "resources",
  "prompts",
  "sampling",
  "elicitation",
  "logging",
  "roots",
  "completion",
  "completions",
  "tasks",
  "subscriptions",
  "server",
  "client",
  "notifications",
  "rpc",
  "initialize",
  "ping",
]);
const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
function validate(raw: McpProtocolDefinition): McpProtocolDefinition {
  if (
    !record(raw) ||
    typeof raw.namespace !== "string" ||
    !/^[a-z][a-z0-9_-]*$/.test(raw.namespace) ||
    reserved.has(raw.namespace)
  )
    throw new Error("Invalid or reserved MCP protocol namespace");
  const names = new Set<string>();
  for (const field of ["requests", "streams", "notifications"] as const) {
    if (!Array.isArray(raw[field]) || raw[field].length > 64)
      throw new Error("Invalid MCP protocol methods");
    const prefix =
      field === "notifications"
        ? `notifications/${raw.namespace}/`
        : `${raw.namespace}/`;
    for (const name of raw[field]) {
      if (
        typeof name !== "string" ||
        !name.startsWith(prefix) ||
        !/^[a-zA-Z0-9_/-]+$/.test(name) ||
        name.length <= prefix.length ||
        names.has(name)
      )
        throw new Error("Invalid or duplicate MCP protocol method");
      names.add(name);
    }
  }
  return {
    namespace: raw.namespace,
    requests: [...raw.requests],
    streams: [...raw.streams],
    notifications: [...raw.notifications],
  };
}
function paramsCopy(params: Record<string, unknown>) {
  if (!record(params) || Object.hasOwn(params, "_meta"))
    throw new Error(
      "Protocol parameters must be an object without reserved _meta",
    );
  return structuredClone(params);
}
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
interface Entry {
  methods: Set<string>;
  notify(method: string, params: Record<string, unknown>): void;
  finish(end: McpProtocolEnd): void;
}
interface Router {
  prefix: string;
  next: number;
  entries: Map<string, Entry>;
  disconnect: Set<() => void>;
  closed: boolean;
  watchers: Set<Entry>;
}
const routers = new WeakMap<Transport, Router>();
function routerFor(connection: ServerConnection): Router {
  const transport = connection.transport;
  const existing = routers.get(transport);
  if (existing) return existing;
  const router: Router = {
    prefix: `mcp-extension-${randomUUID()}-`,
    next: 0,
    entries: new Map(),
    disconnect: new Set(),
    closed: false,
    watchers: new Set(),
  };
  routers.set(transport, router);
  // The router is the outermost handler, so tracing wraps it once; forward to the raw SDK handler.
  const previousMessage = untracedMessageHandler(transport);
  const previousClose = transport.onclose;
  transport.onmessage = (frame, extra) => {
    const raw = frame as any;
    const id =
      typeof raw.id === "string"
        ? raw.id
        : raw.params?._meta?.["io.modelcontextprotocol/subscriptionId"];
    const entry = typeof id === "string" ? router.entries.get(id) : undefined;
    if (entry && !raw.method && ("result" in raw || "error" in raw)) {
      entry.finish(
        "error" in raw
          ? {
              reason: "error",
              error:
                typeof raw.error?.message === "string"
                  ? raw.error.message
                  : "MCP stream error",
              ...(typeof raw.error?.code === "number"
                ? { protocolError: structuredClone(raw.error) }
                : {}),
            }
          : { reason: "ended" },
      );
      return;
    }
    const cancelled =
      raw.method === "notifications/cancelled" &&
      typeof raw.params?.requestId === "string"
        ? router.entries.get(raw.params.requestId)
        : undefined;
    if (cancelled) {
      cancelled.finish({
        reason: "ended",
        error: "MCP server cancelled the stream",
      });
      return;
    }
    if (
      entry &&
      !("id" in raw) &&
      entry.methods.has(raw.method) &&
      record(raw.params)
    ) {
      try {
        void Promise.resolve(entry.notify(raw.method, raw.params)).catch(
          (error) =>
            entry.finish({
              reason: "error",
              error: `Protocol handler failed: ${message(error)}`,
            }),
        );
      } catch (error) {
        entry.finish({
          reason: "error",
          error: `Protocol handler failed: ${message(error)}`,
        });
      }
      return;
    }
    // Ignore late replies/notifications belonging to this router, never unrelated traffic.
    if (!entry && typeof id === "string" && id.startsWith(router.prefix))
      return;
    if (
      !entry &&
      !("id" in raw) &&
      typeof raw.method === "string" &&
      (raw.params === undefined || record(raw.params))
    ) {
      for (const watcher of [...router.watchers]) {
        if (!router.watchers.has(watcher) || !watcher.methods.has(raw.method))
          continue;
        try {
          void Promise.resolve(
            watcher.notify(raw.method, structuredClone(raw.params ?? {})),
          ).catch((error) =>
            watcher.finish({
              reason: "error",
              error: `Protocol handler failed: ${message(error)}`,
            }),
          );
        } catch (error) {
          watcher.finish({
            reason: "error",
            error: `Protocol handler failed: ${message(error)}`,
          });
        }
      }
    }
    previousMessage?.(frame, extra);
  };
  transport.onclose = () => {
    router.closed = true;
    try {
      previousClose?.();
    } finally {
      for (const close of [...router.disconnect]) close();
    }
  };
  return router;
}
function pin(connection: ServerConnection) {
  connection.activeProtocolOperations =
    (connection.activeProtocolOperations ?? 0) + 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    connection.activeProtocolOperations!--;
    connection.lastUsedAt = Date.now();
  };
}

/** Internal implementation; only the mediated session is returned to extensions. */
export function createProtocolSession(
  connection: ServerConnection,
  owner: AbortSignal,
  definition: McpProtocolDefinition,
): McpProtocolSession {
  const spec = validate(definition);
  if (owner.aborted || connection.status !== "connected")
    throw new Error("MCP connection is unavailable");
  const router = routerFor(connection);
  if (router.closed) throw new Error("MCP connection is unavailable");
  const controller = new AbortController();
  const active = new Set<(end: McpProtocolEnd) => void>();
  const ensure = (method: string, allowed: string[]) => {
    if (controller.signal.aborted)
      throw new Error("MCP protocol session ended");
    if (!allowed.includes(method))
      throw new Error(`Undeclared MCP protocol method: ${method}`);
  };
  const close = (reason: McpProtocolEnd) => {
    if (controller.signal.aborted) return;
    for (const finish of [...active]) finish(reason);
    controller.abort(new Error(reason.error ?? "MCP protocol session ended"));
    owner.removeEventListener("abort", disconnected);
    router.disconnect.delete(disconnected);
  };
  const disconnected = () =>
    close({ reason: "disconnected", error: "MCP connection or session ended" });
  owner.addEventListener("abort", disconnected, { once: true });
  router.disconnect.add(disconnected);
  return {
    signal: controller.signal,
    watchNotifications(methods, onNotification) {
      if (
        !Array.isArray(methods) ||
        methods.length === 0 ||
        methods.length > 64
      )
        throw new Error("Declared notification methods are required");
      for (const method of methods) ensure(method, spec.notifications);
      if (typeof onNotification !== "function")
        throw new Error("A protocol notification handler is required");
      const release = pin(connection);
      let settle!: (end: McpProtocolEnd) => void;
      const closed = new Promise<McpProtocolEnd>((resolve) => {
        settle = resolve;
      });
      let finished = false;
      const finish = (end: McpProtocolEnd) => {
        if (finished) return;
        finished = true;
        router.watchers.delete(entry);
        active.delete(finish);
        release();
        settle(end);
      };
      const entry: Entry = {
        methods: new Set(methods),
        notify: onNotification,
        finish,
      };
      router.watchers.add(entry);
      active.add(finish);
      return { closed, close: () => finish({ reason: "cancelled" }) };
    },
    async request(method, params = {}, signal) {
      ensure(method, spec.requests);
      const copy = paramsCopy(params);
      const release = pin(connection);
      try {
        const z = await import("zod/v4");
        return await connection.client.request(
          { method, params: copy },
          z.record(z.string(), z.unknown()),
          {
            signal: signal
              ? AbortSignal.any([signal, controller.signal])
              : controller.signal,
          },
        );
      } finally {
        release();
      }
    },
    openStream(method, params, onNotification) {
      ensure(method, spec.streams);
      const copy = paramsCopy(params);
      if (typeof onNotification !== "function")
        throw new Error("A protocol notification handler is required");
      const id = `${router.prefix}${router.next++}`;
      const release = pin(connection);
      let settle!: (end: McpProtocolEnd) => void;
      const closed = new Promise<McpProtocolEnd>((resolve) => {
        settle = resolve;
      });
      let finished = false;
      let dispatched = false;
      const requestController = new AbortController();
      let cancellation: Promise<void> | undefined;
      const cancelWire = () =>
        (cancellation ??=
          router.closed ||
          !dispatched ||
          connection.transport.hasPerRequestStream
            ? Promise.resolve()
            : connection.client
                .notification({
                  method: "notifications/cancelled",
                  params: { requestId: id },
                })
                .catch(() => {}));
      const finish = (end: McpProtocolEnd) => {
        if (finished) return;
        finished = true;
        router.entries.delete(id);
        active.delete(finish);
        release();
        settle(end);
        requestController.abort();
        if (end.reason !== "ended") void cancelWire();
      };
      router.entries.set(id, {
        methods: new Set(spec.notifications),
        notify: onNotification,
        finish,
      });
      active.add(finish);
      // Defer sending until the caller has received the handle and installed its state.
      const sent = Promise.resolve().then(async () => {
        if (finished) return;
        const envelope = connection.requestMetadata?.();
        if (connection.client.getProtocolEra() === "modern" && !envelope)
          throw new Error("MCP client request metadata is unavailable");
        const meta = envelope ? { _meta: envelope } : {};
        dispatched = true;
        await connection.transport.send(
          {
            jsonrpc: "2.0",
            id,
            method,
            params: { ...copy, ...meta },
          },
          {
            requestSignal: requestController.signal,
            onRequestStreamEnd: () =>
              finish({
                reason: "disconnected",
                error: "MCP request stream ended without a final response",
              }),
          },
        );
      });
      void sent.catch((error) =>
        finish({ reason: "error", error: message(error) }),
      );
      return {
        id,
        sent,
        closed,
        async cancel() {
          finish({ reason: "cancelled" });
          await cancelWire();
        },
      };
    },
    close: () => close({ reason: "cancelled" }),
  };
}

interface ProtocolRequest {
  version: 1;
  definition: McpProtocolDefinition;
  result?: McpProtocol;
  error?: Error;
}
export function registerProtocolBridge(
  pi: ExtensionAPI,
  resolve: (
    name: string,
  ) => Promise<{ connection: ServerConnection; signal: AbortSignal }>,
): void {
  const registrations = new Set<string>();
  pi.events.on(MCP_PROTOCOL_EVENT, (raw: unknown) => {
    if (!record(raw) || raw.result !== undefined || raw.error !== undefined)
      return;
    const request = raw as ProtocolRequest;
    try {
      if (request.version !== 1)
        throw new Error("Invalid MCP protocol registration version");
      const definition = validate(request.definition);
      if (registrations.has(definition.namespace))
        throw new Error(
          `MCP protocol already registered: ${definition.namespace}`,
        );
      registrations.add(definition.namespace);
      let disposed = false;
      const sessions = new Set<McpProtocolSession>();
      request.result = {
        async connect(name) {
          if (disposed) throw new Error("MCP protocol registration disposed");
          if (typeof name !== "string" || !name.trim())
            throw new Error("MCP server name is required");
          const target = await resolve(name);
          if (disposed) throw new Error("MCP protocol registration disposed");
          const session = createProtocolSession(
            target.connection,
            target.signal,
            definition,
          );
          sessions.add(session);
          session.signal.addEventListener(
            "abort",
            () => sessions.delete(session),
            { once: true },
          );
          return session;
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          registrations.delete(definition.namespace);
          for (const session of sessions) session.close();
          sessions.clear();
        },
      };
    } catch (error) {
      request.error = error instanceof Error ? error : new Error(String(error));
    }
  });
}
export function registerMcpProtocol(
  pi: ExtensionAPI,
  definition: McpProtocolDefinition,
): McpProtocol {
  const request: ProtocolRequest = { version: 1, definition };
  pi.events.emit(MCP_PROTOCOL_EVENT, request);
  if (request.error) throw request.error;
  if (!request.result)
    throw new Error("pi-mcp-adapter does not expose protocol extensions");
  return request.result;
}

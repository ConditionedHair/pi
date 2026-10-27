# Protocol extensions

A companion Pi extension can implement an additional MCP protocol capability using the adapter's existing server configuration, authentication and connection lifecycle. Register the capability's methods, then explicitly request its operations. Registration does not connect or subscribe to servers.

```ts
import { registerMcpProtocol } from 'pi-mcp-adapter';

const protocol = registerMcpProtocol(pi, {
  namespace: 'example',
  requests: ['example/list'],
  streams: ['example/stream'],
  notifications: ['notifications/example/active', 'notifications/example/item', 'notifications/example/list_changed'],
});
const session = await protocol.connect('configured-server');
const watch = session.watchNotifications(['notifications/example/list_changed'], () => {
  // Invalidate the companion's catalog; re-fetch when needed.
});
const catalog = await session.request('example/list', {});
// Validate the capability-specific result before using it.
const stream = session.openStream('example/stream', { name: 'chosen-item' }, (method, params) => {
  // Validate and render this capability's notifications in the companion.
});
await stream.sent; // Written to the server, not necessarily acknowledged.
const end = await stream.closed; // cancelled, ended, error, or disconnected
// Alternatively: await stream.cancel();
watch.close();
session.close();
protocol.dispose(); // Close its sessions and unregister the namespace.
```

Call registration after the adapter has loaded (for example on first use); an unavailable hook throws an actionable error for the companion to handle. Only one registration may own a namespace per adapter. Namespaces and method declarations are copied at registration. Requests/streams must belong to that namespace; notifications must use `notifications/<namespace>/...`. Core namespaces such as `tools`, `resources`, and `subscriptions` are reserved and cannot be registered. Ordinary tool calls continue through the adapter's tool-call API and its approval handling.

This API exposes no SDK client, transport, arbitrary send method, or handler replacement. `request` accepts only declared request methods and returns an ordinary SDK request result. `openStream` accepts only declared stream methods and delivers only declared notifications correlated to that stream through `params._meta["io.modelcontextprotocol/subscriptionId"]`. Unrelated traffic continues to the SDK. The adapter allocates request IDs, sends cancellation, and reports remote results/errors, server cancellation, transport closure, and session replacement. Consumer exceptions terminate only that consumer's stream. Parameters cannot override reserved `_meta` fields.

An operation prevents idle cleanup only while its request, stream, or notification observer is active. Counts belong to the exact connection and never transfer during reconnect. Closing a protocol session or disposing its registration cancels its work without closing the shared MCP client. Consumers must observe `session.signal` or `stream.closed` and explicitly reconnect after a disconnection; there is no automatic subscription or replay. A stream's `sent` promise confirms transmission only: acknowledgement validation, activation timeouts, heartbeat policy, and any agent wakeup belong to the companion protocol implementation.

`watchNotifications(methods, handler)` observes only declared notification methods outside the adapter's extension streams, such as a capability's catalog-change notification. Each observer has `close()` and a `closed` promise with the same termination reasons as a stream. Notification parameters and method declarations are copied, observer failures close only that observer, and messages continue to the SDK. Stream-correlated messages belong to their stream handler and are not broadcast to observers. Watching is passive: it does not send a subscription request or create a remote notification channel. If a transport/server does not deliver catalog-change notifications, the companion must refresh its catalog through ordinary requests.

Stream JSON-RPC errors preserve their code, message, and optional data in `end.protocolError`, alongside the display string `end.error`. Ordinary requests retain the SDK's typed rejection. This lets companions distinguish authorization failure, unsupported operations, and transient failures without parsing display text.

An active Pi session and an enabled server in its effective configuration are required. Connection setup uses normal project trust, server approval, lazy connection, and runtime ownership checks. This is a trusted installed-extension API, not a sandbox for untrusted extension code. The method restrictions preserve the adapter's protocol and tool boundaries; they cannot constrain arbitrary code running in Pi's process. Companions own additional capability consent and payload validation, and should treat received content as external data.

The API works over every transport currently supported by the adapter: **stdio, Streamable HTTP, legacy HTTP+SSE, and Unix sockets**. The SDK provides ordinary custom requests and the underlying transport. Since it lacks a generic long-lived extension stream primitive, the adapter provides one internal router per transport. Streamable HTTP uses the SDK's per-request abort signal and stream-end callback; cancellation closes only that request's SSE response, preserving sibling streams and normal MCP requests. Shared-channel transports use `notifications/cancelled`. A request-stream EOF without a final response reports `disconnected`; the protocol session remains usable while its shared connection is alive. The SDK still owns HTTP headers, OAuth, TLS, and transport-level resumption. An MCP protocol cursor belongs to the companion and is separate from an SSE transport resumption token.

Companions can implement polling, streaming, and webhook subscription management using these same primitives. Poll and webhook control calls are ordinary declared requests; webhook receiving, signature verification, renewal, delivery selection, cursor/replay policy, and persistence belong to the companion. No webhook server or delivery loop is started by the adapter. A companion should reacquire a session after idle disconnection before its next scheduled request, and must stop retrying when its Pi session ends. WebSocket is not currently an adapter transport; this API adds no new network transport or server configuration.

Across independently loaded Pi packages, use the synchronous event bus `pi-mcp-adapter:protocol:v1` with `{version: 1, definition}`. The adapter sets `result` to the mediated protocol handle or `error` to a registration error; an absent result/error means the hook is unavailable. This is also how `registerMcpProtocol` works. A companion can use the structural contract without importing another adapter instance.

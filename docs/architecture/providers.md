# Provider architecture

The web app communicates with the server via WebSocket using a simple JSON-RPC-style protocol:

- **Request/Response**: `{ id, method, params }` → `{ id, result }` or `{ id, error }`
- **Push events**: typed envelopes with `channel`, `sequence` (monotonic per connection), and channel-specific `data`

Push channels: `server.welcome`, `server.configUpdated`, `terminal.event`, `orchestration.domainEvent`. Payloads are schema-validated at the transport boundary (`wsTransport.ts`). Decode failures produce structured `WsDecodeDiagnostic` with `code`, `reason`, and path info.

Methods mirror the `NativeApi` interface defined in `@t3tools/contracts`:

- `providers.startSession`, `providers.sendTurn`, `providers.interruptTurn`
- `providers.respondToRequest`, `providers.stopSession`
- `shell.openInEditor`, `server.getConfig`

Codex, Claude, Cursor, Grok, and OpenCode are implemented behind the shared
provider adapter boundary. See [Live runtime contract](./live-runtime-contract.md)
for cross-provider event identity, fixtures, and capability reporting.

## Runtime-owned capability inventory

Provider snapshots carry the capabilities a runtime reports about itself. Skills and slash commands
keep their invocation-shaped fields, while MCP servers, plugins, and future read-only capability
kinds use the open `reportedCapabilities` collection. Every reported item includes its runtime
source and one of four states: enabled, unavailable, misconfigured, or permission-restricted.

`reportedCapabilityKinds` distinguishes an empty runtime report from a runtime that does not expose
that inventory. Clients must show the latter as "Not reported by runtime" rather than claiming that
the user has no configuration. Capability inventory is read-only: T3 Code does not copy one
runtime's settings into another runtime. Web and mobile invocation surfaces also exclude items whose
reported state is not enabled.

Provider health and model discovery do not depend on optional capability inventory. Optional MCP or
plugin inventory is time-bounded per provider; when it is unavailable, the provider remains usable
and the omitted capability kind is treated as not reported by the runtime.

## Client transport

`wsTransport.ts` manages connection state: `connecting` → `open` → `reconnecting` → `closed` → `disposed`. Outbound requests are queued while disconnected and flushed on reconnect. Inbound pushes are decoded and validated at the boundary, then cached per channel. Subscribers can opt into `replayLatest` to receive the last push on subscribe.

## Server-side orchestration layers

Provider runtime events flow through queue-based workers:

1. **ProviderRuntimeIngestion** — consumes provider runtime streams, emits orchestration commands
2. **ProviderCommandReactor** — reacts to orchestration intent events, dispatches provider calls
3. **CheckpointReactor** — captures git checkpoints on turn start/complete, publishes runtime receipts

All three use `DrainableWorker` internally and expose `drain()` for deterministic test synchronization.

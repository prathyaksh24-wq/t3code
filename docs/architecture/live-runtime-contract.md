# Live runtime contract

The live runtime path has one shared contract from a client turn command to the
events rendered by clients:

1. `packages/client-runtime` assigns a `runId` and `traceId` before dispatching
   `thread.turn.start`.
2. `packages/contracts` validates those identifiers at the WebSocket boundary.
3. `ProviderCommandReactor` carries them into the selected provider adapter.
4. `ProviderService` attaches them to every event from that turn, including
   events emitted before an adapter returns its provider turn id.
5. `ProviderRuntimeIngestion` and `CheckpointReactor` preserve them while
   producing persisted orchestration events.
6. Web, desktop, and mobile consume the same typed orchestration stream.

Providers keep their native session and event protocols behind
`ProviderAdapter`. Adding a provider does not add another browser contract.

## Runtime capability reporting

Provider snapshots expose these runtime capabilities:

- session resume
- turn cancellation
- conversation rollback
- execution modes supported by the selected runtime

Each capability is either `supported` or `unsupported`. Unsupported capabilities
must include a non-empty reason. A client should disable the affected action and
show that reason instead of attempting the operation.

`executionModes` is an ordered list of the safety modes the adapter can send to
that runtime. Older snapshots without this field use the compatibility set;
new clients must filter composer controls from the selected instance's list and
must not infer support from a provider name. An empty reported list means the
runtime exposed no selectable access mode.

The capability value describes the installed adapter path. It does not imply that
all models, accounts, or remote environments have identical access.

## Cancellation and run safety

Cancellation is persisted as a turn fence before the provider adapter is
interrupted. Late provider deltas, tool output, plans, and completion events for
that fenced turn are retained only as an ignored-runtime activity; they cannot
mutate the conversation after the user stops it. If an adapter cannot interrupt
its turn, the reactor attempts to stop the provider session and records the
failure when both operations fail.

The server also enforces per-environment limits for concurrent runs, maximum
duration, reported token usage, and unanswered approval requests. Limits are
stored in server settings, have bounded defaults, and produce a terminal safety
activity when they stop a run. Approval rows persist a first-terminal outcome
(`approved`, `denied`, `cancelled`, `timed_out`, or `runtime_terminated`) so a
late provider callback cannot rewrite what the user saw.

## Runtime settings and credentials

Provider settings keep runtime configuration separate from the selected model and
execution mode. Sensitive environment values and provider configuration secrets
are written through the server secret store; `settings.json`, WebSocket payloads,
and ordinary client persistence contain only an empty value plus a redaction
marker. The server materializes the secret only at the adapter boundary. Settings
forms must preserve a redacted value until the user explicitly replaces or clears
it, and diagnostics must report the provider instance and setting key without the
secret.

## Deterministic fixtures

`@t3tools/contracts/testing/live-runtime` owns the success, cancellation, and
error fixtures used to qualify adapters. The fixtures are decoded by the provider
event schema and the resulting orchestration events are decoded by the same
thread-stream schema used by clients.

An adapter change that alters an externally visible event must update the shared
contract and fixtures together. Provider-specific test fixtures may cover extra
native behavior, but they do not replace the shared fixtures.

## Qualification checks

The minimum qualification sequence is:

1. Decode every shared fixture as a `ProviderRuntimeEvent`.
2. Run the fixture through the test adapter and the orchestration engine.
3. Verify the same run and trace ids on turn, session, activity, and checkpoint
   events.
4. Decode those persisted events as `OrchestrationThreadStreamItem`.
5. Run a gated smoke test against an installed provider runtime.

The installed Codex smoke test is gated by `CODEX_BINARY_PATH` so regular test
runs do not spend provider credits or depend on local credentials. Browser visual
QA remains a separate client check; the contract test proves the browser command
and response schemas without launching a browser.

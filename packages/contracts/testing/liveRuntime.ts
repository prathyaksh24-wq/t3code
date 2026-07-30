import {
  EventId,
  ProviderDriverKind,
  RunId,
  RuntimeItemId,
  ThreadId,
  TraceId,
  TurnId,
  type ProviderRuntimeEvent,
} from "../src/index.ts";

export const LIVE_RUNTIME_FIXTURE_IDS = {
  provider: ProviderDriverKind.make("codex"),
  threadId: ThreadId.make("fixture-thread"),
  turnId: TurnId.make("fixture-turn"),
  runId: RunId.make("fixture-run"),
  traceId: TraceId.make("fixture-trace"),
} as const;

const baseEvent = (eventId: string, createdAt: string) => ({
  eventId: EventId.make(eventId),
  provider: LIVE_RUNTIME_FIXTURE_IDS.provider,
  threadId: LIVE_RUNTIME_FIXTURE_IDS.threadId,
  turnId: LIVE_RUNTIME_FIXTURE_IDS.turnId,
  runId: LIVE_RUNTIME_FIXTURE_IDS.runId,
  traceId: LIVE_RUNTIME_FIXTURE_IDS.traceId,
  createdAt,
});

export const LIVE_RUNTIME_SUCCESS_FIXTURE = [
  {
    ...baseEvent("fixture-event-1", "2026-07-30T00:00:00.000Z"),
    type: "turn.started",
    payload: {},
  },
  {
    ...baseEvent("fixture-event-2", "2026-07-30T00:00:00.100Z"),
    type: "item.started",
    itemId: RuntimeItemId.make("fixture-file-change"),
    payload: {
      itemType: "file_change",
      status: "inProgress",
      title: "Update README",
      detail: "README.md",
    },
  },
  {
    ...baseEvent("fixture-event-3", "2026-07-30T00:00:00.200Z"),
    type: "item.completed",
    itemId: RuntimeItemId.make("fixture-file-change"),
    payload: {
      itemType: "file_change",
      status: "completed",
      title: "Update README",
      detail: "README.md",
    },
  },
  {
    ...baseEvent("fixture-event-4", "2026-07-30T00:00:00.300Z"),
    type: "content.delta",
    payload: {
      streamKind: "assistant_text",
      delta: "Updated README.\n",
    },
  },
  {
    ...baseEvent("fixture-event-5", "2026-07-30T00:00:00.400Z"),
    type: "turn.completed",
    payload: {
      state: "completed",
    },
  },
] satisfies ReadonlyArray<ProviderRuntimeEvent>;

export const LIVE_RUNTIME_CANCELLATION_FIXTURE = [
  {
    ...baseEvent("fixture-cancel-1", "2026-07-30T00:01:00.000Z"),
    type: "turn.started",
    payload: {},
  },
  {
    ...baseEvent("fixture-cancel-2", "2026-07-30T00:01:00.100Z"),
    type: "turn.aborted",
    payload: {
      reason: "Cancelled by user",
    },
  },
] satisfies ReadonlyArray<ProviderRuntimeEvent>;

export const LIVE_RUNTIME_ERROR_FIXTURE = [
  {
    ...baseEvent("fixture-error-1", "2026-07-30T00:02:00.000Z"),
    type: "turn.started",
    payload: {},
  },
  {
    ...baseEvent("fixture-error-2", "2026-07-30T00:02:00.100Z"),
    type: "runtime.error",
    payload: {
      message: "Fixture runtime failed",
      class: "provider_error",
    },
  },
  {
    ...baseEvent("fixture-error-3", "2026-07-30T00:02:00.200Z"),
    type: "turn.completed",
    payload: {
      state: "failed",
      errorMessage: "Fixture runtime failed",
    },
  },
] satisfies ReadonlyArray<ProviderRuntimeEvent>;

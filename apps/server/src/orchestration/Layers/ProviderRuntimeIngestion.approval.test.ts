import {
  EventId,
  ProviderDriverKind,
  RuntimeRequestId,
  ThreadId,
  type ProviderRuntimeEvent,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { runtimeEventToActivities } from "./ProviderRuntimeIngestion.ts";

describe("runtimeEventToActivities approval details", () => {
  it("preserves complete multiline command details", () => {
    const detail = `bun run release -- ${"long-argument ".repeat(20)}\nsecond line`;
    const event = {
      type: "request.opened",
      eventId: EventId.make("evt-request-opened"),
      provider: ProviderDriverKind.make("codex"),
      createdAt: "2026-07-18T00:00:00.000Z",
      threadId: ThreadId.make("thread-1"),
      requestId: RuntimeRequestId.make("approval-1"),
      payload: {
        requestType: "command_execution_approval",
        detail,
      },
    } satisfies ProviderRuntimeEvent;

    const [activity] = runtimeEventToActivities(event);

    expect(activity?.kind).toBe("approval.requested");
    expect((activity?.payload as Record<string, unknown> | undefined)?.detail).toBe(detail);
  });

  it("records a stable outcome for approval resolutions", () => {
    const event = {
      type: "request.resolved",
      eventId: EventId.make("evt-request-resolved"),
      provider: ProviderDriverKind.make("codex"),
      createdAt: "2026-07-18T00:00:01.000Z",
      threadId: ThreadId.make("thread-1"),
      requestId: RuntimeRequestId.make("approval-1"),
      payload: {
        requestType: "command_execution_approval",
        decision: "acceptForSession",
      },
    } satisfies ProviderRuntimeEvent;

    const [activity] = runtimeEventToActivities(event);

    expect(activity?.kind).toBe("approval.resolved");
    expect((activity?.payload as Record<string, unknown> | undefined)?.outcome).toBe("approved");
  });

  it("records failed and cancelled turn termination outcomes", () => {
    const failedEvent = {
      type: "turn.completed",
      eventId: EventId.make("evt-turn-failed"),
      provider: ProviderDriverKind.make("codex"),
      createdAt: "2026-07-18T00:00:02.000Z",
      threadId: ThreadId.make("thread-1"),
      payload: {
        state: "failed",
        errorMessage: "provider stopped",
      },
    } satisfies ProviderRuntimeEvent;
    const cancelledEvent = {
      type: "turn.aborted",
      eventId: EventId.make("evt-turn-cancelled"),
      provider: ProviderDriverKind.make("codex"),
      createdAt: "2026-07-18T00:00:03.000Z",
      threadId: ThreadId.make("thread-1"),
      payload: {
        reason: "user cancelled",
      },
    } satisfies ProviderRuntimeEvent;

    const [failedActivity] = runtimeEventToActivities(failedEvent);
    const [cancelledActivity] = runtimeEventToActivities(cancelledEvent);

    expect(failedActivity?.kind).toBe("turn.terminated");
    expect((failedActivity?.payload as Record<string, unknown> | undefined)?.outcome).toBe(
      "runtime_terminated",
    );
    expect((cancelledActivity?.payload as Record<string, unknown> | undefined)?.outcome).toBe(
      "cancelled",
    );
  });
});

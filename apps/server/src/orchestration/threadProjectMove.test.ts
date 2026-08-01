import {
  CheckpointRef,
  CommandId,
  EventId,
  MessageId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  TurnId,
  type OrchestrationEvent,
  type OrchestrationReadModel,
  type OrchestrationSession,
} from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { decideOrchestrationCommand } from "./decider.ts";
import { projectEvent } from "./projector.ts";

const NOW = "2026-08-01T00:00:00.000Z";
const LATER = "2026-08-01T00:01:00.000Z";
const THREAD_ID = ThreadId.make("thread-project-move");
const SOURCE_PROJECT_ID = ProjectId.make("project-source");
const TARGET_PROJECT_ID = ProjectId.make("project-target");

function makeSession(status: OrchestrationSession["status"]): OrchestrationSession {
  return {
    threadId: THREAD_ID,
    status,
    providerName: "Codex",
    runtimeMode: "full-access",
    activeTurnId: null,
    lastError: null,
    updatedAt: NOW,
  };
}

function makeReadModel(session: OrchestrationSession | null = makeSession("stopped")) {
  return {
    snapshotSequence: 4,
    projects: [SOURCE_PROJECT_ID, TARGET_PROJECT_ID].map((id) => ({
      id,
      title: id === SOURCE_PROJECT_ID ? "Source" : "Target",
      workspaceRoot: id === SOURCE_PROJECT_ID ? "D:/source" : "D:/target",
      defaultModelSelection: null,
      scripts: [],
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    })),
    threads: [
      {
        id: THREAD_ID,
        projectId: SOURCE_PROJECT_ID,
        title: "Move me",
        modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.6" },
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: "feature/source",
        worktreePath: "D:/worktrees/source",
        latestTurn: null,
        createdAt: NOW,
        updatedAt: NOW,
        archivedAt: null,
        settledOverride: null,
        settledAt: null,
        deletedAt: null,
        messages: [
          {
            id: MessageId.make("message-before-move"),
            role: "user",
            text: "Keep this conversation",
            turnId: TurnId.make("turn-before-move"),
            streaming: false,
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
        proposedPlans: [],
        activities: [],
        checkpoints: [
          {
            turnId: TurnId.make("turn-before-move"),
            checkpointTurnCount: 1,
            checkpointRef: CheckpointRef.make("refs/t3/checkpoint/one"),
            status: "ready",
            files: [],
            assistantMessageId: null,
            completedAt: NOW,
          },
        ],
        session,
      },
    ],
    updatedAt: NOW,
  } satisfies OrchestrationReadModel;
}

function makeMoveEvent(): OrchestrationEvent {
  return {
    sequence: 5,
    eventId: EventId.make("event-project-moved"),
    type: "thread.project-moved",
    aggregateKind: "thread",
    aggregateId: THREAD_ID,
    occurredAt: LATER,
    commandId: CommandId.make("command-project-move"),
    causationEventId: null,
    correlationId: null,
    metadata: {},
    payload: {
      threadId: THREAD_ID,
      previousProjectId: SOURCE_PROJECT_ID,
      projectId: TARGET_PROJECT_ID,
      updatedAt: LATER,
    },
  };
}

it.layer(NodeServices.layer)("thread project move", (it) => {
  it.effect("emits the old and new project ids for an idle thread", () =>
    Effect.gen(function* () {
      const event = yield* decideOrchestrationCommand({
        command: {
          type: "thread.project.move",
          commandId: CommandId.make("command-project-move"),
          threadId: THREAD_ID,
          projectId: TARGET_PROJECT_ID,
          createdAt: LATER,
        },
        readModel: makeReadModel(),
      });

      const events = Array.isArray(event) ? event : [event];
      expect(events).toHaveLength(1);
      if (events[0]?.type === "thread.project-moved") {
        expect(events[0].payload.previousProjectId).toBe(SOURCE_PROJECT_ID);
        expect(events[0].payload.projectId).toBe(TARGET_PROJECT_ID);
      }
    }),
  );

  it.effect("rejects a move while the provider session is live", () =>
    Effect.gen(function* () {
      const error = yield* decideOrchestrationCommand({
        command: {
          type: "thread.project.move",
          commandId: CommandId.make("command-project-move-running"),
          threadId: THREAD_ID,
          projectId: TARGET_PROJECT_ID,
          createdAt: LATER,
        },
        readModel: makeReadModel(makeSession("running")),
      }).pipe(Effect.flip);

      expect(error._tag).toBe("OrchestrationCommandInvariantError");
    }),
  );
});

it.effect("moving a thread preserves messages and clears workspace-bound state", () =>
  Effect.gen(function* () {
    const next = yield* projectEvent(makeReadModel(), makeMoveEvent());
    const thread = next.threads[0];

    expect(thread?.projectId).toBe(TARGET_PROJECT_ID);
    expect(thread?.messages.map((message) => message.text)).toEqual(["Keep this conversation"]);
    expect(thread?.branch).toBeNull();
    expect(thread?.worktreePath).toBeNull();
    expect(thread?.checkpoints).toEqual([]);
    expect(thread?.session).toBeNull();
    expect(thread?.updatedAt).toBe(LATER);
  }),
);

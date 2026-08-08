import { it, describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";

import * as WorkspaceMutationGuard from "./WorkspaceMutationGuard.ts";

const workspacePath = process.cwd();

it.layer(WorkspaceMutationGuard.layer, { excludeTestServices: true })(
  "WorkspaceMutationGuard",
  (it) => {
    describe("workspace claims", () => {
      it.effect("rejects a second thread from the same physical workspace", () =>
        Effect.gen(function* () {
          const guard = yield* WorkspaceMutationGuard.WorkspaceMutationGuard;
          yield* guard.acquire({
            workspacePath,
            threadId: "thread-owner",
            operation: "provider-turn",
          });

          const error = yield* guard
            .acquire({
              workspacePath,
              threadId: "thread-requester",
              operation: "provider-turn",
            })
            .pipe(Effect.flip);

          expect(error).toBeInstanceOf(WorkspaceMutationGuard.WorkspaceMutationConflictError);
          expect(error.ownerThreadId).toBe("thread-owner");
          expect(error.requestingThreadId).toBe("thread-requester");
          expect(error.message).toContain("Stop that run or use a different worktree");
        }),
      );

      it.effect("allows reentrant claims and releases the workspace for another thread", () =>
        Effect.gen(function* () {
          const guard = yield* WorkspaceMutationGuard.WorkspaceMutationGuard;
          yield* guard.acquire({
            workspacePath,
            threadId: "thread-owner",
            operation: "provider-turn",
          });
          yield* guard.acquire({
            workspacePath,
            threadId: "thread-owner",
            operation: "provider-turn",
          });
          yield* guard.release({ workspacePath, threadId: "thread-owner" });

          const lease = yield* guard.acquire({
            workspacePath,
            threadId: "thread-next",
            operation: "provider-turn",
          });
          expect(lease.workspacePath).toBeTruthy();
        }),
      );
    });
  },
);

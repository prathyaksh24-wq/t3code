// @effect-diagnostics nodeBuiltinImport:off
/**
 * Serializes provider-owned mutations for a physical workspace.
 *
 * A project can have several threads, and the UI intentionally lets those
 * threads remain open at the same time. They must not, however, run writable
 * provider turns against the same checkout concurrently. The guard is an
 * in-process lease registry; provider turns release their lease when the
 * runtime reports a terminal lifecycle event.
 */
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import { HostProcessPlatform } from "@t3tools/shared/hostProcess";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

export const WorkspaceMutationOperation = Schema.Literals([
  "provider-turn",
  "file-write",
  "terminal-session",
]);
export type WorkspaceMutationOperation = typeof WorkspaceMutationOperation.Type;

export class WorkspaceMutationConflictError extends Schema.TaggedErrorClass<WorkspaceMutationConflictError>()(
  "WorkspaceMutationConflictError",
  {
    workspacePath: Schema.String,
    ownerThreadId: Schema.String,
    requestingThreadId: Schema.String,
    operation: WorkspaceMutationOperation,
  },
) {
  override get message(): string {
    return `Workspace '${this.workspacePath}' is already being modified by thread '${this.ownerThreadId}'. Stop that run or use a different worktree before starting '${this.operation}' for thread '${this.requestingThreadId}'.`;
  }
}

export interface WorkspaceMutationLeaseInput {
  readonly workspacePath: string;
  readonly threadId: string;
  readonly operation: WorkspaceMutationOperation;
}

export interface WorkspaceMutationGuardShape {
  /** Claim a physical workspace for a thread. Same-thread claims are reentrant. */
  readonly acquire: (
    input: WorkspaceMutationLeaseInput,
  ) => Effect.Effect<{ readonly workspacePath: string }, WorkspaceMutationConflictError>;
  /** Release the workspace claim owned by a thread. Unknown or stale releases are no-ops. */
  readonly release: (input: {
    readonly workspacePath: string;
    readonly threadId: string;
  }) => Effect.Effect<void>;
}

function normalizeWorkspacePath(value: string, platform: NodeJS.Platform): string {
  const normalized = NodePath.normalize(NodePath.resolve(value));
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}

const canonicalizeWorkspacePath = Effect.fn("canonicalizeWorkspacePath")(function* (
  workspacePath: string,
) {
  const platform = yield* HostProcessPlatform;
  const resolvedPath = yield* Effect.tryPromise({
    try: () => NodeFSP.realpath(workspacePath),
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => workspacePath));
  return normalizeWorkspacePath(resolvedPath, platform);
});

export class WorkspaceMutationGuard extends Context.Service<
  WorkspaceMutationGuard,
  WorkspaceMutationGuardShape
>()("t3/workspace/WorkspaceMutationGuard") {}

const make = Effect.sync(() => {
  const claims = new Map<
    string,
    { readonly threadId: string; readonly operation: WorkspaceMutationOperation }
  >();

  const acquire: WorkspaceMutationGuardShape["acquire"] = Effect.fn(
    "WorkspaceMutationGuard.acquire",
  )(function* (input) {
    const workspacePath = yield* canonicalizeWorkspacePath(input.workspacePath);
    const current = claims.get(workspacePath);
    if (current && current.threadId !== input.threadId) {
      return yield* new WorkspaceMutationConflictError({
        workspacePath,
        ownerThreadId: current.threadId,
        requestingThreadId: input.threadId,
        operation: input.operation,
      });
    }

    claims.set(workspacePath, {
      threadId: input.threadId,
      operation: input.operation,
    });
    return { workspacePath };
  });

  const release: WorkspaceMutationGuardShape["release"] = Effect.fn(
    "WorkspaceMutationGuard.release",
  )(function* (input) {
    const workspacePath = yield* canonicalizeWorkspacePath(input.workspacePath);
    const current = claims.get(workspacePath);
    if (!current || current.threadId !== input.threadId) {
      return;
    }
    claims.delete(workspacePath);
  });

  return WorkspaceMutationGuard.of({ acquire, release });
});

export const layer = Layer.effect(WorkspaceMutationGuard, make);

import { TrimmedNonEmptyString } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";

import { writeFileStringAtomically } from "./atomicWrite.ts";

export const ProductDataScopeId = TrimmedNonEmptyString.check(
  Schema.isMaxLength(64),
  Schema.isPattern(/^[a-z0-9][a-z0-9._-]*$/i),
);
export type ProductDataScopeId = typeof ProductDataScopeId.Type;

export const ProductDataScopeDocument = Schema.Struct({
  version: Schema.Literal(1),
  ownerId: ProductDataScopeId,
  workspaceId: ProductDataScopeId,
});
export type ProductDataScopeDocument = typeof ProductDataScopeDocument.Type;

export class ProductDataScopeReadError extends Schema.TaggedErrorClass<ProductDataScopeReadError>()(
  "ProductDataScopeReadError",
  {
    filePath: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to read the product data scope at ${this.filePath}.`;
  }
}

export class ProductDataScopeDecodeError extends Schema.TaggedErrorClass<ProductDataScopeDecodeError>()(
  "ProductDataScopeDecodeError",
  {
    filePath: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `The product data scope at ${this.filePath} is invalid.`;
  }
}

export class ProductDataScopePersistError extends Schema.TaggedErrorClass<ProductDataScopePersistError>()(
  "ProductDataScopePersistError",
  {
    filePath: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to persist the product data scope at ${this.filePath}.`;
  }
}

export class ProductDataScopeConflictError extends Schema.TaggedErrorClass<ProductDataScopeConflictError>()(
  "ProductDataScopeConflictError",
  {
    filePath: Schema.String,
    expectedOwnerId: ProductDataScopeId,
    expectedWorkspaceId: ProductDataScopeId,
    actualOwnerId: ProductDataScopeId,
    actualWorkspaceId: ProductDataScopeId,
  },
) {
  override get message(): string {
    return `The product data scope at ${this.filePath} belongs to another owner or workspace.`;
  }
}

const decodeProductDataScope = Schema.decodeUnknownEffect(
  Schema.fromJsonString(ProductDataScopeDocument),
);
const encodeProductDataScope = Schema.encodeEffect(Schema.fromJsonString(ProductDataScopeDocument));

export const ensureProductDataScope = Effect.fn("ensureProductDataScope")(function* (input: {
  readonly filePath: string;
  readonly ownerId: ProductDataScopeId;
  readonly workspaceId: ProductDataScopeId;
}) {
  const fs = yield* FileSystem.FileSystem;
  const requestedScope: ProductDataScopeDocument = {
    version: 1,
    ownerId: input.ownerId,
    workspaceId: input.workspaceId,
  };

  const persistedContents = yield* fs.readFileString(input.filePath).pipe(
    Effect.matchEffect({
      onFailure: (cause) =>
        cause.reason._tag === "NotFound"
          ? Effect.void
          : Effect.fail(
              new ProductDataScopeReadError({
                filePath: input.filePath,
                cause,
              }),
            ),
      onSuccess: Effect.succeed,
    }),
  );

  if (persistedContents === undefined) {
    const encoded = yield* encodeProductDataScope(requestedScope).pipe(Effect.orDie);
    yield* writeFileStringAtomically({
      filePath: input.filePath,
      contents: `${encoded}\n`,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new ProductDataScopePersistError({
            filePath: input.filePath,
            cause,
          }),
      ),
    );
    return requestedScope;
  }

  const persistedScope = yield* decodeProductDataScope(persistedContents.trim()).pipe(
    Effect.mapError(
      (cause) =>
        new ProductDataScopeDecodeError({
          filePath: input.filePath,
          cause,
        }),
    ),
  );

  if (
    persistedScope.ownerId !== requestedScope.ownerId ||
    persistedScope.workspaceId !== requestedScope.workspaceId
  ) {
    return yield* new ProductDataScopeConflictError({
      filePath: input.filePath,
      expectedOwnerId: requestedScope.ownerId,
      expectedWorkspaceId: requestedScope.workspaceId,
      actualOwnerId: persistedScope.ownerId,
      actualWorkspaceId: persistedScope.workspaceId,
    });
  }

  return persistedScope;
});

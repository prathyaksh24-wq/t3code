import { expect, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import {
  ensureProductDataScope,
  ProductDataScopeDocument,
  ProductDataScopeConflictError,
  ProductDataScopeDecodeError,
} from "./productData.ts";

const decodeProductDataScope = Schema.decodeUnknownEffect(
  Schema.fromJsonString(ProductDataScopeDocument),
);

it.layer(NodeServices.layer)("product data scope", (it) => {
  it.effect("creates a versioned scope manifest and reuses it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-product-data-" });
      const filePath = path.join(baseDir, "data-scope.json");

      const created = yield* ensureProductDataScope({
        filePath,
        ownerId: "local",
        workspaceId: "default",
      });
      const reused = yield* ensureProductDataScope({
        filePath,
        ownerId: "local",
        workspaceId: "default",
      });
      const persisted = yield* fs
        .readFileString(filePath)
        .pipe(Effect.flatMap((contents) => decodeProductDataScope(contents.trim())));

      expect(created).toEqual({
        version: 1,
        ownerId: "local",
        workspaceId: "default",
      });
      expect(reused).toEqual(created);
      expect(persisted).toEqual(created);
    }),
  );

  it.effect("refuses to reassign an existing root", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-product-data-conflict-" });
      const filePath = path.join(baseDir, "data-scope.json");

      yield* ensureProductDataScope({
        filePath,
        ownerId: "owner-one",
        workspaceId: "workspace-one",
      });
      const error = yield* ensureProductDataScope({
        filePath,
        ownerId: "owner-two",
        workspaceId: "workspace-two",
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(ProductDataScopeConflictError);
      expect(error).toMatchObject({
        actualOwnerId: "owner-one",
        actualWorkspaceId: "workspace-one",
        expectedOwnerId: "owner-two",
        expectedWorkspaceId: "workspace-two",
      });
    }),
  );

  it.effect("reports an invalid existing manifest instead of replacing it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-product-data-invalid-" });
      const filePath = path.join(baseDir, "data-scope.json");
      yield* fs.writeFileString(filePath, '{"version":2}\n');

      const error = yield* ensureProductDataScope({
        filePath,
        ownerId: "local",
        workspaceId: "default",
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(ProductDataScopeDecodeError);
    }),
  );
});

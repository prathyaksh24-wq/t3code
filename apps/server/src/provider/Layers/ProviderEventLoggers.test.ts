import { expect, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { makeProviderEventLoggers, NoOpProviderEventLoggers } from "./ProviderEventLoggers.ts";

it.layer(NodeServices.layer)("provider event loggers", (it) => {
  it.effect("does not create content-bearing loggers by default", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-provider-logging-off-" });
      const providerEventLogPath = path.join(baseDir, "provider", "events.log");

      const loggers = yield* makeProviderEventLoggers({
        enabled: false,
        providerEventLogPath,
      });

      expect(loggers).toBe(NoOpProviderEventLoggers);
      expect(yield* fs.exists(path.dirname(providerEventLogPath))).toBe(false);
    }),
  );

  it.effect("constructs both streams after an explicit opt-in", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-provider-logging-on-" });
      const providerEventLogPath = path.join(baseDir, "provider", "events.log");

      const loggers = yield* makeProviderEventLoggers({
        enabled: true,
        providerEventLogPath,
      });

      expect(loggers.native?.filePath).toBe(providerEventLogPath);
      expect(loggers.canonical?.filePath).toBe(providerEventLogPath);
      expect(yield* fs.exists(path.dirname(providerEventLogPath))).toBe(true);

      if (loggers.native) {
        yield* loggers.native.close();
      }
      if (loggers.canonical) {
        yield* loggers.canonical.close();
      }
    }),
  );
});

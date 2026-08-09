// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeSqlite from "node:sqlite";

import { seedShowcaseEnvironment } from "./mobile-showcase-environment.ts";

function readBaseDir(argv: ReadonlyArray<string>): string {
  const index = argv.indexOf("--base-dir");
  const value = index >= 0 ? argv[index + 1]?.trim() : undefined;
  if (!value || !argv.includes("--isolated-fixture")) {
    throw new Error(
      "Usage: node scripts/seed-web-beta-environment.ts --base-dir <path> --isolated-fixture",
    );
  }
  return NodePath.resolve(value);
}

const baseDir = readBaseDir(process.argv.slice(2));
const databasePath = NodePath.join(baseDir, "userdata", "state.sqlite");
if (!NodeFS.existsSync(databasePath)) {
  throw new Error(
    "Start the isolated T3 server and wait for migrations before seeding beta state.",
  );
}

const database = new NodeSqlite.DatabaseSync(databasePath, { readOnly: true });
const projectIds = database
  .prepare("SELECT project_id FROM projection_projects ORDER BY project_id")
  .all()
  .map((row) => {
    const projectId = row.project_id;
    if (typeof projectId !== "string") {
      throw new Error("The isolated beta database returned an invalid project ID.");
    }
    return projectId;
  });
const threadCountValue = database
  .prepare("SELECT COUNT(*) AS count FROM projection_threads")
  .get()?.count;
database.close();
if (typeof threadCountValue !== "number") {
  throw new Error("The isolated beta database returned an invalid thread count.");
}
const containsOnlyBootstrapWorkspace =
  projectIds.length === 0 || (projectIds.length === 1 && projectIds[0] === "t3-general-chats");
if (!containsOnlyBootstrapWorkspace || threadCountValue > 0) {
  throw new Error(
    `Refusing to replace ${String(projectIds.length)} existing projects and ${String(threadCountValue)} threads.`,
  );
}

const seeded = await seedShowcaseEnvironment({ baseDir });
process.stdout.write(`${JSON.stringify({ ok: true, ...seeded }, null, 2)}\n`);

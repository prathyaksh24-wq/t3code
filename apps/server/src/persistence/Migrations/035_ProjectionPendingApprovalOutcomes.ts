import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_pending_approvals)
  `;

  if (!columns.some((column) => column.name === "outcome")) {
    yield* sql`
      ALTER TABLE projection_pending_approvals
      ADD COLUMN outcome TEXT
    `;
  }
});

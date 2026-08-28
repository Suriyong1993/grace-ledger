// One-off smoke test: boot a real PostgreSQL 17 instance via embedded binaries,
// verify a connection works, then stop and clean up.
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import pg from "pg";

const dataDir = path.join(os.tmpdir(), `gl-pg-smoke-${Date.now()}`);
fs.mkdirSync(dataDir, { recursive: true });

const pgInstance = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 54399,
  persistent: false,
});

try {
  await pgInstance.initialise();
  await pgInstance.start();
  const client = new pg.Client({
    host: "127.0.0.1",
    port: 54399,
    user: "postgres",
    password: "postgres",
    database: "postgres",
  });
  await client.connect();
  const res = await client.query("SELECT version() AS v");
  console.log("CONNECTED:", res.rows[0].v);
  await client.end();
  console.log("SMOKE OK");
} finally {
  try {
    await pgInstance.stop();
  } catch (e) {
    console.error("stop error (non-fatal):", e.message);
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
}

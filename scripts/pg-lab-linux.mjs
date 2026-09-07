// Grace Ledger — real-PostgreSQL lab harness for Linux/CI (no Docker).
//
// scripts/pg-lab.mjs does the same job on Windows, where PostgreSQL refuses to
// run under an administrative token and therefore needs a dedicated local
// account and a temporary Windows service. None of that applies here, but the
// *database* semantics must not diverge between the two, so the Supabase shim,
// the grants and the asUser() role/JWT handling below are kept identical to
// that file. Only boot and teardown differ: initdb into a temp dir, listen on
// a unix socket, delete the directory on stop.
//
// TEST-ONLY: a fresh data directory per boot, no persistence between runs, no
// connection to any Supabase project and no production data.

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import pg from "pg";

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.dirname(
  fileURLToPath(new URL("../package.json", import.meta.url)),
);
const BIN = path.join(
  REPO_ROOT,
  "node_modules",
  "@embedded-postgres",
  "linux-x64",
  "native",
  "bin",
);

export const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");

/** True when the embedded PostgreSQL binaries can actually run on this host. */
export async function pgLabAvailable() {
  try {
    await execFileAsync(path.join(BIN, "postgres"), ["--version"]);
    return true;
  } catch {
    return false;
  }
}

async function applySqlFile(client, file) {
  const sql = fs.readFileSync(file, "utf8");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`Failed applying ${path.basename(file)}: ${err.message}`);
  }
}

/** SQL that stands in for the Supabase platform environment on vanilla Postgres. */
const SUPABASE_SHIM_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;

-- On the platform, auth.uid() yields NULL when there is no JWT. A bare
-- ''::jsonb cast instead raises "invalid input syntax for type json", which
-- would surface as a spurious failure on any statement run outside asUser()
-- (including cleanup between tests) rather than as the UNAUTHORIZED the
-- functions are written to return. Parse defensively so "no claims" means
-- NULL here exactly as it does in production.
CREATE OR REPLACE FUNCTION auth.jwt_claims() RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE raw text;
BEGIN
  raw := current_setting('request.jwt.claims', true);
  IF raw IS NULL OR raw = '' THEN RETURN NULL; END IF;
  RETURN raw::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(auth.jwt_claims() ->> 'sub', '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(auth.jwt_claims() ->> 'role', ''), 'anon')
$$;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
`;

/** Table/sequence privileges mirroring Supabase platform defaults. */
const GRANTS_SQL = `
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
`;

export class PgLabLinux {
  constructor() {
    this.root = null;
    this.datadir = null;
    this.client = null;
    this.started = false;
    this.migrationsApplied = [];
  }

  /** Boot the lab and apply every migration in supabase/migrations, in filename order. */
  async start({ migrationsDir } = {}) {
    this.root = fs.mkdtempSync(path.join(os.tmpdir(), "gl-pglab-"));
    this.datadir = path.join(this.root, "data");
    const pwfile = path.join(this.root, "pw");
    fs.writeFileSync(pwfile, "labpw");

    await execFileAsync(path.join(BIN, "initdb"), [
      "-D", this.datadir,
      "-U", "postgres",
      `--pwfile=${pwfile}`,
      "-A", "trust",
      "--no-sync",
    ]);

    // Unix socket only: nothing is exposed on TCP.
    await execFileAsync(path.join(BIN, "pg_ctl"), [
      "-D", this.datadir,
      "-o", `-k ${this.root} -c listen_addresses='' -c fsync=off`,
      "-l", path.join(this.root, "log"),
      "-w",
      "start",
    ]);
    this.started = true;

    this.client = await this.openRawClient();
    await this.client.query(SUPABASE_SHIM_SQL);

    const dir = migrationsDir ?? MIGRATIONS_DIR;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      await applySqlFile(this.client, path.join(dir, file));
    }
    await this.client.query(GRANTS_SQL);
    this.migrationsApplied = files;
    return this;
  }

  async openRawClient() {
    const client = new pg.Client({
      host: this.root,
      user: "postgres",
      database: "postgres",
    });
    await client.connect();
    return client;
  }

  /**
   * Run a query as a simulated authenticated Supabase user.
   *
   * SET ROLE is what makes RLS apply: as the superuser-owned `postgres` role
   * every policy is bypassed, so a test that forgets this proves nothing.
   */
  async asUser(userId, role, fn, client = this.client) {
    const jwt = JSON.stringify({ sub: userId, role: role ?? "authenticated" });
    await client.query("SELECT set_config('request.jwt.claims', $1, false)", [jwt]);
    await client.query(
      `SET ROLE ${role === "service_role" ? "service_role" : "authenticated"}`,
    );
    try {
      return await fn(client);
    } finally {
      await client.query("RESET ROLE");
      await client.query("SELECT set_config('request.jwt.claims', '', false)");
    }
  }

  async stop() {
    if (this.client) {
      try {
        await this.client.end();
      } catch {
        /* already closed */
      }
      this.client = null;
    }
    if (this.started) {
      try {
        await execFileAsync(path.join(BIN, "pg_ctl"), [
          "-D", this.datadir, "-m", "immediate", "-w", "stop",
        ]);
      } catch {
        /* already down */
      }
      this.started = false;
    }
    if (this.root) {
      fs.rmSync(this.root, { recursive: true, force: true });
      this.root = null;
    }
  }
}

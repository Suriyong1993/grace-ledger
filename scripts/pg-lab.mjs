// Grace Ledger — real-PostgreSQL lab harness (no Docker, no production access).
//
// Boots a throwaway PostgreSQL 17 instance on this machine using the
// @embedded-postgres/windows-x64 binaries. PostgreSQL refuses to run under an
// administrative token, so the server runs as a dedicated unprivileged local
// account via a temporary Windows service. Everything is torn down on stop().
//
// This is a TEST-ONLY lab: a fresh data directory per boot, no persistence
// between runs, and no connection to any Supabase project.

import { execFile } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import pg from "pg";

const execFileAsync = promisify(execFile);

const LAB_USER = "gl_pg_lab_runner";
const LAB_PASSWORD = "GLpg#Lab2026x";
const LAB_SERVICE = "gl_pg_lab";
const LAB_ROOT = path.join(process.env.ProgramData ?? "C:\\ProgramData", "gl_pg_lab");
const NATIVE_SRC = path.join(
  path.dirname(fileURLToPath(new URL("../package.json", import.meta.url))),
  "node_modules", "@embedded-postgres", "windows-x64", "native",
);

function run(file, args, opts = {}) {
  return execFileAsync(file, args, { windowsHide: true, ...opts });
}

async function runOk(file, args, opts = {}) {
  try {
    await run(file, args, opts);
    return true;
  } catch {
    return false;
  }
}

/** robocopy reports success with exit codes 0-7 (1 = files copied). */
async function robocopy(src, dst) {
  try {
    await run("robocopy", [src, dst, "/E", "/NFL", "/NDL", "/NJH", "/NJS"]);
  } catch (err) {
    const code = err.code ?? -1;
    if (code < 0 || code > 7) throw err;
  }
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = await new Promise((resolve) => {
      const s = net.connect({ host: "127.0.0.1", port });
      s.once("connect", () => { s.destroy(); resolve(true); });
      s.once("error", () => resolve(false));
      setTimeout(() => { s.destroy(); resolve(false); }, 1500);
    });
    if (open) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Postgres did not accept connections on port ${port} within ${timeoutMs}ms`);
}

async function cleanupLeftovers() {
  await runOk("net", ["stop", LAB_SERVICE]);
  await runOk("sc", ["delete", LAB_SERVICE]);
  await runOk("net", ["user", LAB_USER, "/delete"]);
  fs.rmSync(path.join(LAB_ROOT, "data"), { recursive: true, force: true });
  fs.rmSync(path.join(os.tmpdir(), "gl_pg_lab_pwfile"), { force: true });
}

async function ensureLabUser() {
  const exists = await runOk("net", ["user", LAB_USER]);
  if (!exists) {
    await run("net", ["user", LAB_USER, LAB_PASSWORD, "/add", "/passwordchg:no", "/active:yes"]);
  } else {
    // Keep the known password in force so the service can always log on.
    await runOk("net", ["user", LAB_USER, LAB_PASSWORD]);
  }
  // Per-user services need the "Log on as a service" right; pg_ctl register
  // does not grant it, so grant it explicitly via the LSA API.
  const grantScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "grant-logon-as-service.ps1");
  await run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", grantScript, "-AccountName", `.\\${LAB_USER}`]);
}

async function ensureBinaries() {
  const dst = path.join(LAB_ROOT, "native");
  const marker = path.join(dst, ".hydrated");
  if (fs.existsSync(marker)) return dst;
  fs.mkdirSync(dst, { recursive: true });
  for (const part of ["bin", "lib", "share"]) {
    await robocopy(path.join(NATIVE_SRC, part), path.join(dst, part));
  }
  fs.writeFileSync(marker, new Date().toISOString());
  return dst;
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

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'role', ''), 'anon')
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

export class PgLab {
  constructor() {
    this.port = null;
    this.client = null;
    this.datadir = null;
    this.started = false;
  }

  /** Boot the lab and apply every migration in supabase/migrations, in filename order. */
  async start({ migrationsDir } = {}) {
    await cleanupLeftovers();
    this.port = await freePort();

    fs.mkdirSync(LAB_ROOT, { recursive: true });
    await ensureLabUser();
    const nativeDir = await ensureBinaries();

    this.datadir = path.join(LAB_ROOT, "data");
    fs.mkdirSync(this.datadir, { recursive: true });

    const pwfile = path.join(os.tmpdir(), "gl_pg_lab_pwfile");
    fs.writeFileSync(pwfile, LAB_PASSWORD, "utf8");
    try {
      await run(path.join(nativeDir, "bin", "initdb.exe"), [
        "-D", this.datadir,
        "-U", "postgres",
        "-A", "password",
        "--pwfile", pwfile,
        "-E", "UTF8",
        "--locale=C",
      ]);
    } finally {
      fs.rmSync(pwfile, { force: true });
    }

    // The server process runs as the lab user: give it exclusive access to the
    // data directory (PostgreSQL also rejects world/group-accessible datadirs).
    await run("icacls", [
      this.datadir, "/inheritance:r",
      "/grant:r", `${LAB_USER}:(OI)(CI)F`,
      "/grant:r", "SYSTEM:(OI)(CI)F",
      "/grant:r", "Administrators:(OI)(CI)F",
    ]);

    await run(path.join(nativeDir, "bin", "pg_ctl.exe"), [
      "register",
      "-N", LAB_SERVICE,
      "-D", this.datadir,
      "-o", `-p ${this.port}`,
      "-U", `.\\${LAB_USER}`,
      "-P", LAB_PASSWORD,
    ]);
    await run("net", ["start", LAB_SERVICE]);
    await waitForPort(this.port, 30000);
    this.started = true;

    this.client = new pg.Client({
      host: "127.0.0.1",
      port: this.port,
      user: "postgres",
      password: LAB_PASSWORD,
      database: "postgres",
    });
    await this.client.connect();

    await this.client.query(SUPABASE_SHIM_SQL);

    if (migrationsDir) {
      const files = fs.readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const file of files) {
        await applySqlFile(this.client, path.join(migrationsDir, file));
      }
      await this.client.query(GRANTS_SQL);
      this.migrationsApplied = files;
    }
    return this;
  }

  /** Run a query as a simulated authenticated Supabase user. */
  async asUser(userId, role, fn) {
    const jwt = JSON.stringify({ sub: userId, role: role ?? "authenticated" });
    await this.client.query("SELECT set_config('request.jwt.claims', $1, false)", [jwt]);
    await this.client.query(`SET ROLE ${role === "service_role" ? "service_role" : "authenticated"}`);
    try {
      return await fn();
    } finally {
      await this.client.query("RESET ROLE");
      await this.client.query("SELECT set_config('request.jwt.claims', '', false)");
    }
  }

  async stop() {
    if (this.client) {
      try { await this.client.end(); } catch { /* already closed */ }
      this.client = null;
    }
    if (this.started) {
      await runOk("net", ["stop", LAB_SERVICE]);
      this.started = false;
    }
    await runOk("sc", ["delete", LAB_SERVICE]);
    await runOk("net", ["user", LAB_USER, "/delete"]);
    if (this.datadir) {
      fs.rmSync(this.datadir, { recursive: true, force: true });
      this.datadir = null;
    }
  }
}

export { applySqlFile, LAB_PASSWORD };

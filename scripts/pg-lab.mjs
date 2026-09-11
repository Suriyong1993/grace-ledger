// Grace Ledger — real-PostgreSQL lab harness (no Docker, no production access).
//
// Boots a throwaway PostgreSQL 17 instance on this machine from the
// @embedded-postgres binaries. Everything is torn down on stop().
//
// Two boot strategies, because the two host OSes constrain PostgreSQL
// differently:
//
//   win32   PostgreSQL refuses to run under an administrative token, so the
//           server runs as a dedicated unprivileged local account via a
//           temporary Windows service (the original strategy — unchanged).
//   posix   Linux/macOS already run the test process as an unprivileged user,
//           so the cluster is spawned directly through the cross-platform
//           `embedded-postgres` package (the same one scripts/pg-lab-smoke.mjs
//           uses). No service account, no elevation required.
//
// Keeping the POSIX path alive matters: CI runs on ubuntu-latest, and without
// it every *.real-pg.test.ts suite silently skips there — a Segregation-of-
// Duties or RLS regression in the SQL would reach production undetected.
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

const IS_WINDOWS = process.platform === "win32";
/** npm publishes the binaries as @embedded-postgres/<platform>-<arch>. */
const NATIVE_PLATFORM =
  { win32: "windows", linux: "linux", darwin: "darwin" }[process.platform] ??
  process.platform;
const NATIVE_ARCH =
  { x64: "x64", arm64: "arm64", arm: "arm", ia32: "ia32", ppc64: "ppc64" }[
    process.arch
  ] ?? process.arch;

const LAB_USER = "gl_pg_lab_runner";
const LAB_PASSWORD = "GLpg#Lab2026x";
const LAB_SERVICE = "gl_pg_lab";
// Windows: one fixed root (the service name is fixed too, so only one lab may
// exist at a time). POSIX: a unique root per instance, so a stale directory
// from a crashed run can never collide with the next boot.
const LAB_ROOT = IS_WINDOWS
  ? path.join(process.env.ProgramData ?? "C:\\ProgramData", "gl_pg_lab")
  : path.join(
      os.tmpdir(),
      `gl_pg_lab_${process.pid}_${Date.now().toString(36)}`,
    );
const NATIVE_SRC = path.join(
  path.dirname(fileURLToPath(new URL("../package.json", import.meta.url))),
  "node_modules",
  "@embedded-postgres",
  `${NATIVE_PLATFORM}-${NATIVE_ARCH}`,
  "native",
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
      s.once("connect", () => {
        s.destroy();
        resolve(true);
      });
      s.once("error", () => resolve(false));
      setTimeout(() => {
        s.destroy();
        resolve(false);
      }, 1500);
    });
    if (open) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(
    `Postgres did not accept connections on port ${port} within ${timeoutMs}ms`,
  );
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
    await run("net", [
      "user",
      LAB_USER,
      LAB_PASSWORD,
      "/add",
      "/passwordchg:no",
      "/active:yes",
    ]);
  } else {
    // Keep the known password in force so the service can always log on.
    await runOk("net", ["user", LAB_USER, LAB_PASSWORD]);
  }
  // Per-user services need the "Log on as a service" right; pg_ctl register
  // does not grant it, so grant it explicitly via the LSA API.
  const grantScript = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "grant-logon-as-service.ps1",
  );
  await run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    grantScript,
    "-AccountName",
    `.\\${LAB_USER}`,
  ]);
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

-- Must match Supabase's own definitions, including the NULLIF *before* the
-- ::jsonb cast. Casting first (the previous shim) made an empty
-- request.jwt.claims setting raise 22P02 "invalid input syntax for type json"
-- instead of resolving to a NULL uid — so any query touching auth.uid() after
-- asUser() had reset the claims to '' blew up, and the lab disagreed with
-- production about what an unauthenticated caller looks like.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(
           COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub',
           ''
         )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
           NULLIF(
             COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'role',
             ''
           ),
           'anon'
         )
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
    /** POSIX only: the `embedded-postgres` cluster owning this lab. */
    this.cluster = null;
  }

  /** Boot the lab and apply every migration in supabase/migrations, in filename order. */
  async start({ migrationsDir } = {}) {
    this.port = await freePort();
    if (IS_WINDOWS) {
      await this.bootWindows();
    } else {
      await this.bootPosix();
    }
    return this.provision(migrationsDir);
  }

  /**
   * Windows boot: run the cluster as a dedicated unprivileged local account
   * behind a temporary service, because PostgreSQL refuses to run under an
   * administrative token.
   */
  async bootWindows() {
    await cleanupLeftovers();

    fs.mkdirSync(LAB_ROOT, { recursive: true });
    await ensureLabUser();
    const nativeDir = await ensureBinaries();

    this.datadir = path.join(LAB_ROOT, "data");
    fs.mkdirSync(this.datadir, { recursive: true });

    const pwfile = path.join(os.tmpdir(), "gl_pg_lab_pwfile");
    fs.writeFileSync(pwfile, LAB_PASSWORD, "utf8");
    try {
      await run(path.join(nativeDir, "bin", "initdb.exe"), [
        "-D",
        this.datadir,
        "-U",
        "postgres",
        "-A",
        "password",
        "--pwfile",
        pwfile,
        "-E",
        "UTF8",
        "--locale=C",
      ]);
    } finally {
      fs.rmSync(pwfile, { force: true });
    }

    // The server process runs as the lab user: give it exclusive access to the
    // data directory (PostgreSQL also rejects world/group-accessible datadirs).
    await run("icacls", [
      this.datadir,
      "/inheritance:r",
      "/grant:r",
      `${LAB_USER}:(OI)(CI)F`,
      "/grant:r",
      "SYSTEM:(OI)(CI)F",
      "/grant:r",
      "Administrators:(OI)(CI)F",
    ]);

    await run(path.join(nativeDir, "bin", "pg_ctl.exe"), [
      "register",
      "-N",
      LAB_SERVICE,
      "-D",
      this.datadir,
      "-o",
      `-p ${this.port}`,
      "-U",
      `.\\${LAB_USER}`,
      "-P",
      LAB_PASSWORD,
    ]);
    await run("net", ["start", LAB_SERVICE]);
    await waitForPort(this.port, 30000);
    this.started = true;
  }

  /**
   * POSIX boot: spawn the cluster directly as the current (already
   * unprivileged) user through the cross-platform `embedded-postgres` package.
   * No Windows service, no `net user`, no elevation.
   */
  async bootPosix() {
    if (typeof process.getuid === "function" && process.getuid() === 0) {
      throw new Error(
        "PgLab refuses to boot as root: PostgreSQL will not run under uid 0. " +
          "Re-run the tests as a normal user (CI runners already do).",
      );
    }
    if (!fs.existsSync(path.join(NATIVE_SRC, "bin", "postgres"))) {
      throw new Error(
        `PgLab found no PostgreSQL binaries for ${NATIVE_PLATFORM}-${NATIVE_ARCH} at ${NATIVE_SRC}. ` +
          "Run `npm ci` so the @embedded-postgres optional dependency is installed.",
      );
    }

    // Imported lazily: the package pulls in async-exit-hook, and the Windows
    // path must not pay for it.
    const { default: EmbeddedPostgres } = await import("embedded-postgres");

    fs.mkdirSync(LAB_ROOT, { recursive: true });
    this.datadir = path.join(LAB_ROOT, "data");

    this.cluster = new EmbeddedPostgres({
      databaseDir: this.datadir,
      port: this.port,
      user: "postgres",
      password: LAB_PASSWORD,
      authMethod: "password",
      // Throwaway cluster: stop() deletes the data directory for us.
      persistent: false,
      initdbFlags: ["-E", "UTF8", "--locale=C"],
      // Bind loopback only — the lab must never be reachable off this machine.
      postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
      // The cluster's own chatter would drown the test reporter.
      onLog: () => {},
      onError: () => {},
    });

    await this.cluster.initialise();
    await this.cluster.start();
    await waitForPort(this.port, 30000);
    this.started = true;
  }

  /** Connect, install the Supabase platform shim, then apply every migration. */
  async provision(migrationsDir) {
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
      const files = fs
        .readdirSync(migrationsDir)
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
    await this.client.query(
      "SELECT set_config('request.jwt.claims', $1, false)",
      [jwt],
    );
    await this.client.query(
      `SET ROLE ${role === "service_role" ? "service_role" : "authenticated"}`,
    );
    try {
      return await fn();
    } finally {
      await this.client.query("RESET ROLE");
      await this.client.query(
        "SELECT set_config('request.jwt.claims', '', false)",
      );
    }
  }

  /**
   * Open an INDEPENDENT physical connection to the same lab instance (its own
   * backend PID). Required for real concurrency tests: two sessions issuing
   * overlapping statements on `this.client` alone would just serialize on a
   * single libpq connection and could never observe genuine row-lock waits.
   * Caller owns the returned client's lifecycle (call .end() when done).
   */
  async openSession() {
    const client = new pg.Client({
      host: "127.0.0.1",
      port: this.port,
      user: "postgres",
      password: LAB_PASSWORD,
      database: "postgres",
    });
    await client.connect();
    const { rows } = await client.query("SELECT pg_backend_pid() AS pid");
    return { client, pid: rows[0].pid };
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
    if (IS_WINDOWS) {
      if (this.started) {
        await runOk("net", ["stop", LAB_SERVICE]);
        this.started = false;
      }
      await runOk("sc", ["delete", LAB_SERVICE]);
      await runOk("net", ["user", LAB_USER, "/delete"]);
    } else if (this.cluster) {
      // persistent:false makes stop() delete the data directory too.
      try {
        await this.cluster.stop();
      } catch {
        /* already stopped */
      }
      this.cluster = null;
      this.started = false;
    }
    if (this.datadir) {
      fs.rmSync(this.datadir, { recursive: true, force: true });
      this.datadir = null;
    }
    if (!IS_WINDOWS) {
      fs.rmSync(LAB_ROOT, { recursive: true, force: true });
    }
  }
}

export { applySqlFile, LAB_PASSWORD };

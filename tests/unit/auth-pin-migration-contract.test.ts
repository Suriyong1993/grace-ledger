import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The PIN credential store is one edit away from being readable by every signed-in
 * user. RLS with zero policies and revoked grants is what keeps `auth_pins` shut,
 * and nothing about that is visible from the application code — a later migration
 * that adds a convenience policy, or a `GRANT ... TO authenticated`, would open it
 * silently and no feature test would notice.
 *
 * This test reads the migration and fails on any change that weakens the posture
 * proven in the Stage 3 security matrix.
 */

const MIGRATION = resolve(__dirname, "../../supabase/migrations/20260824112221_auth_pins_foundation.sql");
// Normalize CRLF: git on Windows may check this file out with \r\n, which
// would otherwise break the exact-substring decoy-hash match below without
// changing anything about the migration's actual (line-ending-agnostic) SQL.
const sql = readFileSync(MIGRATION, "utf8").replace(/\r\n/g, "\n");

/** The body of one `CREATE OR REPLACE FUNCTION name(...)` block. */
function functionBody(name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}`);
  expect(start, `${name} is missing from the migration`).toBeGreaterThan(-1);
  const end = sql.indexOf("\n$fn$;", start);
  expect(end, `${name} has no terminated body`).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe("auth_pins credential store", () => {
  it("keeps row level security on both tables", () => {
    expect(sql).toMatch(/ALTER TABLE auth_pins\s+ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/ALTER TABLE auth_pin_probes\s+ENABLE ROW LEVEL SECURITY/);
  });

  it("defines no policy, so RLS denies every row to every non-owner role", () => {
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });

  it("revokes table access from anon and authenticated", () => {
    for (const table of ["auth_pins", "auth_pin_probes"]) {
      for (const role of ["PUBLIC", "anon", "authenticated"]) {
        expect(sql, `${table} is still reachable by ${role}`).toContain(
          `REVOKE ALL ON TABLE ${table}`.padEnd(0) + "",
        );
        expect(
          new RegExp(`REVOKE ALL ON TABLE ${table}\\s+FROM ${role};`).test(sql),
          `${table} is still reachable by ${role}`,
        ).toBe(true);
      }
    }
  });

  it("never grants either table to a browser-facing role", () => {
    expect(sql).not.toMatch(/GRANT[^;]*ON TABLE auth_pin(s|_probes)[^;]*TO\s+(anon|authenticated)/i);
  });

  it("stores the PIN only as a bcrypt hash, never in plain text", () => {
    expect(sql).toMatch(/extensions\.gen_salt\('bf',\s*10\)/);

    // Every appearance of the incoming PIN must be inside a crypt() call —
    // as the value being hashed, or the value being compared against a hash.
    const uses = [...sql.matchAll(/\bp_(new|current)_pin\b/g)];
    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) {
      const preceding = sql.slice(Math.max(0, use.index! - 40), use.index!);
      const following = sql.slice(use.index! + use[0].length, use.index! + use[0].length + 20);

      const isDeclaration = /^\s+TEXT/.test(following);
      const isHashed = /extensions\.crypt\($/.test(preceding);
      // Shape checks read the PIN without storing it: a null test, the
      // six-digit regex, or the strength function.
      const isShapeCheck =
        /^\s+(IS NULL|!~|~)/.test(following) || /NOT auth_pin_is_acceptable\($/.test(preceding);

      expect(
        isDeclaration || isHashed || isShapeCheck,
        `raw PIN reaches: ...${preceding}${use[0]}`,
      ).toBe(true);
    }
  });
});

describe("verify_and_consume_pin", () => {
  const body = functionBody("verify_and_consume_pin");

  it("runs as SECURITY DEFINER with a pinned search_path", () => {
    expect(body).toContain("SECURITY DEFINER");
    expect(body).toContain("SET search_path = public, extensions, pg_temp");
  });

  it("is callable by service_role only", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION verify_and_consume_pin\(UUID, UUID, TEXT\)\s+FROM anon;/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION verify_and_consume_pin\(UUID, UUID, TEXT\)\s+FROM authenticated;/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION verify_and_consume_pin\(UUID, UUID, TEXT\)\s+TO service_role;/);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION verify_and_consume_pin[^;]*TO\s+(anon|authenticated)/);
  });

  it("locks the credential row before spending an attempt, so parallel guesses cannot race", () => {
    expect(body).toMatch(/SELECT \* INTO v_pin FROM auth_pins WHERE profile_id = p_profile_id FOR UPDATE/);
  });

  it("refuses an inactive profile and a profile from another church", () => {
    expect(body).toContain("v_profile.is_active IS NOT TRUE");
    expect(body).toContain("v_profile.church_id <> p_church_id");
  });

  it("returns no attempt counter on failure, so responses cannot be used to enumerate", () => {
    const failureReturns = body.match(/RETURN jsonb_build_object\('status', 'invalid'[^)]*\)/g) ?? [];
    expect(failureReturns.length).toBeGreaterThan(0);
    for (const shape of failureReturns) {
      expect(shape).toBe("RETURN jsonb_build_object('status', 'invalid')");
    }
  });

  it("burns a bcrypt comparison on every failure path, so timing does not sort real ids from imaginary ones", () => {
    // Four dead ends reach no stored hash: null arguments, malformed PIN,
    // unknown/inactive/foreign profile, and a profile with no PIN row. Each
    // must still pay for a comparison, as must the locked-out path.
    const decoyComparisons = body.match(/PERFORM extensions\.crypt\(/g) ?? [];
    expect(decoyComparisons.length).toBe(5);
  });

  it("answers a locked account before comparing, so a correct PIN cannot lift a lockout", () => {
    const lockGuard = body.indexOf("v_pin.locked_until IS NOT NULL AND v_pin.locked_until > now()");
    const comparison = body.indexOf("v_matches := extensions.crypt");
    expect(lockGuard).toBeGreaterThan(-1);
    expect(comparison).toBeGreaterThan(lockGuard);
  });

  it("escalates the lockout rather than resetting it after each release", () => {
    expect(body).toContain("v_pin.lockout_count := v_pin.lockout_count + 1");
    expect(body).toContain("auth_pin_lockout_interval(v_pin.lockout_count)");
    // The counter of failures restarts after a lockout expires; the escalation
    // level must not, or a patient attacker gets 15-minute waits forever.
    expect(body).not.toMatch(/lockout_count\s*=\s*0[^;]*locked_until\s*=\s*now\(\)/);
  });

  it("writes an audit row for success, failure, and lockout", () => {
    for (const action of ["PIN_LOGIN_SUCCESS", "PIN_LOGIN_FAILED", "PIN_LOGIN_LOCKED"]) {
      expect(body).toContain(action);
    }
  });

  it("returns the email only on success", () => {
    const successReturn = body.slice(body.indexOf("'status',         'success'"));
    expect(successReturn).toContain("v_profile.email");
    const failureHalf = body.slice(body.indexOf("v_pin.failed_attempts := v_pin.failed_attempts + 1"));
    expect(failureHalf).not.toContain("email");
  });
});

describe("set_own_pin", () => {
  const body = functionBody("set_own_pin");

  it("acts on auth.uid() only, so no caller can name another profile", () => {
    expect(body).toContain("v_user_id UUID := auth.uid()");
    expect(body).not.toMatch(/p_profile_id|p_user_id|p_target/);
  });

  it("stays closed to anon and open to authenticated", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION set_own_pin\(TEXT, TEXT\)\s+FROM anon;/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION set_own_pin\(TEXT, TEXT\)\s+TO authenticated;/);
  });

  it("demands the current PIN unless an admin flagged the row for reset", () => {
    expect(body).toContain("v_has_pin AND v_pin.requires_reset IS NOT TRUE");
    expect(body).toContain("extensions.crypt(p_current_pin, v_pin.pin_hash) <> v_pin.pin_hash");
  });

  it("refuses a weak or reused PIN", () => {
    expect(body).toContain("NOT auth_pin_is_acceptable(p_new_pin)");
    expect(body).toContain("'reused_pin'");
  });

  it("clears requires_reset once the holder has chosen their own PIN", () => {
    expect(body).toMatch(/requires_reset\s*=\s*false/);
  });
});

describe("auth_pin_is_acceptable", () => {
  const body = functionBody("auth_pin_is_acceptable");

  it("requires exactly six digits", () => {
    expect(body).toContain("p_pin !~ '^[0-9]{6}$'");
  });

  it("rejects a single repeated digit and straight runs in both directions", () => {
    expect(body).toMatch(/p_pin ~ '\^\(\.\)\\1\{5\}\$'/);
    expect(body).toContain("v_ascending");
    expect(body).toContain("v_descending");
  });
});

/**
 * A PIN seeded by a migration is a credential that ships in the repo, runs on
 * every environment the migrations touch, and belongs to nobody. Provisioning
 * is an authenticated admin action; disposable test PINs belong to an isolated
 * test context and never to a file that production replays.
 */
describe("no PIN is ever seeded by a migration", () => {
  const MIGRATIONS_DIR = resolve(__dirname, "../../supabase/migrations");
  const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));

  it("finds the migration directory", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("writes no row into auth_pins outside a function body", () => {
    // Strip every $fn$…$fn$ block: what remains is what the migration executes
    // directly when it is replayed against a database.
    const topLevel = sql.replace(/\$fn\$[\s\S]*?\$fn\$/g, "");
    expect(topLevel).not.toMatch(/INSERT\s+INTO\s+auth_pins/i);
    expect(topLevel).not.toMatch(/COPY\s+auth_pins/i);
    expect(topLevel).not.toMatch(/extensions\.crypt\(/);
    expect(topLevel).not.toMatch(/gen_salt/);
  });

  it("keeps every other migration clear of the credential tables", () => {
    for (const name of files) {
      if (name.startsWith("20260824112221_") || name.startsWith("20260824114541_")) continue;
      const other = readFileSync(resolve(MIGRATIONS_DIR, name), "utf8");
      expect(/auth_pins|auth_pin_probes/i.test(other), `${name} touches the PIN tables`).toBe(false);
    }
  });

  it("carries no bcrypt hash literal in any migration", () => {
    for (const name of files) {
      const contents = readFileSync(resolve(MIGRATIONS_DIR, name), "utf8");
      const hashes = contents.match(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g) ?? [];
      // The one permitted literal is the decoy compared against on failure
      // paths, which is not any person's PIN and unlocks nothing.
      const unexpected = hashes.filter(
        (hash) => !sql.includes(`c_decoy_hash CONSTANT TEXT :=\n    '${hash}'`),
      );
      expect(unexpected, `${name} contains a bcrypt hash literal`).toEqual([]);
    }
  });
});

describe("blast radius", () => {
  it("touches no existing table, policy, or financial routine", () => {
    const forbidden = [
      /ALTER TABLE (?!auth_pins|auth_pin_probes)/,
      /DROP (TABLE|POLICY|FUNCTION)/i,
      /CREATE OR REPLACE FUNCTION (?!auth_pin_lockout_interval|auth_pin_is_acceptable|auth_pin_record_probe|verify_and_consume_pin|set_own_pin)/,
      /transactions|transaction_splits|funds|offering_sessions/i,
    ];
    for (const pattern of forbidden) {
      expect(pattern.test(sql), `migration reaches outside its scope: ${pattern}`).toBe(false);
    }
  });

  it("only ever writes to auth_pins, auth_pin_probes, and audit_logs", () => {
    // `DO UPDATE SET` is the upsert tail of an INSERT already counted, not a
    // separate target, so it is excluded rather than read as a table named SET.
    const writes = sql.match(/(INSERT INTO|(?<!DO )UPDATE|DELETE FROM)\s+(\w+)/g) ?? [];
    const tables = new Set(writes.map((w) => w.split(/\s+/).pop()!));
    expect([...tables].sort()).toEqual(["audit_logs", "auth_pin_probes", "auth_pins"]);
  });
});

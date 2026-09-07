/**
 * RPC signature contract — TypeScript callers vs the real PostgreSQL catalog.
 *
 * Every other contract test in this repo builds its expectations from the same
 * TypeScript that is under test, so an adapter and its test can agree with each
 * other and both be wrong about the database. This suite instead boots a real
 * PostgreSQL 17, applies all 31 migrations from supabase/migrations, and reads
 * the *catalog* (pg_proc / pg_get_function_arguments) for the ground truth.
 *
 * What that catches: a renamed parameter, a dropped parameter, an argument the
 * caller omits that has no DEFAULT, or a call to a function that no migration
 * defines. What it does not catch: whether the value passed is semantically
 * right. That is what the persistence suite covers.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PgLabLinux, pgLabAvailable } from "../../scripts/pg-lab-linux.mjs";

const available = await pgLabAvailable();
const d = available ? describe : describe.skip;

/**
 * Every RPC the application calls, with the parameter object it passes.
 * Extracted from source rather than hand-listed so a new call site cannot
 * quietly escape this audit.
 */
function collectRpcCalls(): Map<string, Set<string>> {
  const root = resolve(__dirname, "../../src");
  const calls = new Map<string, Set<string>>();

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) return walk(p);
      return e.isFile() && p.endsWith(".ts") ? [p] : [];
    });

  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    const re = /\.rpc(?:\s*as any\s*\))?\s*\(\s*\n?\s*"([a-z_0-9]+)"\s*,\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      // Slice the object literal that follows, then read its top-level keys.
      const start = text.indexOf("{", m.index + m[0].length - 1);
      let depth = 0;
      let end = start;
      for (let i = start; i < text.length; i++) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const body = text.slice(start + 1, end);
      const keys = new Set<string>();
      let d2 = 0;
      for (const line of body.split("\n")) {
        const km = /^\s*(p_[a-z_0-9]+)\s*:/.exec(line);
        if (km && d2 === 0) keys.add(km[1]);
        d2 += (line.match(/[{[(]/g) ?? []).length;
        d2 -= (line.match(/[}\])]/g) ?? []).length;
      }
      const existing = calls.get(m[1]) ?? new Set<string>();
      for (const k of keys) existing.add(k);
      calls.set(m[1], existing);
    }
  }
  return calls;
}

d("RPC signatures against a real PostgreSQL catalog", () => {
  let lab: InstanceType<typeof PgLabLinux>;
  /** function name -> { args: name->hasDefault, returns } straight from pg_proc. */
  let catalog: Map<string, { args: Map<string, boolean>; returns: string }>;
  const rpcCalls = collectRpcCalls();

  beforeAll(async () => {
    lab = new PgLabLinux();
    await lab.start();

    const { rows } = await lab.client.query(`
      SELECT p.proname,
             pg_get_function_arguments(p.oid) AS args,
             pg_get_function_result(p.oid)    AS returns
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
    `);

    catalog = new Map();
    for (const r of rows) {
      const args = new Map<string, boolean>();
      if (r.args.trim()) {
        // "p_session_id uuid, p_coins numeric DEFAULT 0.00"
        for (const part of r.args.split(/,(?![^(]*\))/)) {
          const name = part.trim().split(/\s+/)[0];
          if (name.startsWith("p_")) args.set(name, /DEFAULT/i.test(part));
        }
      }
      catalog.set(r.proname, { args, returns: r.returns });
    }
  }, 120_000);

  afterAll(async () => {
    await lab?.stop();
  });

  it("applied every migration in the repository", () => {
    expect(lab.migrationsApplied.length).toBeGreaterThanOrEqual(31);
  });

  it("discovered the RPC call sites it is meant to audit", () => {
    expect(rpcCalls.size).toBeGreaterThanOrEqual(15);
    // The three flows the brief names must be among them.
    for (const critical of [
      "record_cash_count",
      "post_offering_to_ledger",
      "resolve_offering_variance",
    ]) {
      expect([...rpcCalls.keys()]).toContain(critical);
    }
  });

  it("every RPC the application calls exists in the database", () => {
    const missing = [...rpcCalls.keys()].filter((n) => !catalog.has(n));
    expect(missing, `called from src but no migration defines them`).toEqual([]);
  });

  it("every parameter the application sends exists on the function", () => {
    const bad: string[] = [];
    for (const [fn, params] of rpcCalls) {
      const sig = catalog.get(fn);
      if (!sig) continue;
      for (const p of params) {
        if (!sig.args.has(p)) {
          bad.push(`${fn}(${p}) — accepts: ${[...sig.args.keys()].join(", ")}`);
        }
      }
    }
    expect(bad, "parameter names not present in the real signature").toEqual([]);
  });

  it("every required parameter is supplied by the caller", () => {
    const bad: string[] = [];
    for (const [fn, params] of rpcCalls) {
      const sig = catalog.get(fn);
      if (!sig) continue;
      for (const [arg, hasDefault] of sig.args) {
        // No DEFAULT means PostgreSQL rejects the call outright if omitted.
        if (!hasDefault && !params.has(arg)) bad.push(`${fn} omits ${arg}`);
      }
    }
    expect(bad, "required arguments never sent — these calls fail at runtime").toEqual([]);
  });

  describe("the three critical financial RPCs", () => {
    const expected: Record<string, string[]> = {
      record_cash_count: [
        "p_session_id", "p_counter1_id", "p_counter2_id",
        "p_bill_1000", "p_bill_500", "p_bill_100",
        "p_bill_50", "p_bill_20", "p_coins",
      ],
      post_offering_to_ledger: [
        "p_session_id", "p_cash_account_id", "p_bank_account_id",
      ],
      resolve_offering_variance: [
        "p_session_id", "p_action", "p_explanation",
      ],
    };

    it.each(Object.keys(expected))(
      "%s has exactly the parameters the code relies on",
      (fn) => {
        const sig = catalog.get(fn);
        expect(sig, `${fn} is not defined in any migration`).toBeDefined();
        expect([...sig!.args.keys()].sort()).toEqual(expected[fn].sort());
      },
    );

    it.each(Object.keys(expected))("%s returns jsonb", (fn) => {
      // The adapters all read named keys off the result; a scalar or a record
      // would break every one of them.
      expect(catalog.get(fn)!.returns.toLowerCase()).toContain("jsonb");
    });

    it("record_cash_count types the counters as uuid and the bills as integers", () => {
      // Guards against a silent widening to text, which would let malformed
      // ids through to the ledger.
      const { rows } = { rows: [] as any[] };
      void rows;
      return lab.client
        .query(
          `SELECT pg_get_function_arguments(p.oid) AS args
             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname='public' AND p.proname='record_cash_count'`,
        )
        .then((r: any) => {
          const args: string = r.rows[0].args;
          expect(args).toMatch(/p_session_id uuid/);
          expect(args).toMatch(/p_counter1_id uuid/);
          expect(args).toMatch(/p_counter2_id uuid/);
          expect(args).toMatch(/p_bill_1000 integer/);
          expect(args).toMatch(/p_coins numeric/);
        });
    });
  });
});

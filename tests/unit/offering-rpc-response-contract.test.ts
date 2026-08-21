import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The TypeScript client must read the keys the RPC actually returns.
 *
 * `record_cash_count` returns `counted_cash`; the client read `total_cash`,
 * which made `Money.from(undefined)` throw *after* the RPC had already
 * committed the count — the write succeeded and the UI reported failure.
 * The unit-test mocks were written from the client code rather than from the
 * migration, so they agreed with the bug and it shipped green.
 *
 * This test reads both sides of the contract from source and fails on any
 * key the client expects but the RPC never sends.
 */

const MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260819000011_offering_rpcs_and_triggers.sql"
);
const SERVICE = resolve(__dirname, "../../src/lib/offering/offering-service.ts");

/** RPC name -> keys of the jsonb payload it returns on success. */
function rpcReturnKeys(sql: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const fnRe = /CREATE OR REPLACE FUNCTION (\w+)\s*\(/g;
  const starts: Array<{ name: string; at: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(sql)) !== null) {
    starts.push({ name: m[1], at: m.index });
  }

  starts.forEach((fn, i) => {
    const body = sql.slice(fn.at, i + 1 < starts.length ? starts[i + 1].at : sql.length);
    const returns = [...body.matchAll(/RETURN\s+jsonb_build_object\s*\(/g)];
    if (returns.length === 0) return;

    // A function can return from several branches (recount vs explain, first
    // post vs already-posted). Union every branch's payload — a key present in
    // any branch is a key the client may legitimately read.
    const keys = new Set<string>();
    for (const ret of returns) {
      const from = ret.index! + ret[0].length;
      let depth = 1;
      let payload = "";
      for (const ch of body.slice(from)) {
        if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) break;
        }
        payload += ch;
      }
      for (const k of payload.matchAll(/'([a-z0-9_]+)'\s*,/g)) keys.add(k[1]);
    }
    out[fn.name] = [...keys];
  });

  return out;
}

/** RPC name -> keys the service reads off the response object. */
function serviceReadKeys(ts: string): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  const callRe = /\.rpc as any\)\(\s*\n?\s*"(\w+)"/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(ts)) !== null) {
    const name = m[1];
    let window = ts.slice(m.index + m[0].length, m.index + m[0].length + 1800);
    const next = window.indexOf(".rpc as any)");
    if (next !== -1) window = window.slice(0, next);
    out[name] = out[name] || new Set<string>();
    for (const read of window.matchAll(/\bres\.([a-z0-9_]+)/g)) {
      out[name].add(read[1]);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
}

describe("Offering RPC response contract", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  const ts = readFileSync(SERVICE, "utf8");
  const returns = rpcReturnKeys(sql);
  const reads = serviceReadKeys(ts);

  it("parses both sides of the contract", () => {
    expect(Object.keys(returns).length).toBeGreaterThan(0);
    expect(Object.keys(reads).length).toBeGreaterThan(0);
    expect(returns.record_cash_count).toContain("counted_cash");
  });

  it("reads only keys the RPC actually returns", () => {
    const mismatches: string[] = [];

    for (const [rpc, keys] of Object.entries(reads)) {
      const returned = returns[rpc];
      if (!returned) continue; // RPC returns a scalar / not a jsonb payload
      for (const key of keys) {
        if (!returned.includes(key)) {
          mismatches.push(`${rpc}: client reads res.${key}, RPC returns [${returned.join(", ")}]`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("never feeds an unreturned key straight into Money.from", () => {
    // This is the shape that throws rather than degrading quietly.
    const offenders: string[] = [];

    for (const [rpc, keys] of Object.entries(reads)) {
      const returned = returns[rpc];
      if (!returned) continue;
      for (const key of keys) {
        if (returned.includes(key)) continue;
        if (ts.includes(`Money.from(res.${key})`)) {
          offenders.push(`${rpc}.res.${key}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

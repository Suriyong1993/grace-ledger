import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TransactionLifecycle } from "@/lib/transactions/lifecycle.js";
import type { WorkflowActor } from "@/lib/transactions/types.js";

/**
 * Direct Post (draft -> posted) segregation-of-duties contract.
 *
 * Direct posting is a delegated convenience, not a second pair of eyes: it
 * must never let the draft's creator bypass approval on their own transaction.
 * The same rule is enforced in the database by migration
 * 20260831000000_direct_post_two_person_rule.sql — this file pins the
 * application layer; that migration pins the real security boundary.
 */

const churchId = "church-1";
const creatorId = "user-creator";
const otherTreasurerId = "user-treasurer-2";

const baseTxn = {
  createdBy: creatorId,
  churchId,
  amount: "5000.00",
  splits: [{ fundId: "fund-1", amount: "5000.00" }],
};

function treasurer(userId: string): WorkflowActor {
  return { userId, churchId, roles: ["treasurer"] };
}

describe("Direct Post Two-Person Rule (draft -> posted)", () => {
  it("allows a treasurer who is NOT the creator to direct-post a draft", () => {
    const res = TransactionLifecycle.canTransition("draft", "posted", treasurer(otherTreasurerId), baseTxn);
    expect(res.allowed).toBe(true);
  });

  it("DENIES the draft creator from direct-posting their own draft", () => {
    const res = TransactionLifecycle.canTransition("draft", "posted", treasurer(creatorId), baseTxn);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Segregation of Duties Violation");
  });

  it("DENIES super_admin and pastor creators as well — the rule is about the creator, not the role", () => {
    for (const role of ["super_admin", "pastor"] as const) {
      const actor: WorkflowActor = { userId: creatorId, churchId, roles: [role] };
      const res = TransactionLifecycle.canTransition("draft", "posted", actor, baseTxn);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Segregation of Duties Violation");
    }
  });

  it("still requires split parity for a legitimate direct post", () => {
    const unbalanced = { ...baseTxn, splits: [{ fundId: "fund-1", amount: "3000.00" }] };
    const res = TransactionLifecycle.canTransition("draft", "posted", treasurer(otherTreasurerId), unbalanced);
    expect(res.allowed).toBe(false);
  });

  it("never lets a member direct-post anyone's draft", () => {
    const actor: WorkflowActor = { userId: otherTreasurerId, churchId, roles: ["member"] };
    const res = TransactionLifecycle.canTransition("draft", "posted", actor, baseTxn);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Unauthorized");
  });
});

describe("Migration contract: 20260831000000_direct_post_two_person_rule.sql", () => {
  // Read from disk so the test fails if the migration is renamed away.
  const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/20260831000000_direct_post_two_person_rule.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");

  it("replaces post_transaction and rejects creator self-posting at the database boundary", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION post_transaction/);
    expect(sql).toMatch(/v_is_direct_post AND v_txn\.created_by = auth\.uid\(\)/);
    expect(sql).toMatch(/Segregation of Duties Violation/);
  });

  it("flags direct posts in the audit trail per the UI contract safeguard", () => {
    expect(sql).toMatch(/'direct_post', v_is_direct_post/);
    expect(sql).toMatch(/DIRECT_POST_BY_TREASURER/);
  });

  it("preserves the approved-post path and financial mutations unchanged", () => {
    expect(sql).toMatch(/status NOT IN \('approved', 'draft'\)/);
    expect(sql).toMatch(/SUM\(amount\) AS split_sum/);
    expect(sql).toMatch(/FOR UPDATE/);
  });
});

describe("Migration contract: 20260831000001_fund_balance_reconciliation.sql", () => {
  const migrationPath = resolve(
    process.cwd(),
    "supabase/migrations/20260831000001_fund_balance_reconciliation.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");

  it("provides a report-only reconciliation over the ledger, not the stored column", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION reconcile_fund_balances/);
    expect(sql).toMatch(/t\.status = 'posted'/);
    expect(sql).toMatch(/ft\.status = 'completed'/);
    // STABLE, not VOLATILE: the function must not mutate anything.
    expect(sql).toMatch(/LANGUAGE sql STABLE/);
    expect(sql).not.toMatch(/UPDATE funds/);
  });

  it("derives from ledger effects only: posted income/expense splits and completed transfers", () => {
    expect(sql).toMatch(/WHEN 'expense' THEN -s\.amount/);
    expect(sql).not.toMatch(/WHEN 'transfer'/);
  });

  it("restricts execution to authenticated treasurer-tier callers", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION reconcile_fund_balances\(UUID\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION reconcile_fund_balances\(UUID\) TO authenticated/);
  });
});

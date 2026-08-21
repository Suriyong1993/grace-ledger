import { describe, it, expect } from "vitest";
import { can, assertPermission } from "@/lib/rbac.js";

describe("RBAC Permissions Matrix", () => {
  it("grants super_admin full permissions across all resources", () => {
    expect(can("super_admin", "create", "transactions")).toBe(true);
    expect(can("super_admin", "delete", "transactions")).toBe(true);
    expect(can("super_admin", "approve", "approvals")).toBe(true);
    expect(can("super_admin", "export", "reports")).toBe(true);
    expect(can("super_admin", "read", "audit_logs")).toBe(true);
  });

  it("grants pastor view and approval rights plus sensitive member giving access", () => {
    expect(can("pastor", "read", "transactions")).toBe(true);
    expect(can("pastor", "approve", "approvals")).toBe(true);
    expect(can("pastor", "approve", "fund_transfers")).toBe(true);
    expect(can("pastor", "read", "member_giving")).toBe(true);
    expect(can("pastor", "read", "audit_logs")).toBe(true);
    // Pastor cannot delete or create accounts directly
    expect(can("pastor", "delete", "accounts")).toBe(false);
  });

  it("grants treasurer financial management, transfers, and giving access", () => {
    expect(can("treasurer", "create", "transactions")).toBe(true);
    expect(can("treasurer", "create", "fund_transfers")).toBe(true);
    expect(can("treasurer", "read", "member_giving")).toBe(true);
    expect(can("treasurer", "update", "funds")).toBe(true);
  });

  it("strictly prohibits finance_staff from member giving and audit logs", () => {
    expect(can("finance_staff", "create", "transactions")).toBe(true);
    expect(can("finance_staff", "read", "transactions")).toBe(true);
    expect(can("finance_staff", "read", "member_giving")).toBe(false);
    expect(can("finance_staff", "read", "audit_logs")).toBe(false);
    expect(can("finance_staff", "approve", "approvals")).toBe(false);
  });

  it("restricts cash counters strictly to counting and signing", () => {
    expect(can("counter", "read", "offering_sessions")).toBe(true);
    expect(can("counter", "update", "offering_sessions")).toBe(true);
    expect(can("counter", "read", "transactions")).toBe(false);
    expect(can("counter", "read", "accounts")).toBe(false);
    expect(can("counter", "read", "member_giving")).toBe(false);
  });

  it("throws descriptive error when permission assertion fails", () => {
    expect(() =>
      assertPermission("finance_staff", "read", "member_giving")
    ).toThrow(/Access Denied/);
  });
});

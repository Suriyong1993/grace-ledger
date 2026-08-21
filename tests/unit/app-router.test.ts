import { describe, it, expect } from "vitest";
import { router } from "../../src/router";

describe("Client Router — Unit Tests", () => {
  it("matches root path / correctly", () => {
    const matched = router.matchRoute("/");
    expect(matched.pattern).toBe("/");
    expect(matched.path).toBe("/");
    expect(matched.params).toEqual({});
  });

  it("matches hash root #/ correctly", () => {
    const matched = router.matchRoute("#/");
    expect(matched.pattern).toBe("/");
  });

  it("matches /approvals queue route correctly", () => {
    const matched = router.matchRoute("/approvals");
    expect(matched.pattern).toBe("/approvals");
    expect(matched.path).toBe("/approvals");
  });

  it("matches /approvals/:id detail route and extracts transaction id parameter", () => {
    const matched = router.matchRoute("/approvals/txn-987-uuid");
    expect(matched.pattern).toBe("/approvals/:id");
    expect(matched.path).toBe("/approvals/txn-987-uuid");
    expect(matched.params.id).toBe("txn-987-uuid");
  });

  it("handles trailing slashes gracefully", () => {
    const matched = router.matchRoute("/approvals/");
    expect(matched.pattern).toBe("/approvals");
    expect(matched.path).toBe("/approvals");
  });

  it("returns not_found for unknown paths", () => {
    const matched = router.matchRoute("/unknown/path/here");
    expect(matched.pattern).toBe("not_found");
  });
});

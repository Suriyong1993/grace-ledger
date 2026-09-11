import { afterEach, describe, expect, it, vi } from "vitest";

// The *.real-pg.test.ts suites are the only tests that verify the database
// itself (RLS, Segregation of Duties, split immutability, lock ordering).
// Their boot-failure policy is therefore a security control in its own right:
// if PGLAB_REQUIRED=1 stopped re-throwing, CI would go green while proving
// nothing. These tests pin that policy.
//
// REAL_PG_REQUIRED is read from process.env at module load, so each case
// re-imports the module with a fresh registry.
async function loadPolicy(envValue: string | undefined) {
  vi.resetModules();
  if (envValue === undefined) {
    delete process.env.PGLAB_REQUIRED;
  } else {
    process.env.PGLAB_REQUIRED = envValue;
  }
  return import("./real-pg-boot");
}

describe("real-PG boot-failure policy", () => {
  afterEach(() => {
    delete process.env.PGLAB_REQUIRED;
    vi.restoreAllMocks();
  });

  it("fails the run when PGLAB_REQUIRED=1 (CI) instead of skipping", async () => {
    const { handleRealPgBootFailure, REAL_PG_REQUIRED } =
      await loadPolicy("1");
    expect(REAL_PG_REQUIRED).toBe(true);

    const bootError = new Error("initdb: command not found");
    expect(() =>
      handleRealPgBootFailure(bootError, ["# SUITE = NOT VERIFIED"]),
    ).toThrow(bootError);
  });

  it("wraps a non-Error failure so CI still reports a real reason", async () => {
    const { handleRealPgBootFailure } = await loadPolicy("1");
    expect(() => handleRealPgBootFailure("boom", ["# X"])).toThrow(
      /real-PostgreSQL lab failed to boot: boom/,
    );
  });

  it("skips with a banner when PGLAB_REQUIRED is unset (local run)", async () => {
    const { handleRealPgBootFailure, REAL_PG_REQUIRED } =
      await loadPolicy(undefined);
    expect(REAL_PG_REQUIRED).toBe(false);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = handleRealPgBootFailure(new Error("no binaries"), [
      "# SUITE = NOT VERIFIED",
    ]);

    // `false` feeds describe.runIf() — the suite must be reported as skipped.
    expect(result).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    const banner = String(warn.mock.calls[0][0]);
    expect(banner).toContain("# SUITE = NOT VERIFIED");
    expect(banner).toContain("Reason: no binaries");
    expect(banner).toContain("PGLAB_REQUIRED=1");
  });

  it("treats any value other than \"1\" as not required", async () => {
    const { REAL_PG_REQUIRED } = await loadPolicy("true");
    expect(REAL_PG_REQUIRED).toBe(false);
  });
});

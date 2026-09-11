// Shared boot-failure policy for the *.real-pg.test.ts suites.
//
// These suites verify the database itself — RLS, the Segregation-of-Duties
// guards inside post_transaction()/approve_transaction(), split immutability,
// lock ordering under genuine concurrency. Nothing else in the test suite
// does: every other integration test runs against a mock. A silently skipped
// real-PG suite is therefore a silently unverified security control.
//
// Policy:
//   - Interactive/local runs: boot failure prints a banner and the suite skips,
//     so a machine without the embedded PostgreSQL binaries stays usable.
//   - CI (`PGLAB_REQUIRED=1`): boot failure re-throws and the run FAILS. CI
//     installs the binaries via `npm ci`, so a failure there is a real
//     regression in the harness, not a missing prerequisite.
//
// Set PGLAB_REQUIRED=1 locally to get the same hard guarantee.

/** True when a real-PostgreSQL suite must run rather than skip. */
export const REAL_PG_REQUIRED = process.env.PGLAB_REQUIRED === "1";

/**
 * Decide what a real-PG suite does when its lab could not boot.
 *
 * @param err    the boot/seed error
 * @param banner suite-specific lines explaining which control goes unverified
 * @returns      `false` — callers feed this straight into `describe.runIf()`
 * @throws       the original error when {@link REAL_PG_REQUIRED} is set
 */
export function handleRealPgBootFailure(err: unknown, banner: string[]): false {
  if (REAL_PG_REQUIRED) {
    // Fail loudly instead of reporting a green run that proved nothing.
    throw err instanceof Error
      ? err
      : new Error(`real-PostgreSQL lab failed to boot: ${String(err)}`);
  }
  const reason = err instanceof Error ? err.message : String(err);
  const fix =
    process.platform === "win32"
      ? [
          "# Fix: run under an elevated shell so the embedded PG lab can",
          "# create its unprivileged service account, then re-run.",
        ]
      : [
          "# Fix: run `npm ci` (installs the @embedded-postgres binaries)",
          "# as a non-root user, then re-run.",
        ];
  console.warn(
    [
      "",
      "############################################################",
      ...banner,
      `# Reason: ${reason}`,
      ...fix,
      "# Set PGLAB_REQUIRED=1 to make this a hard failure, not a skip.",
      "############################################################",
      "",
    ].join("\n"),
  );
  return false;
}

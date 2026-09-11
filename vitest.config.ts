import { defineConfig } from "vitest/config";
import path from "node:path";

// `npm test`        — real-PostgreSQL suites skip if the lab cannot boot.
// `npm run test:pg` — same suites, but a lab boot failure FAILS the run.
//                     This is what CI uses: a skip there would mean RLS,
//                     Segregation of Duties, split immutability and the
//                     concurrency/lock-ordering guarantees all ship
//                     unverified while the build still reports green.
//                     See tests/integration/real-pg-boot.ts.
export default defineConfig(({ mode }) => ({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: mode === "pg" ? { PGLAB_REQUIRED: "1" } : {},
    // Test files must not run in parallel: on Windows, PgLab registers its
    // embedded PostgreSQL under a fixed service name, and one lab's
    // cleanupLeftovers() would stop the other lab's service mid-run. The POSIX
    // boot path uses a unique data directory per instance and has no such
    // collision, but one serialization policy keeps behavior identical
    // everywhere.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

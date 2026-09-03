import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Test files must not run in parallel: phase2b-real-pg-concurrency and
    // execute-confirmed-financial-action.real-pg each boot a PgLab embedded
    // PostgreSQL on a fixed Windows service name, and one lab's
    // cleanupLeftovers() would stop the other lab's service mid-run.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

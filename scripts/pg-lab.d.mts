/**
 * Minimal type declarations for scripts/pg-lab.mjs (the real-PostgreSQL lab
 * harness). Exposed so TypeScript consumers (tests) stay type-safe under
 * `tsc --noEmit`.
 */
import type { Client } from "pg";

export interface PgLabOptions {
  migrationsDir?: string;
}

export class PgLab {
  constructor();
  port: number | null;
  client: Client | null;
  migrationsApplied: string[];
  start(options?: PgLabOptions): Promise<this>;
  asUser<T>(userId: string, role: string | "authenticated" | "service_role", fn: () => Promise<T>): Promise<T>;
  stop(): Promise<void>;
}

export const LAB_PASSWORD: string;
export function applySqlFile(client: Client, file: string): Promise<void>;

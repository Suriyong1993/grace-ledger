/**
 * Minimal type declarations for scripts/pg-lab-linux.mjs (the real-PostgreSQL
 * lab harness for Linux/CI). Mirrors scripts/pg-lab.d.mts so TypeScript
 * consumers (tests) stay type-safe under `tsc --noEmit`.
 */
import type { Client } from "pg";

export interface PgLabLinuxOptions {
  migrationsDir?: string;
}

export class PgLabLinux {
  constructor();
  client: Client;
  migrationsApplied: string[];
  start(options?: PgLabLinuxOptions): Promise<this>;
  openRawClient(): Promise<Client>;
  asUser<T>(
    userId: string,
    role: string | "authenticated" | "service_role",
    fn: (client: Client) => Promise<T>,
    client?: Client,
  ): Promise<T>;
  stop(): Promise<void>;
}

/** True when the embedded PostgreSQL binaries can run on this host. */
export function pgLabAvailable(): Promise<boolean>;

export const MIGRATIONS_DIR: string;

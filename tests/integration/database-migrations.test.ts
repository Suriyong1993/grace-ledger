import { describe, it, expect, beforeEach } from "vitest";
import { newDb, IMemoryDb, DataType } from "pg-mem";
import fs from "node:fs";
import path from "node:path";

/**
 * [DATABASE SIMULATION TEST SUITE]
 * NOTE: These tests execute against pg-mem (in-memory PostgreSQL AST parser and memory engine).
 * They validate SQL syntax, table definition, NOT NULL constraints, and basic CHECK constraints in emulation.
 * They DO NOT substitute for real PostgreSQL / Supabase integration testing (RLS, SECURITY DEFINER, FOR UPDATE locks).
 */
describe("Database Simulation Tests (pg-mem In-Memory Engine)", () => {
  let db: IMemoryDb;

  function loadMigrationSql(filename: string): string {
    const migrationPath = path.resolve(__dirname, "../../supabase/migrations", filename);
    let sql = fs.readFileSync(migrationPath, "utf-8");
    // Strip extension declarations for pg-mem compatibility
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS [^;]+;/gi, "-- [Extension Mocked in Simulation]");
    
    // Transform DO $$ BEGIN CREATE TYPE ... END $$ to direct CREATE TYPE for pg-mem
    sql = sql.replace(/DO \$\$ BEGIN\s+(CREATE TYPE [^;]+;)\s+EXCEPTION WHEN duplicate_object THEN null;\s+END \$\$;/gi, "$1");
    
    return sql;
  }

  beforeEach(() => {
    db = newDb();

    // Register PostgreSQL native helper functions for pg-mem emulator
    db.public.registerFunction({
      name: "gen_random_uuid",
      implementation: () => "a0000000-0000-0000-0000-000000000001",
    });

    db.public.registerFunction({
      name: "trim",
      args: [DataType.text],
      returns: DataType.text,
      implementation: (str: string) => (str ? str.trim() : ""),
    });

    db.public.registerFunction({
      name: "length",
      args: [DataType.text],
      returns: DataType.integer,
      implementation: (str: string) => (str ? str.length : 0),
    });

    db.registerLanguage("plpgsql", () => () => {});
  });

  it("Simulation: parses and executes Migration 001 (Core Schema)", () => {
    const sql001 = loadMigrationSql("20260817000001_core_schema.sql");

    // Execute migration in pg-mem
    expect(() => db.public.none(sql001)).not.toThrow();

    // Verify tables exist
    const tables = db.public.many(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tableNames = tables.map((t: any) => t.table_name);

    expect(tableNames).toContain("churches");
    expect(tableNames).toContain("profiles");
    expect(tableNames).toContain("user_roles");
    expect(tableNames).toContain("accounts");
    expect(tableNames).toContain("funds");
    expect(tableNames).toContain("categories");
    expect(tableNames).toContain("transactions");
    expect(tableNames).toContain("transaction_splits");
    expect(tableNames).toContain("fund_transfers");
    expect(tableNames).toContain("offering_sessions");
    expect(tableNames).toContain("members");
    expect(tableNames).toContain("member_giving_records");
    expect(tableNames).toContain("audit_logs");
  });

  it("Simulation: enforces NUMERIC(14,2) precision and positive amounts on transactions", () => {
    const sql001 = loadMigrationSql("20260817000001_core_schema.sql");
    db.public.none(sql001);

    // Create a church and account with valid hex UUIDs
    db.public.none(`
      INSERT INTO churches (id, name) VALUES ('c0000000-0000-0000-0000-000000000001', 'Grace Church');
      INSERT INTO profiles (id, church_id, email, full_name) 
      VALUES ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'treasurer@grace.org', 'Somchai');
      INSERT INTO accounts (id, church_id, name, type, current_balance)
      VALUES ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Main KBank', 'bank', 100000.00);
    `);

    // Valid insert
    expect(() => {
      db.public.none(`
        INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by)
        VALUES ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 18450.50, 'income', 'draft', 'Sunday Offering', 'e0000000-0000-0000-0000-000000000001');
      `);
    }).not.toThrow();

    // Amount <= 0 must fail CHECK constraint
    expect(() => {
      db.public.none(`
        INSERT INTO transactions (id, church_id, account_id, amount, direction, status, description, created_by)
        VALUES ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', -500.00, 'expense', 'draft', 'Invalid Negative', 'e0000000-0000-0000-0000-000000000001');
      `);
    }).toThrow();
  });

  it("Simulation: enforces fund_id NOT NULL constraint on transaction_splits", () => {
    const sql001 = loadMigrationSql("20260817000001_core_schema.sql");
    db.public.none(sql001);

    db.public.none(`
      INSERT INTO churches (id, name) VALUES ('c0000000-0000-0000-0000-000000000001', 'Grace Church');
      INSERT INTO profiles (id, church_id, email, full_name) 
      VALUES ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'staff@grace.org', 'Staff');
      INSERT INTO accounts (id, church_id, name)
      VALUES ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Cash');
      INSERT INTO funds (id, church_id, name)
      VALUES ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'General Fund');
      INSERT INTO transactions (id, church_id, account_id, amount, direction, description, created_by)
      VALUES ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 5000.00, 'income', 'Tithe', 'e0000000-0000-0000-0000-000000000001');
    `);

    // Valid split with fund_id
    expect(() => {
      db.public.none(`
        INSERT INTO transaction_splits (id, transaction_id, church_id, fund_id, amount)
        VALUES ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 5000.00);
      `);
    }).not.toThrow();

    // Invalid split with NULL fund_id must be rejected by PostgreSQL constraint
    expect(() => {
      db.public.none(`
        INSERT INTO transaction_splits (id, transaction_id, church_id, fund_id, amount)
        VALUES ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', NULL, 5000.00);
      `);
    }).toThrow();
  });

  it("Simulation: enforces transfer between different funds only (CHECK constraint)", () => {
    const sql001 = loadMigrationSql("20260817000001_core_schema.sql");
    db.public.none(sql001);

    db.public.none(`
      INSERT INTO churches (id, name) VALUES ('c0000000-0000-0000-0000-000000000001', 'Grace Church');
      INSERT INTO profiles (id, church_id, email, full_name) 
      VALUES ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'treasurer@grace.org', 'Treasurer');
      INSERT INTO funds (id, church_id, name)
      VALUES ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'General Fund');
    `);

    // Transfer to the SAME fund must fail CHECK (from_fund_id <> to_fund_id)
    expect(() => {
      db.public.none(`
        INSERT INTO fund_transfers (id, church_id, from_fund_id, to_fund_id, amount, created_by)
        VALUES ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 1000.00, 'e0000000-0000-0000-0000-000000000001');
      `);
    }).toThrow();
  });
});

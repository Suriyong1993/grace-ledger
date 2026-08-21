import { describe, it, expect, beforeEach } from "vitest";
import { newDb, IMemoryDb, DataType } from "pg-mem";
import fs from "node:fs";
import path from "node:path";

/**
 * Migration 013 reverts offering_session_items.category_id to nullable.
 *
 * Migration 010 declared it NOT NULL. No layer of the app was ever updated to
 * collect a category on a Sunday Offering item, and no church seeds a default
 * category — so create_offering_session always failed with a Postgres 23502
 * NOT NULL violation for every real submission. Found via a real-browser
 * end-to-end login + create-session run; the Node-side integration scripts
 * never caught it because they insert rows directly and always supply a
 * category_id, which is not how the real RPC is ever called from the UI.
 *
 * pg-mem cannot parse migration 010 in full — it uses
 * `ALTER COLUMN status TYPE TEXT USING status::TEXT`, and pg-mem's parser
 * does not support the USING clause on ALTER COLUMN TYPE (a pg-mem gap, not a
 * real SQL error; the existing migration test suite avoids this the same way,
 * by never loading migration 010 either). This test reproduces the exact
 * `offering_session_items` column set migration 010 defines, then applies the
 * real migration 013 file — so the fix itself is verified as real, executable
 * SQL, only the unrelated 010 noise is stood in for.
 */
describe("Migration 013 — offering_session_items.category_id nullable", () => {
  let db: IMemoryDb;

  function loadMigrationSql(filename: string): string {
    const migrationPath = path.resolve(__dirname, "../../supabase/migrations", filename);
    let sql = fs.readFileSync(migrationPath, "utf-8");
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS [^;]+;/gi, "-- [Extension Mocked in Simulation]");
    sql = sql.replace(
      /DO \$\$ BEGIN\s+(CREATE TYPE [^;]+;)\s+EXCEPTION WHEN duplicate_object THEN null;\s+END \$\$;/gi,
      "$1"
    );
    return sql;
  }

  beforeEach(() => {
    db = newDb();
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

    db.public.none(loadMigrationSql("20260817000001_core_schema.sql"));

    // The exact offering_session_items shape from migration 010, minus the
    // unrelated offering_sessions ALTERs that pg-mem's parser rejects.
    db.public.none(`
      CREATE TABLE offering_session_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        offering_session_id UUID NOT NULL REFERENCES offering_sessions(id) ON DELETE CASCADE,
        church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
        fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
        category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        payment_channel TEXT NOT NULL DEFAULT 'cash' CHECK (payment_channel IN ('cash', 'bank_transfer', 'qr_code', 'other')),
        source_type TEXT NOT NULL DEFAULT 'envelopes' CHECK (source_type IN ('envelopes', 'bags', 'manual_aggregate', 'electronic_slip')),
        amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    db.public.none(`
      INSERT INTO churches (id, name) VALUES ('c0000000-0000-0000-0000-000000000001', 'Grace Church');
      INSERT INTO profiles (id, church_id, email, full_name)
      VALUES ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'somchai_pastor@grace.org', 'Somchai');
      INSERT INTO funds (id, church_id, name)
      VALUES ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'General Fund');
      INSERT INTO offering_sessions (id, church_id, service_date, created_by)
      VALUES ('50000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-08-23', 'e0000000-0000-0000-0000-000000000001');
    `);
  });

  it("(pre-fix) reproduces the real 23502 failure: category_id NOT NULL blocks every real submission", () => {
    // This is the exact shape create_offering_session inserts: fund + channel
    // + amount, no category — because the client never sends one.
    expect(() => {
      db.public.none(`
        INSERT INTO offering_session_items (id, offering_session_id, church_id, fund_id, payment_channel, source_type, amount)
        VALUES ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'cash', 'envelopes', 1000.00);
      `);
    }).toThrow();
  });

  it("(post-fix) applying migration 013 lets the same insert succeed", () => {
    db.public.none(loadMigrationSql("20260821000013_offering_session_items_category_nullable.sql"));

    expect(() => {
      db.public.none(`
        INSERT INTO offering_session_items (id, offering_session_id, church_id, fund_id, payment_channel, source_type, amount)
        VALUES ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'cash', 'envelopes', 1000.00);
      `);
    }).not.toThrow();

    const row = db.public.one(
      "SELECT category_id FROM offering_session_items WHERE id = '10000000-0000-0000-0000-000000000001'"
    );
    expect(row.category_id).toBeNull();
  });

  it("a category is still accepted and stored when one is provided", () => {
    db.public.none(loadMigrationSql("20260821000013_offering_session_items_category_nullable.sql"));
    db.public.none(`
      INSERT INTO categories (id, church_id, name, direction) VALUES
        ('90000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Tithe', 'income');
    `);

    db.public.none(`
      INSERT INTO offering_session_items (id, offering_session_id, church_id, fund_id, category_id, payment_channel, source_type, amount)
      VALUES ('10000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'cash', 'envelopes', 500.00);
    `);

    const row = db.public.one(
      "SELECT category_id FROM offering_session_items WHERE id = '10000000-0000-0000-0000-000000000002'"
    );
    expect(row.category_id).toBe("90000000-0000-0000-0000-000000000001");
  });
});

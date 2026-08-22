import { describe, it, expect, beforeEach } from "vitest";
import { newDb, IMemoryDb, DataType } from "pg-mem";
import fs from "node:fs";
import path from "node:path";
import {
  canonicalizeJson,
  computeCanonicalPayloadHash,
  generateIdempotencyKey,
  executeWithIdempotency,
} from "../../src/lib/transactions/idempotency";

describe("Idempotency Engine — Unit, Integration & Concurrency Tests", () => {
  const churchA = "00000000-0000-0000-0000-000000000001";
  const churchB = "00000000-0000-0000-0000-000000000002";
  const user1 = "00000000-0000-0000-0000-000000000011";
  const user2 = "00000000-0000-0000-0000-000000000012";

  describe("1. Canonical Hashing & Deterministic Payload Binding", () => {
    it("produces identical canonical string regardless of object key order", () => {
      const obj1 = { amount: "1000.00", fund_id: "f-1", description: "Sunday" };
      const obj2 = { description: "Sunday", amount: "1000.00", fund_id: "f-1" };

      expect(canonicalizeJson(obj1)).toBe(canonicalizeJson(obj2));
    });

    it("computes identical SHA-256 hash for identical data structures with different key orders", async () => {
      const payload1 = {
        church_id: churchA,
        amount: 5000,
        splits: [{ fund_id: "f-1", amount: 3000 }, { fund_id: "f-2", amount: 2000 }],
      };
      const payload2 = {
        splits: [{ amount: 3000, fund_id: "f-1" }, { amount: 2000, fund_id: "f-2" }],
        amount: 5000,
        church_id: churchA,
      };

      const hash1 = await computeCanonicalPayloadHash(payload1);
      const hash2 = await computeCanonicalPayloadHash(payload2);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it("generates unique idempotency keys with default and custom prefixes", () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey("transfer");

      expect(key1).toMatch(/^fin_/);
      expect(key2).toMatch(/^transfer_/);
      expect(key1).not.toBe(key2);
    });
  });

  describe("2. Server/Database Idempotency Execution Semantics (Option A: User-Isolated Scope)", () => {
    it("Scenario: Same Church + Same User + Same Key + Same Payload -> Exactly ONE Mutation, returns replayed result", async () => {
      let mutationCount = 0;
      const idempotencyDb = new Map<string, any>();

      const mockSupabase = {
        rpc: (fn: string, args: any) => {
          if (fn === "acquire_idempotency_record") {
            const dbKey = `${args.p_church_id}:${user1}:${args.p_idempotency_key}`;
            const existing = idempotencyDb.get(dbKey);
            if (existing) {
              if (existing.payload_hash !== args.p_payload_hash) {
                return Promise.resolve({
                  data: null,
                  error: { message: "Idempotency Conflict: Same idempotency key used with different payload", code: "P0001" },
                });
              }
              if (existing.status === "completed") {
                return Promise.resolve({
                  data: {
                    action: "replay",
                    is_replay: true,
                    response_body: existing.response_body,
                    resource_id: existing.resource_id,
                  },
                  error: null,
                });
              }
            }
            idempotencyDb.set(dbKey, {
              status: "started",
              payload_hash: args.p_payload_hash,
              operation: args.p_operation,
            });
            return Promise.resolve({
              data: { action: "execute", idempotency_key: args.p_idempotency_key },
              error: null,
            });
          }
          if (fn === "complete_idempotency_record") {
            const dbKey = `${args.p_church_id}:${user1}:${args.p_idempotency_key}`;
            const existing = idempotencyDb.get(dbKey);
            if (existing) {
              existing.status = "completed";
              existing.response_body = args.p_response_body;
              existing.resource_id = args.p_resource_id;
            }
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      const payload = { from_fund_id: "f-1", to_fund_id: "f-2", amount: "5000.00" };
      const sharedKey = "idem_key_unique_001";

      // First Request
      const res1 = await executeWithIdempotency(
        mockSupabase,
        {
          churchId: churchA,
          idempotencyKey: sharedKey,
          operation: "transfer_funds",
          payload,
        },
        async () => {
          mutationCount++;
          return { data: { transfer_id: "tx-real-123", status: "completed" }, resource_id: "tx-real-123" };
        }
      );

      // Duplicate Request with identical payload
      const res2 = await executeWithIdempotency(
        mockSupabase,
        {
          churchId: churchA,
          idempotencyKey: sharedKey,
          operation: "transfer_funds",
          payload,
        },
        async () => {
          mutationCount++;
          return { data: { transfer_id: "tx-duplicate-999", status: "completed" } };
        }
      );

      expect(res1.success).toBe(true);
      expect(res1.is_replay).toBe(false);
      expect(res1.data?.transfer_id).toBe("tx-real-123");

      expect(res2.success).toBe(true);
      expect(res2.is_replay).toBe(true);
      expect(res2.data?.transfer_id).toBe("tx-real-123");
      expect(mutationCount).toBe(1);
    });

    it("Scenario: Different Church + Same Key -> Isolated per tenant", async () => {
      let countA = 0;
      let countB = 0;
      const idempotencyDb = new Map<string, any>();

      const mockSupabase = {
        rpc: (fn: string, args: any) => {
          if (fn === "acquire_idempotency_record") {
            const dbKey = `${args.p_church_id}:${user1}:${args.p_idempotency_key}`;
            idempotencyDb.set(dbKey, { status: "started", payload_hash: args.p_payload_hash });
            return Promise.resolve({ data: { action: "execute" }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      const sharedKey = "idem_cross_tenant_100";

      const resA = await executeWithIdempotency(
        mockSupabase,
        { churchId: churchA, idempotencyKey: sharedKey, operation: "transfer", payload: { a: 1 } },
        async () => { countA++; return { data: { id: "a" } }; }
      );

      const resB = await executeWithIdempotency(
        mockSupabase,
        { churchId: churchB, idempotencyKey: sharedKey, operation: "transfer", payload: { b: 2 } },
        async () => { countB++; return { data: { id: "b" } }; }
      );

      expect(resA.success).toBe(true);
      expect(resB.success).toBe(true);
      expect(countA).toBe(1);
      expect(countB).toBe(1);
      expect(idempotencyDb.has(`${churchA}:${user1}:${sharedKey}`)).toBe(true);
      expect(idempotencyDb.has(`${churchB}:${user1}:${sharedKey}`)).toBe(true);
    });

    it("Scenario: Option A Cross-User Isolation (User 1 & User 2 using same key are isolated)", async () => {
      const idempotencyDb = new Map<string, any>();
      let currentUser = user1;

      const mockSupabase = {
        rpc: (fn: string, args: any) => {
          if (fn === "acquire_idempotency_record") {
            const dbKey = `${args.p_church_id}:${currentUser}:${args.p_idempotency_key}`;
            const existing = idempotencyDb.get(dbKey);
            if (existing && existing.status === "completed") {
              return Promise.resolve({
                data: { action: "replay", is_replay: true, response_body: existing.response_body },
                error: null,
              });
            }
            idempotencyDb.set(dbKey, { status: "started", payload_hash: args.p_payload_hash });
            return Promise.resolve({ data: { action: "execute" }, error: null });
          }
          if (fn === "complete_idempotency_record") {
            const dbKey = `${args.p_church_id}:${currentUser}:${args.p_idempotency_key}`;
            const existing = idempotencyDb.get(dbKey);
            if (existing) {
              existing.status = "completed";
              existing.response_body = args.p_response_body;
            }
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      const sharedKey = "shared_action_key_cross_user";
      const payload = { amount: "5000.00" };

      // User 1 initiates
      currentUser = user1;
      const resUser1 = await executeWithIdempotency(
        mockSupabase,
        { churchId: churchA, idempotencyKey: sharedKey, operation: "post", payload },
        async () => ({ data: { executed_by: user1, secret: "User 1 Private Report" } })
      );

      // User 2 sends same key
      currentUser = user2;
      const resUser2 = await executeWithIdempotency(
        mockSupabase,
        { churchId: churchA, idempotencyKey: sharedKey, operation: "post", payload },
        async () => ({ data: { executed_by: user2, secret: "User 2 Private Report" } })
      );

      expect(resUser1.success).toBe(true);
      expect(resUser1.data?.executed_by).toBe(user1);
      expect(resUser2.success).toBe(true);
      expect(resUser2.data?.executed_by).toBe(user2);
      expect(resUser2.data?.secret).toBe("User 2 Private Report");
    });

    it("Scenario: In-Flight Concurrency Protection -> Concurrent request while 'started' is rejected (40001)", async () => {
      const idempotencyDb = new Map<string, any>();
      const dbKey = `${churchA}:${user1}:idem_concurrent_01`;
      idempotencyDb.set(dbKey, {
        status: "started",
        payload_hash: "same_hash",
        operation: "transfer_funds",
      });

      const mockSupabase = {
        rpc: (fn: string, args: any) => {
          if (fn === "acquire_idempotency_record") {
            const existing = idempotencyDb.get(`${args.p_church_id}:${user1}:${args.p_idempotency_key}`);
            if (existing && existing.status === "started") {
              return Promise.resolve({
                data: null,
                error: { message: "Concurrent Request: An identical request with this idempotency key is currently processing", code: "40001" },
              });
            }
            return Promise.resolve({ data: { action: "execute" }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      let mutationExecuted = false;
      const res = await executeWithIdempotency(
        mockSupabase,
        {
          churchId: churchA,
          idempotencyKey: "idem_concurrent_01",
          operation: "transfer_funds",
          payload: { test: true },
        },
        async () => {
          mutationExecuted = true;
          return { data: { ok: true } };
        }
      );

      expect(res.success).toBe(false);
      expect(res.code).toBe("40001");
      expect(res.error).toContain("Concurrent Request");
      expect(mutationExecuted).toBe(false); // Zero duplicate mutation executed!
    });

    it("Scenario: Mutation failure -> Calls mark_idempotency_failed and allows clean retry", async () => {
      let attemptCount = 0;
      let currentStatus = "not_started";

      const mockSupabase = {
        rpc: (fn: string) => {
          if (fn === "acquire_idempotency_record") {
            if (currentStatus === "failed" || currentStatus === "not_started") {
              currentStatus = "started";
              return Promise.resolve({ data: { action: "execute" }, error: null });
            }
            return Promise.resolve({ data: null, error: { message: "Concurrent", code: "40001" } });
          }
          if (fn === "mark_idempotency_failed") {
            currentStatus = "failed";
            return Promise.resolve({ data: null, error: null });
          }
          if (fn === "complete_idempotency_record") {
            currentStatus = "completed";
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      // 1. First Attempt Fails
      const res1 = await executeWithIdempotency(
        mockSupabase,
        {
          churchId: churchA,
          idempotencyKey: "retry_key_003",
          operation: "post_transaction",
          payload: { transaction_id: "t-1" },
        },
        async () => {
          attemptCount++;
          throw new Error("Insufficient Funds / Database Exception");
        }
      );

      expect(res1.success).toBe(false);
      expect(currentStatus).toBe("failed"); // Explicitly marked as failed in DB

      // 2. Retry Attempt Succeeds immediately with the same key
      const res2 = await executeWithIdempotency(
        mockSupabase,
        {
          churchId: churchA,
          idempotencyKey: "retry_key_003",
          operation: "post_transaction",
          payload: { transaction_id: "t-1" },
        },
        async () => {
          attemptCount++;
          return { data: { posted: true } };
        }
      );

      expect(res2.success).toBe(true);
      expect(currentStatus).toBe("completed");
      expect(attemptCount).toBe(2);
    });
  });

  describe("3. In-Memory Database Schema & Migration 014 Verification (pg-mem)", () => {
    let db: IMemoryDb;

    function loadMigrationSql(filename: string): string {
      const migrationPath = path.resolve(__dirname, "../../supabase/migrations", filename);
      let sql = fs.readFileSync(migrationPath, "utf-8");
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS [^;]+;/gi, "-- [Mocked]");
      sql = sql.replace(/DO \$\$[\s\S]*?(CREATE TYPE [^;]+;)[\s\S]*?END \$\$;/gi, "$1");
      sql = sql.replace(/ALTER TABLE [^\n]+ ENABLE ROW LEVEL SECURITY;/gi, "-- [RLS]");
      sql = sql.replace(/CREATE POLICY [^;]+;/gis, "-- [Policy]");
      sql = sql.replace(/CREATE OR REPLACE FUNCTION [^$]+\$\$[^$]+\$\$;/gis, "-- [Function]");
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

      const sql001 = loadMigrationSql("20260817000001_core_schema.sql");
      db.public.none(sql001);
    });

    it("Simulation: parses and executes Migration 014 successfully", () => {
      const sql014 = loadMigrationSql("20260821000014_idempotency_and_action_confirmations.sql");

      expect(() => db.public.none(sql014)).not.toThrow();

      const tables = db.public.many(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      );
      const tableNames = tables.map((t: any) => t.table_name);
      expect(tableNames).toContain("idempotency_keys");
    });

    it("Simulation: enforces Option A UNIQUE(church_id, user_id, idempotency_key) constraint in database", () => {
      const sql014 = loadMigrationSql("20260821000014_idempotency_and_action_confirmations.sql");
      db.public.none(sql014);

      db.public.none(`
        INSERT INTO churches (id, name) VALUES ('c0000000-0000-0000-0000-000000000001', 'Grace Church A');
        INSERT INTO profiles (id, church_id, email, full_name) 
        VALUES 
          ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'treasurer@grace.org', 'Treasurer'),
          ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'staff@grace.org', 'Staff');
      `);

      // 1. User 1 insert with key 'idem_unique_test'
      expect(() => {
        db.public.none(`
          INSERT INTO idempotency_keys (id, church_id, user_id, idempotency_key, operation, payload_hash, status)
          VALUES (
            'd0000000-0000-0000-0000-000000000001',
            'c0000000-0000-0000-0000-000000000001',
            'e0000000-0000-0000-0000-000000000001',
            'idem_unique_test',
            'transfer_funds',
            'abc123hash',
            'started'
          );
        `);
      }).not.toThrow();

      // 2. User 2 with same key in same church succeeds (Option A isolation)
      expect(() => {
        db.public.none(`
          INSERT INTO idempotency_keys (id, church_id, user_id, idempotency_key, operation, payload_hash, status)
          VALUES (
            'd0000000-0000-0000-0000-000000000002',
            'c0000000-0000-0000-0000-000000000001',
            'e0000000-0000-0000-0000-000000000002',
            'idem_unique_test',
            'transfer_funds',
            'abc123hash',
            'started'
          );
        `);
      }).not.toThrow();

      // 3. User 1 with SAME key again must fail UNIQUE constraint
      expect(() => {
        db.public.none(`
          INSERT INTO idempotency_keys (id, church_id, user_id, idempotency_key, operation, payload_hash, status)
          VALUES (
            'd0000000-0000-0000-0000-000000000003',
            'c0000000-0000-0000-0000-000000000001',
            'e0000000-0000-0000-0000-000000000001',
            'idem_unique_test',
            'transfer_funds',
            'abc123hash',
            'started'
          );
        `);
      }).toThrow();
    });
  });
});

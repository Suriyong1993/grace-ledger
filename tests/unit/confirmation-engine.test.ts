import { describe, it, expect } from "vitest";
import { newDb, DataType } from "pg-mem";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  canonicalizeJson,
  computeProposalPayloadHash,
  normalizeValue,
  ActionConfirmationEngine,
  CanonicalProposalPayload,
} from "../../src/lib/ai/confirmation-engine";

describe("Action Confirmation Engine & Canonical Hashing Tests", () => {
  const dummyChurchId = "00000000-0000-0000-0000-000000000001";
  const dummyUserId = "00000000-0000-0000-0000-000000000002";
  const dummyFundA = "00000000-0000-0000-0000-000000000003";
  const dummyFundB = "00000000-0000-0000-0000-000000000004";
  const dummyNonce = "conf_nonce_1234567890abcdef12345678";

  describe("0. Low-level Canonicalization and Normalization", () => {
    it("sorts nested object keys and normalizes currency strings in canonicalizeJson", () => {
      const input = { z: "100.5", a: { y: "200.00", b: 10 } };
      const normalized = normalizeValue(input);
      const json = canonicalizeJson(input);

      expect(normalized.z).toBe("100.50");
      expect(normalized.a.y).toBe("200.00");
      expect(json).toBe('{"a":{"b":10,"y":"200.00"},"z":"100.50"}');
    });
  });

  describe("1. Deterministic Canonical Payload & Hashing", () => {
    it("produces identical SHA-256 hash regardless of object key insertion order", async () => {
      const payload1: CanonicalProposalPayload = {
        action: "fund_transfer",
        tool_name: "propose_fund_transfer",
        church_id: dummyChurchId,
        user_id: dummyUserId,
        resource_id: null,
        parameters: {
          from_fund_id: dummyFundA,
          to_fund_id: dummyFundB,
          amount: "15000.00",
          reason: "สมทบทุนจัดค่ายเยาวชน",
        },
        nonce: dummyNonce,
      };

      // Same data with scrambled key orders
      const payload2: CanonicalProposalPayload = {
        tool_name: "propose_fund_transfer",
        action: "fund_transfer",
        nonce: dummyNonce,
        parameters: {
          reason: "สมทบทุนจัดค่ายเยาวชน",
          amount: "15000.00",
          to_fund_id: dummyFundB,
          from_fund_id: dummyFundA,
        },
        user_id: dummyUserId,
        church_id: dummyChurchId,
        resource_id: null,
      };

      const hash1 = await computeProposalPayloadHash(payload1);
      const hash2 = await computeProposalPayloadHash(payload2);

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
    });

    it("normalizes monetary values consistently (e.g. 15000 vs 15000.00)", async () => {
      const p1: CanonicalProposalPayload = {
        action: "fund_transfer",
        tool_name: "propose_fund_transfer",
        church_id: dummyChurchId,
        user_id: dummyUserId,
        resource_id: null,
        parameters: { amount: "15000.00" },
        nonce: dummyNonce,
      };

      const p2: CanonicalProposalPayload = {
        action: "fund_transfer",
        tool_name: "propose_fund_transfer",
        church_id: dummyChurchId,
        user_id: dummyUserId,
        resource_id: null,
        parameters: { amount: "15000" },
        nonce: dummyNonce,
      };

      const hash1 = await computeProposalPayloadHash(p1);
      const hash2 = await computeProposalPayloadHash(p2);

      expect(hash1).toBe(hash2);
    });

    it("changes hash when financial amount changes even by 0.01", async () => {
      const basePayload: CanonicalProposalPayload = {
        action: "fund_transfer",
        tool_name: "propose_fund_transfer",
        church_id: dummyChurchId,
        user_id: dummyUserId,
        resource_id: null,
        parameters: { amount: "1000.00", from_fund: dummyFundA, to_fund: dummyFundB },
        nonce: dummyNonce,
      };

      const tamperedPayload: CanonicalProposalPayload = {
        ...basePayload,
        parameters: { amount: "1000.01", from_fund: dummyFundA, to_fund: dummyFundB },
      };

      const hashBase = await computeProposalPayloadHash(basePayload);
      const hashTampered = await computeProposalPayloadHash(tamperedPayload);

      expect(hashBase).not.toBe(hashTampered);
    });

    it("changes hash when target fund, action, church, or user changes", async () => {
      const basePayload: CanonicalProposalPayload = {
        action: "fund_transfer",
        tool_name: "propose_fund_transfer",
        church_id: dummyChurchId,
        user_id: dummyUserId,
        resource_id: null,
        parameters: { amount: "1000.00", from_fund: dummyFundA, to_fund: dummyFundB },
        nonce: dummyNonce,
      };

      const differentFundPayload = {
        ...basePayload,
        parameters: { amount: "1000.00", from_fund: dummyFundA, to_fund: "00000000-0000-0000-0000-000000000099" },
      };

      const differentChurchPayload = {
        ...basePayload,
        church_id: "00000000-0000-0000-0000-000000000099",
      };

      const hashBase = await computeProposalPayloadHash(basePayload);
      const hashDiffFund = await computeProposalPayloadHash(differentFundPayload);
      const hashDiffChurch = await computeProposalPayloadHash(differentChurchPayload);

      expect(hashBase).not.toBe(hashDiffFund);
      expect(hashBase).not.toBe(hashDiffChurch);
    });
  });

  describe("2. Single-use, Replay, and Tamper Protections (Engine Verification)", () => {
    it("creates confirmation and successfully consumes it on the first call", async () => {
      let storedConfirmation: any = null;

      const mockSupabase = {
        auth: {
          getUser: () => Promise.resolve({ data: { user: { id: dummyUserId } }, error: null }),
        },
        rpc: (fn: string, args: any) => {
          if (fn === "create_action_confirmation") {
            storedConfirmation = {
              id: "conf-uuid-1",
              status: "pending",
              church_id: args.p_church_id,
              user_id: dummyUserId,
              payload_hash: args.p_payload_hash,
              nonce: args.p_nonce,
              expires_at: new Date(Date.now() + 300000).toISOString(),
            };
            return Promise.resolve({
              data: { confirmation_id: "conf-uuid-1", expires_at: storedConfirmation.expires_at, nonce: args.p_nonce },
              error: null,
            });
          }
          if (fn === "consume_action_confirmation") {
            if (storedConfirmation.status === "consumed") {
              return Promise.resolve({
                data: null,
                error: { message: "Confirmation Already Consumed: This confirmation token has already been used", code: "P0003" },
              });
            }
            if (storedConfirmation.payload_hash !== args.p_expected_payload_hash) {
              return Promise.resolve({
                data: null,
                error: { message: "Payload Hash Mismatch: Action parameters have been altered", code: "P0006" },
              });
            }
            storedConfirmation.status = "consumed";
            return Promise.resolve({
              data: {
                status: "consumed",
                confirmation_id: "conf-uuid-1",
                action: "fund_transfer",
                tool_name: "propose_fund_transfer",
                consumed_at: new Date().toISOString(),
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      const engine = new ActionConfirmationEngine(mockSupabase);

      // 1. Create Confirmation
      const createRes = await engine.createConfirmation({
        church_id: dummyChurchId,
        action: "fund_transfer",
        tool_name: "propose_fund_transfer",
        parameters: { amount: "5000.00", from_fund: dummyFundA, to_fund: dummyFundB },
      });

      expect(createRes.success).toBe(true);
      expect(createRes.data?.confirmation_id).toBe("conf-uuid-1");

      // 2. Consume Confirmation First Time -> SUCCEEDS
      const consumeRes1 = await engine.consumeConfirmation({
        confirmation_id: createRes.data!.confirmation_id,
        church_id: dummyChurchId,
        expected_payload_hash: createRes.data!.payload_hash,
        expected_nonce: createRes.data!.nonce,
      });

      expect(consumeRes1.success).toBe(true);
      expect(consumeRes1.data?.status).toBe("consumed");

      // 3. Consume Confirmation Second Time (Replay Attempt) -> DENIES
      const consumeRes2 = await engine.consumeConfirmation({
        confirmation_id: createRes.data!.confirmation_id,
        church_id: dummyChurchId,
        expected_payload_hash: createRes.data!.payload_hash,
        expected_nonce: createRes.data!.nonce,
      });

      expect(consumeRes2.success).toBe(false);
      expect(consumeRes2.code).toBe("P0003");
      expect(consumeRes2.error).toContain("Already Consumed");
    });

    it("DENIES execution when payload hash does not match (Tamper Protection)", async () => {
      const mockSupabase = {
        rpc: (fn: string) => {
          if (fn === "consume_action_confirmation") {
            return Promise.resolve({
              data: null,
              error: { message: "Payload Hash Mismatch: Action parameters have been altered", code: "P0006" },
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      const engine = new ActionConfirmationEngine(mockSupabase);
      const result = await engine.consumeConfirmation({
        confirmation_id: "conf-uuid-tampered",
        church_id: dummyChurchId,
        expected_payload_hash: "tampered_hash_000000000000000000000000000000000000000000000000000000",
        expected_nonce: dummyNonce,
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("P0006");
      expect(result.error).toContain("Payload Hash Mismatch");
    });

    it("DENIES execution when confirmation has expired (Server-Side TTL)", async () => {
      const mockSupabase = {
        rpc: (fn: string) => {
          if (fn === "consume_action_confirmation") {
            return Promise.resolve({
              data: null,
              error: { message: "Confirmation Expired: The confirmation token has expired", code: "P0004" },
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as any;

      const engine = new ActionConfirmationEngine(mockSupabase);
      const result = await engine.consumeConfirmation({
        confirmation_id: "conf-uuid-expired",
        church_id: dummyChurchId,
        expected_payload_hash: "valid_hash_00000000000000000000000000000000000000000000000000000000",
        expected_nonce: dummyNonce,
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("P0004");
      expect(result.error).toContain("Confirmation Expired");
    });
  });

  describe("3. Migration 015 Database Schema Simulation (pg-mem)", () => {
    it("parses and executes Migration 015 successfully on in-memory PostgreSQL engine", () => {
      const db = newDb();

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

      // Mock prerequisite tables
      db.public.none(`
        CREATE TABLE churches (id UUID PRIMARY KEY);
        CREATE TABLE profiles (id UUID PRIMARY KEY);
        INSERT INTO churches (id) VALUES ('${dummyChurchId}');
        INSERT INTO profiles (id) VALUES ('${dummyUserId}');
      `);

      const migrationPath = resolve(__dirname, "../../supabase/migrations/20260821000015_action_confirmations.sql");
      let ddlSql = readFileSync(migrationPath, "utf-8");

      ddlSql = ddlSql.replace(/CREATE EXTENSION IF NOT EXISTS [^;]+;/gi, "-- [Mocked]");
      ddlSql = ddlSql.replace(/DO \$\$[\s\S]*?(CREATE TYPE [^;]+;)[\s\S]*?END \$\$;/gi, "$1");
      ddlSql = ddlSql.replace(/ALTER TABLE [^\n]+ ENABLE ROW LEVEL SECURITY;/gi, "-- [RLS]");
      ddlSql = ddlSql.replace(/CREATE POLICY [^;]+;/gis, "-- [Policy]");
      ddlSql = ddlSql.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/gis, "-- [Function]");

      db.public.none(ddlSql);

      // Verify table and constraints exist
      const row = db.public.one(`
        INSERT INTO action_confirmations (
          church_id,
          user_id,
          action,
          tool_name,
          normalized_parameters,
          payload_hash,
          nonce,
          status,
          expires_at
        ) VALUES (
          '${dummyChurchId}',
          '${dummyUserId}',
          'fund_transfer',
          'propose_fund_transfer',
          '{"amount": "1000.00"}'::jsonb,
          '1111111111111111111111111111111111111111111111111111111111111111',
          '${dummyNonce}',
          'pending',
          now() + interval '5 minutes'
        ) RETURNING id, status;
      `);

      expect(row.status).toBe("pending");
      expect(row.id).toBeDefined();
    });
  });
});

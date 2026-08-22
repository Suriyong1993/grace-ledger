import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../supabase/types";

/**
 * Deterministically sorts all object keys recursively to produce a canonical JSON string.
 */
export function canonicalizeJson(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalizeJson(item)).join(",") + "]";
  }

  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalizeJson(obj[key])}`
  );
  return "{" + pairs.join(",") + "}";
}

/**
 * Computes a deterministic SHA-256 hex hash from any payload.
 */
export async function computeCanonicalPayloadHash(payload: any): Promise<string> {
  const canonicalString = canonicalizeJson(payload);
  
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Node.js fallback if crypto.subtle is unavailable
  const nodeCrypto = await import("crypto");
  return nodeCrypto.createHash("sha256").update(canonicalString).digest("hex");
}

/**
 * Generates a unique client-side idempotency key
 */
export function generateIdempotencyKey(prefix: string = "fin"): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export interface IdempotencyExecutionResult<T> {
  success: boolean;
  data?: T;
  is_replay?: boolean;
  error?: string;
  code?: string;
}

/**
 * Server/Database-enforced idempotent execution wrapper.
 * Option A Scoped (church_id + user_id + idempotency_key).
 * Exactly-Once execution at the database boundary with explicit error failure marking.
 */
export async function executeWithIdempotency<T>(
  supabase: SupabaseClient<Database>,
  params: {
    churchId: string;
    idempotencyKey: string;
    operation: string;
    payload: any;
  },
  executeFn: () => Promise<{ data: T; resource_id?: string }>
): Promise<IdempotencyExecutionResult<T>> {
  const { churchId, idempotencyKey, operation, payload } = params;

  try {
    const payloadHash = await computeCanonicalPayloadHash(payload);

    // Step 1: Acquire lock / check idempotency record in PostgreSQL
    const { data: acquireData, error: acquireError } = await (supabase.rpc as any)(
      "acquire_idempotency_record",
      {
        p_church_id: churchId,
        p_idempotency_key: idempotencyKey,
        p_operation: operation,
        p_payload_hash: payloadHash,
      }
    );

    if (acquireError) {
      return {
        success: false,
        error: acquireError.message,
        code: acquireError.code || "IDEMPOTENCY_ACQUIRE_ERROR",
      };
    }

    // Step 2: Handle replay (Same church + same user + same key + same payload)
    if (acquireData?.action === "replay" || acquireData?.is_replay) {
      return {
        success: true,
        data: acquireData.response_body as T,
        is_replay: true,
      };
    }

    // Step 3: Execute the financial mutation
    let executionResult: { data: T; resource_id?: string };
    try {
      executionResult = await executeFn();
    } catch (execErr: any) {
      // Step 3b: On mutation failure, explicitly mark idempotency record as 'failed' in DB
      await (supabase.rpc as any)("mark_idempotency_failed", {
        p_church_id: churchId,
        p_idempotency_key: idempotencyKey,
        p_error_message: execErr.message || "Financial mutation failed",
      });
      throw execErr;
    }

    // Step 4: Atomically mark idempotency record as completed in PostgreSQL
    const { error: completeError } = await (supabase.rpc as any)(
      "complete_idempotency_record",
      {
        p_church_id: churchId,
        p_idempotency_key: idempotencyKey,
        p_response_body: executionResult.data,
        p_resource_id: executionResult.resource_id || null,
      }
    );

    if (completeError) {
      console.warn("Failed to complete idempotency record in DB:", completeError.message);
    }

    return {
      success: true,
      data: executionResult.data,
      is_replay: false,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "เกิดข้อผิดพลาดในการดำเนินการ Idempotent Transaction",
      code: err.code || "IDEMPOTENCY_EXECUTION_ERROR",
    };
  }
}

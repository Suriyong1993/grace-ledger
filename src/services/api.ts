/**
 * Grace Ledger v2 — Server API Client
 *
 * HTTP client for communicating with the Grace Ledger API server.
 * All financial mutations go through this client instead of talking
 * directly to Supabase, ensuring business rules, double-entry accounting,
 * and audit logging are enforced server-side.
 *
 * Reads still go directly through Supabase (church.ts) for speed.
 * Writes go through this API client for correctness.
 *
 * Auth: The client automatically attaches the Supabase access_token
 * from the current session as a Bearer token. The server validates
 * this token via verifySupabaseToken().
 */

import { supabase } from "./supabaseClient";

const API_BASE = "/api";

/**
 * Get the current Supabase access token for server authentication.
 */
async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Make an authenticated API request to the server.
 * Automatically attaches the Supabase access token.
 */
async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not authenticated — no Supabase session available");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const err = errBody?.error ?? {};
    throw new ApiClientError(
      err.message ?? `API request failed with status ${res.status}`,
      err.code ?? "API_ERROR",
      res.status,
      err.details,
    );
  }

  return res.json() as Promise<T>;
}

/**
 * Custom error class for API client errors.
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string = "API_ERROR",
    public readonly status: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

// ============================================================================
// Income API
// ============================================================================

export async function apiListIncome(): Promise<unknown[]> {
  return apiRequest("GET", "/income");
}

export async function apiGetIncome(id: string): Promise<unknown> {
  return apiRequest("GET", `/income/${id}`);
}

export async function apiCreateIncome(input: Record<string, unknown>): Promise<unknown> {
  return apiRequest("POST", "/income", input);
}

export async function apiApproveIncome(id: string): Promise<unknown> {
  return apiRequest("POST", `/income/${id}/approve`);
}

export async function apiRejectIncome(id: string, reason: string): Promise<unknown> {
  return apiRequest("POST", `/income/${id}/reject`, { reason });
}

export async function apiDeleteIncome(id: string): Promise<unknown> {
  return apiRequest("DELETE", `/income/${id}`);
}

// ============================================================================
// Expense API
// ============================================================================

export async function apiListExpense(): Promise<unknown[]> {
  return apiRequest("GET", "/expense");
}

export async function apiGetExpense(id: string): Promise<unknown> {
  return apiRequest("GET", `/expense/${id}`);
}

export async function apiCreateExpense(input: Record<string, unknown>): Promise<unknown> {
  return apiRequest("POST", "/expense", input);
}

export async function apiApproveExpense(id: string): Promise<unknown> {
  return apiRequest("POST", `/expense/${id}/approve`);
}

export async function apiRejectExpense(id: string, reason: string): Promise<unknown> {
  return apiRequest("POST", `/expense/${id}/reject`, { reason });
}

export async function apiDeleteExpense(id: string): Promise<unknown> {
  return apiRequest("DELETE", `/expense/${id}`);
}

// ============================================================================
// Budget API
// ============================================================================

export async function apiListBudget(): Promise<unknown[]> {
  return apiRequest("GET", "/budget");
}

export async function apiGetBudget(id: string): Promise<unknown> {
  return apiRequest("GET", `/budget/${id}`);
}

export async function apiCreateBudget(input: Record<string, unknown>): Promise<unknown> {
  return apiRequest("POST", "/budget", input);
}

export async function apiUpdateBudget(
  id: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  return apiRequest("PUT", `/budget/${id}`, input);
}

// ============================================================================
// Offering Financial API
// ============================================================================

export async function apiListOfferingFinancial(): Promise<unknown[]> {
  return apiRequest("GET", "/offering-financial");
}

export async function apiGetOfferingFinancial(id: string): Promise<unknown> {
  return apiRequest("GET", `/offering-financial/${id}`);
}

export async function apiCreateOfferingFinancial(input: Record<string, unknown>): Promise<unknown> {
  return apiRequest("POST", "/offering-financial", input);
}

export async function apiDeleteOfferingFinancial(id: string): Promise<unknown> {
  return apiRequest("DELETE", `/offering-financial/${id}`);
}

// ============================================================================
// Fund API
// ============================================================================

export async function apiListFunds(): Promise<unknown[]> {
  return apiRequest("GET", "/funds");
}

export async function apiCreateFund(input: Record<string, unknown>): Promise<unknown> {
  return apiRequest("POST", "/funds", input);
}

// ============================================================================
// Transfer API
// ============================================================================

export async function apiCreateTransfer(input: Record<string, unknown>): Promise<unknown> {
  return apiRequest("POST", "/transfers", input);
}

// ============================================================================
// Audit API
// ============================================================================

export interface AuditChainVerificationResult {
  valid: boolean;
  entriesChecked: number;
  firstBreakAt?: string;
}

export async function apiVerifyAuditChain(): Promise<AuditChainVerificationResult> {
  return apiRequest<AuditChainVerificationResult>("POST", "/audit/verify");
}

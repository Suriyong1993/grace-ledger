import { z } from "zod";
import { PermissionAction, Resource } from "../rbac";

/**
 * Grace AI has exactly three capabilities. There is no EXECUTE — a tool in
 * this registry can read data, prepare a draft, or prepare a proposal that a
 * human must confirm through the (not-yet-built) server-backed confirmation
 * flow. Nothing here mutates financial state.
 */
export type AiCapability = "READ" | "DRAFT" | "ACTION_PROPOSAL";

/**
 * Every financial number Grace AI surfaces must carry where it came from —
 * never a bare number with no source.
 */
export interface DataProvenance {
  source: string;
  period?: { from: string; to: string } | null;
  generatedAt: string;
  includedCount?: number;
  excludedStates?: string[];
}

export type SensitiveDataClassification = "none" | "giving" | "audit";

export interface AiToolDefinition<Input = unknown> {
  name: string;
  capability: AiCapability;
  description: string;
  /** Zod schema the raw tool-call arguments are validated against before anything else runs. */
  inputSchema: z.ZodType<Input>;
  /** RBAC resource/action this tool is gated on — checked against the caller's real, server-known role. */
  permission: { resource: Resource; action: PermissionAction };
  sensitiveDataClassification: SensitiveDataClassification;
  /** Every tool call is scoped to the caller's own church_id; never accepted as a tool argument. */
  tenantScoped: true;
  auditCategory: string;
}

export interface AiToolCallContext {
  userId: string;
  churchId: string;
  roles: string[];
}

export type AiToolResult<T> =
  | { ok: true; data: T; provenance?: DataProvenance }
  | { ok: false; error: { code: string; message: string } };

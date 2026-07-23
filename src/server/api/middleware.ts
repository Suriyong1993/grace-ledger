/**
 * Grace Ledger v2 — API Middleware
 *
 * Provides session extraction and authorization checks for all API routes.
 * Every authenticated endpoint goes through this middleware.
 */

import type { Session } from "@/server/auth/session";
import { SessionService, SessionValidationError } from "@/server/auth/session";
import type { Permission } from "@/server/auth/permissions";
import { hasPermission } from "@/server/auth/permissions";
import type { UserRole } from "@/server/domain/types";
import { AuditService } from "@/server/services/audit.service";

// ============================================================================
// Request context
// ============================================================================

export interface RequestContext {
  session: Session;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Extract session from request's Authorization header.
 * Returns null if no valid session.
 */
export async function extractSession(request: Request): Promise<Session | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    return await SessionService.validateSession(token);
  } catch (error) {
    if (error instanceof SessionValidationError) {
      return null;
    }
    throw error;
  }
}

/**
 * Require a valid session. Throws 401 if missing.
 */
export async function requireSession(request: Request): Promise<Session> {
  const session = await extractSession(request);
  if (!session) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  }
  return session;
}

/**
 * Require a specific permission. Throws 403 if missing.
 */
export function requirePermission(session: Session, permission: Permission): void {
  if (!hasPermission(session.role, permission)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      `Permission '${permission}' is required`,
    );
  }
}

/**
 * Build a request context from a request.
 */
export async function buildContext(request: Request): Promise<RequestContext> {
  const session = await requireSession(request);
  return {
    session,
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}

/**
 * Build a request context from a raw session (for testing/internal use).
 */
export function buildContextFromSession(
  session: Session,
  ipAddress?: string,
  userAgent?: string,
): RequestContext {
  return { session, ipAddress, userAgent };
}

// ============================================================================
// API Error
// ============================================================================

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ============================================================================
// Response helpers
// ============================================================================

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function errorResponse(status: number, code: string, message: string, details?: unknown): Response {
  return jsonResponse({ error: { code, message, details } }, status);
}

/**
 * Create request context from Authorization header, throwing ApiError on failure.
 * Call at the top of each authenticated route handler.
 */
export async function requireAuth(request: Request): Promise<RequestContext> {
  return buildContext(request);
}

/**
 * Create request context if Authorization header is present, null otherwise.
 * Does NOT throw — use for optional-auth routes.
 */
export async function optionalAuth(request: Request): Promise<RequestContext | null> {
  const session = await extractSession(request);
  if (!session) return null;
  return {
    session,
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}

/**
 * Standard error handling wrapper for route handlers.
 * Catch Zod parse errors, ApiErrors, DomainErrors, and unexpected throws.
 */
export function wrapError(handler: () => Promise<Response>): Promise<Response> {
  return handler().catch((error) => {
    if (error instanceof ApiError) {
      return errorResponse(error.status, error.code, error.message, error.details);
    }
    // Zod validation errors
    if (error && typeof error === "object" && "issues" in (error as any)) {
      return errorResponse(400, "VALIDATION_ERROR", "Input validation failed", (error as any).issues);
    }
    // Domain errors
    if (error && typeof error === "object" && "code" in (error as any) && (error as any).code && !(error as any).status) {
      return errorResponse(400, (error as any).code, (error as any).message);
    }
    console.error("Unhandled API error:", error);
    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred");
  });
}

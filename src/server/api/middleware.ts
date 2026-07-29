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
import { verifySupabaseToken } from "@/server/infrastructure/supabase";

// ============================================================================
// Rate Limiting (in-memory sliding window)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up stale entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (entry.resetAt <= now) rateLimitMap.delete(key);
  }
}, 60_000);

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

/**
 * Simple in-memory sliding window rate limiter.
 * Returns a 429 Response if rate limit exceeded, null otherwise.
 */
export async function rateLimitMiddleware(request: Request): Promise<Response | null> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return new Response(
      JSON.stringify({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
        },
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "retry-after": String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      },
    );
  }

  return null;
}

// ============================================================================
// CSRF Protection (double-submit cookie pattern)
// ============================================================================

import { createHash, randomBytes } from "node:crypto";

const CSRF_COOKIE_NAME = "grace-csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generate a CSRF token and return it as a Set-Cookie header value.
 */
export function generateCsrfToken(): { token: string; cookie: string } {
  const token = randomBytes(32).toString("hex");
  const cookie = `${CSRF_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`;
  return { token, cookie };
}

/**
 * CSRF protection middleware.
 * Validates that the X-CSRF-Token header matches the grace-csrf-token cookie.
 * Skips validation if no cookie is present (e.g., first request — will set cookie on response).
 */
export async function csrfProtectionMiddleware(request: Request): Promise<Response | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = parseCookies(cookieHeader);
  const csrfCookie = cookies[CSRF_COOKIE_NAME];
  const csrfHeader = request.headers.get(CSRF_HEADER_NAME);

  // If no CSRF cookie yet, this is likely the first request — allow through
  // The cookie will be set in the login response
  if (!csrfCookie) return null;

  // If cookie exists but header is missing or doesn't match, reject
  if (!csrfHeader || csrfHeader !== csrfCookie) {
    return new Response(
      JSON.stringify({
        error: {
          code: "CSRF_INVALID",
          message: "Invalid or missing CSRF token",
        },
      }),
      {
        status: 403,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  }

  return null;
}

/**
 * Simple cookie parser.
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const pair of cookieHeader.split(";")) {
    const [key, ...valParts] = pair.trim().split("=");
    if (key) result[key.trim()] = valParts.join("=");
  }
  return result;
}

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
 *
 * Supports TWO authentication methods:
 * 1. Server JWT — validated by SessionService.validateSession()
 * 2. Supabase JWT — validated by verifySupabaseToken() (frontend uses this)
 *
 * The middleware tries server JWT first, then falls back to Supabase JWT.
 * Also updates lastActivityAt for idle timeout enforcement (server JWT only).
 */
export async function extractSession(request: Request): Promise<Session | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);

  // ---------------------------------------------------------------
  // TRY 1: Server JWT (internal sessions via SessionService)
  // ---------------------------------------------------------------
  try {
    const session = await SessionService.validateSession(token);
    // Fire-and-forget — don't block the request
    SessionService.touchSession(session.userId, token).catch(() => {});
    return session;
  } catch {
    // Fall through to Supabase JWT check
  }

  // ---------------------------------------------------------------
  // TRY 2: Supabase JWT (frontend Supabase access_token)
  // ---------------------------------------------------------------
  try {
    const authContext = await verifySupabaseToken(token);
    if (authContext) {
      // Build a Session-compatible object from Supabase auth context
      return {
        userId: authContext.userId,
        role: authContext.role as UserRole,
        churchId: authContext.churchId,
        name: authContext.name,
        mustChangePassword: false,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      } as Session;
    }
  } catch {
    // Fall through — return null
  }

  return null;
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
    throw new ApiError(403, "FORBIDDEN", `Permission '${permission}' is required`);
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

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
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
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Input validation failed",
        (error as any).issues,
      );
    }
    // Domain errors
    if (
      error &&
      typeof error === "object" &&
      "code" in (error as any) &&
      (error as any).code &&
      !(error as any).status
    ) {
      return errorResponse(400, (error as any).code, (error as any).message);
    }
    console.error("Unhandled API error:", error);
    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred");
  });
}

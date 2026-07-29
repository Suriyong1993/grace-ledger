/**
 * Grace Ledger v2 — Income API Routes (Thin Wrapper)
 *
 * Delegates all business logic to IncomeService.
 * No inline business rules — self-approval prevention, status transitions,
 * storage cleanup, and journal entry creation live in the domain service.
 */

import {
  requireAuth,
  wrapError,
  jsonResponse,
  errorResponse,
  requirePermission,
} from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";
import { IncomeService } from "@/server/services/income.service";
import { createIncomeSchema } from "@/server/domain/validation";

function route(
  method: "GET" | "POST" | "DELETE",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

export const incomeRoutes: RouteDefinition[] = [
  // ── List income ────────────────────────────────────────────────────
  route("GET", "/income", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.read");
      const data = await IncomeService.list(ctx.session.churchId);
      return jsonResponse(data);
    });
  }),

  // ── Get single income ───────────────────────────────────────────────
  route("GET", "/income/:incomeId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.read");
      const data = await IncomeService.getById(ctx.session.churchId, params.incomeId);
      if (!data) return errorResponse(404, "NOT_FOUND", "Income record not found");
      return jsonResponse(data);
    });
  }),

  // ── Create income ───────────────────────────────────────────────────
  route("POST", "/income", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.write");
      const body = await request.json();
      const input = createIncomeSchema.parse(body);
      const data = await IncomeService.create(
        input as unknown as Record<string, unknown>,
        ctx.session,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(data, 201);
    });
  }),

  // ── Approve income ─────────────────────────────────────────────────
  route("POST", "/income/:incomeId/approve", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.approve");
      const data = await IncomeService.approve(
        params.incomeId,
        ctx.session,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(data);
    });
  }),

  // ── Reject income ──────────────────────────────────────────────────
  route("POST", "/income/:incomeId/reject", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.approve");
      const body = await request.json();
      const reason = (body as any).reason;
      const data = await IncomeService.reject(
        params.incomeId,
        reason ?? "",
        ctx.session,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(data);
    });
  }),

  // ── Delete income ──────────────────────────────────────────────────
  route("DELETE", "/income/:incomeId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.write");
      const result = await IncomeService.delete(
        params.incomeId,
        ctx.session,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(result);
    });
  }),
];

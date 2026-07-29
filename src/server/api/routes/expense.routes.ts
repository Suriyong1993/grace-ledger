/**
 * Grace Ledger v2 — Expense API Routes (Thin Wrapper)
 *
 * Delegates all business logic to ExpenseService.
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
import { ExpenseService } from "@/server/services/expense.service";
import { createExpenseSchema } from "@/server/domain/validation";

function route(
  method: "GET" | "POST" | "DELETE",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

export const expenseRoutes: RouteDefinition[] = [
  // ── List expenses ──────────────────────────────────────────────────
  route("GET", "/expense", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.read");
      const data = await ExpenseService.list(ctx.session.churchId);
      return jsonResponse(data);
    });
  }),

  // ── Get single expense ─────────────────────────────────────────────
  route("GET", "/expense/:expenseId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.read");
      const data = await ExpenseService.getById(ctx.session.churchId, params.expenseId);
      if (!data) return errorResponse(404, "NOT_FOUND", "Expense record not found");
      return jsonResponse(data);
    });
  }),

  // ── Create expense ─────────────────────────────────────────────────
  route("POST", "/expense", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.write");
      const body = await request.json();
      const input = createExpenseSchema.parse(body);
      const data = await ExpenseService.create(
        input as unknown as Record<string, unknown>,
        ctx.session,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(data, 201);
    });
  }),

  // ── Approve expense ────────────────────────────────────────────────
  route("POST", "/expense/:expenseId/approve", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.approve");
      const data = await ExpenseService.approve(
        params.expenseId,
        ctx.session,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(data);
    });
  }),

  // ── Reject expense ─────────────────────────────────────────────────
  route("POST", "/expense/:expenseId/reject", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.approve");
      const body = await request.json();
      const reason = (body as any).reason;
      const data = await ExpenseService.reject(
        params.expenseId,
        reason ?? "",
        ctx.session,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(data);
    });
  }),

  // ── Delete expense ─────────────────────────────────────────────────
  route("DELETE", "/expense/:expenseId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.write");
      const result = await ExpenseService.delete(
        params.expenseId,
        ctx.session,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(result);
    });
  }),
];

/**
 * Grace Ledger v2 — Budget API Routes
 *
 * Routes budget creation, listing, and updates through the server.
 * Budgets are stored in both the Drizzle schema (budgets table) for
 * the accounting domain and served via API for the frontend.
 */

import { db } from "@/server/infrastructure/db";
import { budgets } from "@/db/schema";
import { createBudgetFromRouteSchema } from "@/server/domain/validation";
import {
  requireAuth,
  wrapError,
  jsonResponse,
  errorResponse,
  requirePermission,
  ApiError,
} from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";
import { AuditService } from "@/server/services/audit.service";
import { eq, and, desc } from "drizzle-orm";

function route(
  method: "GET" | "POST" | "PUT",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

export const budgetRoutes: RouteDefinition[] = [
  // ── List budgets ───────────────────────────────────────────────────
  route("GET", "/budget", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.read");

      const result = await db
        .select()
        .from(budgets)
        .where(eq(budgets.churchId, ctx.session.churchId))
        .orderBy(desc(budgets.createdAt))
        .limit(500);

      return jsonResponse(result);
    });
  }),

  // ── Get single budget ─────────────────────────────────────────────
  route("GET", "/budget/:budgetId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.read");

      const result = await db.query.budgets.findFirst({
        where: and(eq(budgets.id, params.budgetId), eq(budgets.churchId, ctx.session.churchId)),
      });

      if (!result) {
        return errorResponse(404, "NOT_FOUND", "Budget not found");
      }
      return jsonResponse(result);
    });
  }),

  // ── Create budget ──────────────────────────────────────────────────
  route("POST", "/budget", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "fund.manage");

      const body = await request.json();
      const input = createBudgetFromRouteSchema.parse(body);

      const [result] = await db
        .insert(budgets)
        .values({
          churchId: ctx.session.churchId,
          name: input.name,
          accountId: input.categoryId,
          fundId: input.fundId,
          periodType: input.period === "monthly" ? "monthly" : "annual",
          fiscalYear: input.fiscalYear,
          budgetedAmount: String(input.budgetAmount),
          notes: input.notes ?? null,
          createdBy: ctx.session.userId,
        })
        .returning();

      await AuditService.logCreate(
        ctx.session.churchId,
        "budget",
        result.id,
        ctx.session.userId,
        ctx.session.name,
        { name: input.name, amount: input.budgetAmount, fiscalYear: input.fiscalYear },
        ctx.ipAddress,
        ctx.userAgent,
      );

      return jsonResponse(result, 201);
    });
  }),

  // ── Update budget ──────────────────────────────────────────────────
  route("PUT", "/budget/:budgetId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "fund.manage");

      const body = await request.json();

      const existing = await db.query.budgets.findFirst({
        where: and(eq(budgets.id, params.budgetId), eq(budgets.churchId, ctx.session.churchId)),
      });

      if (!existing) {
        return errorResponse(404, "NOT_FOUND", "Budget not found");
      }

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.budgetAmount !== undefined) updates.budgetedAmount = String(body.budgetAmount);
      if (body.notes !== undefined) updates.notes = body.notes;
      if (body.status !== undefined) updates.status = body.status;

      const [result] = await db
        .update(budgets)
        .set(updates)
        .where(eq(budgets.id, params.budgetId))
        .returning();

      await AuditService.logUpdate(
        ctx.session.churchId,
        "budget",
        params.budgetId,
        ctx.session.userId,
        ctx.session.name,
        existing as unknown as Record<string, unknown>,
        {
          name: updates.name,
          budgetedAmount: updates.budgetedAmount,
          status: updates.status,
        } as Record<string, unknown>,
        ctx.ipAddress,
        ctx.userAgent,
      );

      return jsonResponse(result);
    });
  }),
];

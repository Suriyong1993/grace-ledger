/**
 * Grace Ledger v2 — Fiscal Period API Routes
 */

import { PeriodService } from "@/server/services/period.service";
import {
  requireAuth,
  wrapError,
  jsonResponse,
  errorResponse,
  requirePermission,
} from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";

function route(
  method: "GET" | "POST",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

export const periodRoutes: RouteDefinition[] = [
  route("GET", "/periods", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.read");
      const fiscalYear = query.get("fiscalYear") ? parseInt(query.get("fiscalYear")!) : undefined;
      const periods = await PeriodService.listPeriods(ctx.session.churchId, fiscalYear);
      return jsonResponse(periods);
    });
  }),

  route("GET", "/periods/:periodId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.read");
      const period = await PeriodService.getPeriod(ctx.session.churchId, params.periodId);
      if (!period) return errorResponse(404, "NOT_FOUND", "Period not found");
      return jsonResponse(period);
    });
  }),

  route("POST", "/periods/:periodId/close", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "period.close");
      const period = await PeriodService.closePeriod(
        ctx.session.churchId,
        params.periodId,
        ctx.session.userId,
        ctx.session.name,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(period);
    });
  }),

  route("POST", "/periods/:periodId/reopen", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "period.reopen");
      const period = await PeriodService.reopenPeriod(
        ctx.session.churchId,
        params.periodId,
        ctx.session.userId,
        ctx.session.name,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(period);
    });
  }),
];

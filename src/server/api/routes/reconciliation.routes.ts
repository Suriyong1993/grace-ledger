import { ReconciliationService } from "@/server/services/reconciliation.service";
import { Money } from "@/server/domain/money";
import { createReconciliationSchema } from "@/server/domain/validation";
import { requireAuth, wrapError, jsonResponse, requirePermission } from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";

function route(method: "GET" | "POST", path: string, handler: RouteDefinition["handler"]): RouteDefinition {
  return { method, path, handler };
}

export const reconciliationRoutes: RouteDefinition[] = [
  route("GET", "/reconciliations", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "period.reconcile");
      const periodId = query.get("periodId");
      if (!periodId) {
        return jsonResponse([]);
      }
      const recs = await ReconciliationService.listForPeriod(ctx.session.churchId, periodId);
      return jsonResponse(recs);
    });
  }),

  route("POST", "/reconciliations", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "period.reconcile");
      const body = await request.json();
      const input = createReconciliationSchema.parse(body);
      const rec = await ReconciliationService.reconcile(
        {
          churchId: ctx.session.churchId,
          periodId: input.periodId,
          fundId: input.fundId,
          actualBalance: Money.fromBaht(input.actualBalance),
          explanation: input.explanation,
        },
        ctx.session.userId,
        ctx.session.name,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(rec, 201);
    });
  }),
];
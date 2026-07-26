import { AuditService } from "@/server/services/audit.service";
import { auditQuerySchema } from "@/server/domain/validation";
import { requireAuth, wrapError, jsonResponse, requirePermission } from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";

function route(
  method: "GET" | "POST",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

export const auditRoutes: RouteDefinition[] = [
  route("GET", "/audit", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "audit.read");
      const filters = auditQuerySchema.parse(Object.fromEntries(query));
      const entries = await AuditService.query({
        churchId: ctx.session.churchId,
        entityType: filters.entityType,
        entityId: filters.entityId,
        userId: filters.userId,
        eventType: filters.eventType,
        action: filters.action,
        limit: filters.limit,
        offset: filters.offset,
      });
      return jsonResponse(entries);
    });
  }),

  route("POST", "/audit/verify", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "audit.read");
      const result = await AuditService.verifyChain(ctx.session.churchId);
      return jsonResponse(result);
    });
  }),
];

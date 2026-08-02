import { db } from "@/server/infrastructure/db";
import { projects } from "@/db/schema";
import { createProjectSchema } from "@/server/domain/validation";
import {
  requireAuth,
  wrapError,
  jsonResponse,
  errorResponse,
  requirePermission,
} from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";
import { AuditService } from "@/server/services/audit.service";
import { and, eq } from "drizzle-orm";

function route(
  method: "GET" | "POST" | "DELETE",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

export const projectRoutes: RouteDefinition[] = [
  route("POST", "/projects", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "project.write");
      const body = await request.json();
      const input = createProjectSchema.parse(body);
      const [project] = await db
        .insert(projects)
        .values({
          churchId: ctx.session.churchId,
          name: input.name,
          description: input.description ?? "",
          budgetAmount: input.budgetAmount,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          status: "planning",
          departmentId: input.departmentId ?? null,
          ownerId: input.ownerId ?? null,
        })
        .returning();
      await AuditService.logCreate(
        ctx.session.churchId,
        "project",
        project.id,
        ctx.session.userId,
        ctx.session.name,
        { name: input.name, budgetAmount: input.budgetAmount } as Record<string, unknown>,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(project, 201);
    });
  }),

  route("DELETE", "/projects/:projectId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "project.write");
      const { projectId } = params;
      const [existing] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.churchId, ctx.session.churchId)))
        .limit(1);
      if (!existing) {
        return errorResponse(404, "NOT_FOUND", "Project not found");
      }
      await AuditService.logDelete(
        ctx.session.churchId,
        "project",
        projectId,
        ctx.session.userId,
        ctx.session.name,
        { name: existing.name, budgetAmount: existing.budgetAmount } as Record<string, unknown>,
        ctx.ipAddress,
        ctx.userAgent,
      );
      await db.delete(projects).where(eq(projects.id, projectId));
      return jsonResponse({ success: true });
    });
  }),
];

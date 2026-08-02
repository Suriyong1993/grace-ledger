import { db } from "@/server/infrastructure/db";
import { lineUsers } from "@/db/schema";
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
import { z } from "zod";

function route(
  method: "GET" | "POST" | "DELETE",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

const linkLineUserSchema = z.object({
  lineUserId: z.string().min(1),
});

export const lineUserRoutes: RouteDefinition[] = [
  route("POST", "/line-users/link", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "settings.write");
      const body = await request.json();
      const { lineUserId } = linkLineUserSchema.parse(body);
      const [link] = await db
        .insert(lineUsers)
        .values({
          churchId: ctx.session.churchId,
          lineUserId,
          userId: ctx.session.userId,
        })
        .returning();
      await AuditService.logCreate(
        ctx.session.churchId,
        "line_user",
        link.id,
        ctx.session.userId,
        ctx.session.name,
        { lineUserId } as Record<string, unknown>,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(link, 201);
    });
  }),

  route("DELETE", "/line-users/unlink", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "settings.write");
      const [existing] = await db
        .select()
        .from(lineUsers)
        .where(
          and(
            eq(lineUsers.churchId, ctx.session.churchId),
            eq(lineUsers.userId, ctx.session.userId),
          ),
        )
        .limit(1);
      if (!existing) {
        return errorResponse(404, "NOT_FOUND", "LINE user link not found");
      }
      await AuditService.logDelete(
        ctx.session.churchId,
        "line_user",
        existing.id,
        ctx.session.userId,
        ctx.session.name,
        { lineUserId: existing.lineUserId } as Record<string, unknown>,
        ctx.ipAddress,
        ctx.userAgent,
      );
      await db
        .delete(lineUsers)
        .where(
          and(
            eq(lineUsers.churchId, ctx.session.churchId),
            eq(lineUsers.userId, ctx.session.userId),
          ),
        );
      return jsonResponse({ success: true });
    });
  }),

  route("GET", "/line-users/status", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "settings.read");
      const [link] = await db
        .select()
        .from(lineUsers)
        .where(
          and(
            eq(lineUsers.churchId, ctx.session.churchId),
            eq(lineUsers.userId, ctx.session.userId),
          ),
        )
        .limit(1);
      return jsonResponse({
        linked: !!link,
        lineUserId: link?.lineUserId ?? undefined,
      });
    });
  }),
];

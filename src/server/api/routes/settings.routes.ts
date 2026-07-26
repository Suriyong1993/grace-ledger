import { db } from "@/server/infrastructure/db";
import { appSettings } from "@/db/schema";
import { updateSettingsSchema } from "@/server/domain/validation";
import { requireAuth, wrapError, jsonResponse, requirePermission } from "@/server/api/middleware";
import { eq } from "drizzle-orm";
import type { RouteDefinition } from "@/server/api/routes";

function route(
  method: "GET" | "PUT",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

export const settingsRoutes: RouteDefinition[] = [
  route("GET", "/settings", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "settings.read");
      const settings = await db.query.appSettings.findFirst({
        where: eq(appSettings.churchId, ctx.session.churchId),
      });
      return jsonResponse(settings ?? {});
    });
  }),

  route("PUT", "/settings", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "settings.write");
      const body = await request.json();
      const input = updateSettingsSchema.parse(body);
      const updates: Record<string, unknown> = {
        updatedBy: ctx.session.userId,
        updatedAt: new Date(),
      };
      if (input.churchName !== undefined) updates.churchName = input.churchName;
      if (input.churchAddress !== undefined) updates.churchAddress = input.churchAddress;
      if (input.taxId !== undefined) updates.taxId = input.taxId;
      if (input.fiscalYearStart !== undefined) updates.fiscalYearStart = input.fiscalYearStart;
      if (input.idleTimeoutMin !== undefined) updates.idleTimeoutMin = input.idleTimeoutMin;
      if (input.sessionMaxHours !== undefined) updates.sessionMaxHours = input.sessionMaxHours;
      await db
        .update(appSettings)
        .set(updates)
        .where(eq(appSettings.churchId, ctx.session.churchId));
      return jsonResponse({ success: true });
    });
  }),
];

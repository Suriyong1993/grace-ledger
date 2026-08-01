import { db } from "@/server/infrastructure/db";
import { offeringCategories } from "@/db/schema";
import {
  requireAuth,
  wrapError,
  jsonResponse,
  errorResponse,
  requirePermission,
} from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";
import { AuditService } from "@/server/services/audit.service";
import { eq } from "drizzle-orm";
import { z } from "zod";

function route(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().length(7).optional(),
  icon: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  accountId: z.string().uuid().optional(),
});

const updateCategorySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  color: z.string().length(7).optional(),
  icon: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

export const offeringCategoryRoutes: RouteDefinition[] = [
  route("POST", "/offering-categories", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "settings.write");
      const body = await request.json();
      const input = createCategorySchema.parse(body);
      const [category] = await db
        .insert(offeringCategories)
        .values({
          churchId: ctx.session.churchId,
          name: input.name,
          description: input.description ?? null,
          color: input.color ?? null,
          icon: input.icon ?? null,
          sortOrder: 0,
          isActive: true,
          accountId: input.accountId ?? null,
        })
        .returning();
      await AuditService.logCreate(
        ctx.session.churchId,
        "offering_category",
        category.id,
        ctx.session.userId,
        ctx.session.name,
        { name: input.name } as Record<string, unknown>,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(category, 201);
    });
  }),

  route("PUT", "/offering-categories", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "settings.write");
      const body = await request.json();
      const input = updateCategorySchema.parse(body);
      const [existing] = await db
        .select()
        .from(offeringCategories)
        .where(
          eq(offeringCategories.id, input.categoryId),
          eq(offeringCategories.churchId, ctx.session.churchId),
        )
        .limit(1);
      if (!existing) {
        return errorResponse(404, "NOT_FOUND", "Category not found");
      }
      const beforeState = {
        name: existing.name,
        color: existing.color,
        icon: existing.icon,
        description: existing.description,
        sortOrder: existing.sortOrder,
        isActive: existing.isActive,
      } as Record<string, unknown>;
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.icon !== undefined) updateData.icon = input.icon;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      const [updated] = await db
        .update(offeringCategories)
        .set(updateData)
        .where(eq(offeringCategories.id, input.categoryId))
        .returning();
      await AuditService.logUpdate(
        ctx.session.churchId,
        "offering_category",
        input.categoryId,
        ctx.session.userId,
        ctx.session.name,
        beforeState,
        updated as Record<string, unknown>,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(updated);
    });
  }),

  route("DELETE", "/offering-categories/:categoryId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "settings.write");
      const { categoryId } = params;
      const [existing] = await db
        .select()
        .from(offeringCategories)
        .where(
          eq(offeringCategories.id, categoryId),
          eq(offeringCategories.churchId, ctx.session.churchId),
        )
        .limit(1);
      if (!existing) {
        return errorResponse(404, "NOT_FOUND", "Category not found");
      }
      await AuditService.logDelete(
        ctx.session.churchId,
        "offering_category",
        categoryId,
        ctx.session.userId,
        ctx.session.name,
        { name: existing.name } as Record<string, unknown>,
        ctx.ipAddress,
        ctx.userAgent,
      );
      await db.delete(offeringCategories).where(eq(offeringCategories.id, categoryId));
      return jsonResponse({ success: true });
    });
  }),

  route("POST", "/offering-categories/reorder", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "settings.write");
      const body = await request.json();
      const { orderedIds } = reorderSchema.parse(body);
      const updates = orderedIds.map((id, index) => ({
        id,
        sortOrder: index + 1,
      }));
      for (const update of updates) {
        await db
          .update(offeringCategories)
          .set({ sortOrder: update.sortOrder })
          .where(
            eq(offeringCategories.id, update.id),
            eq(offeringCategories.churchId, ctx.session.churchId),
          );
      }
      await AuditService.log(
        ctx.session.churchId,
        "offering_category.reordered",
        "offering_category",
        undefined,
        ctx.session.userId,
        ctx.session.name,
        "reorder",
        undefined,
        { orderedIds } as Record<string, unknown>,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse({ success: true });
    });
  }),
];
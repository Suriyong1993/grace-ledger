import { db } from "@/server/infrastructure/db";
import { offeringSubcategories } from "@/db/schema";
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
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

const createSubcategorySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const updateSubcategorySchema = z.object({
  subcategoryId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const offeringSubcategoryRoutes: RouteDefinition[] = [
  route("POST", "/offering-subcategories", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "settings.write");
      const body = await request.json();
      const input = createSubcategorySchema.parse(body);
      const [subcategory] = await db
        .insert(offeringSubcategories)
        .values({
          churchId: ctx.session.churchId,
          categoryId: input.categoryId,
          name: input.name,
          description: input.description ?? null,
          sortOrder: 0,
          isActive: true,
        })
        .returning();
      await AuditService.logCreate(
        ctx.session.churchId,
        "offering_subcategory",
        subcategory.id,
        ctx.session.userId,
        ctx.session.name,
        { name: input.name, categoryId: input.categoryId } as Record<string, unknown>,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(subcategory, 201);
    });
  }),

  route("PUT", "/offering-subcategories", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "settings.write");
      const body = await request.json();
      const input = updateSubcategorySchema.parse(body);
      const [existing] = await db
        .select()
        .from(offeringSubcategories)
        .where(
          and(
            eq(offeringSubcategories.id, input.subcategoryId),
            eq(offeringSubcategories.churchId, ctx.session.churchId),
          ),
        )
        .limit(1);
      if (!existing) {
        return errorResponse(404, "NOT_FOUND", "Subcategory not found");
      }
      const beforeState = {
        name: existing.name,
        description: existing.description,
        sortOrder: existing.sortOrder,
        isActive: existing.isActive,
      } as Record<string, unknown>;
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      const [updated] = await db
        .update(offeringSubcategories)
        .set(updateData)
        .where(eq(offeringSubcategories.id, input.subcategoryId))
        .returning();
      await AuditService.logUpdate(
        ctx.session.churchId,
        "offering_subcategory",
        input.subcategoryId,
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

  route("DELETE", "/offering-subcategories/:subcategoryId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "settings.write");
      const { subcategoryId } = params;
      const [existing] = await db
        .select()
        .from(offeringSubcategories)
        .where(
          and(
            eq(offeringSubcategories.id, subcategoryId),
            eq(offeringSubcategories.churchId, ctx.session.churchId),
          ),
        )
        .limit(1);
      if (!existing) {
        return errorResponse(404, "NOT_FOUND", "Subcategory not found");
      }
      await AuditService.logDelete(
        ctx.session.churchId,
        "offering_subcategory",
        subcategoryId,
        ctx.session.userId,
        ctx.session.name,
        { name: existing.name } as Record<string, unknown>,
        ctx.ipAddress,
        ctx.userAgent,
      );
      await db.delete(offeringSubcategories).where(eq(offeringSubcategories.id, subcategoryId));
      return jsonResponse({ success: true });
    });
  }),
];

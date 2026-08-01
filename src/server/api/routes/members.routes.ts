import { db } from "@/server/infrastructure/db";
import { members } from "@/db/schema";
import { createMemberSchema } from "@/server/domain/validation";
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

function route(
  method: "GET" | "POST",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

export const memberRoutes: RouteDefinition[] = [
  route("POST", "/members", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "member.write");
      const body = await request.json();
      const input = createMemberSchema.parse(body);
      const [member] = await db
        .insert(members)
        .values({
          churchId: ctx.session.churchId,
          firstName: input.firstName,
          lastName: input.lastName,
          familyName: input.familyName ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          departmentId: input.departmentId ?? null,
          joinedAt: input.joinedAt ? new Date(input.joinedAt) : null,
          status: "active",
          consentGiven: false,
        })
        .returning();
      await AuditService.logCreate(
        ctx.session.churchId,
        "member",
        member.id,
        ctx.session.userId,
        ctx.session.name,
        {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
        } as Record<string, unknown>,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(member, 201);
    });
  }),
];
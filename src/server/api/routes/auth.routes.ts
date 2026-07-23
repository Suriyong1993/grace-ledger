/**
 * Grace Ledger v2 — Auth API Routes
 */

import { AuthService } from "@/server/services/auth.service";
import { loginSchema, changePasswordSchema } from "@/server/domain/validation";
import { requireAuth, optionalAuth, wrapError, jsonResponse, errorResponse } from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";
import { db } from "@/server/infrastructure/db";
import { churches } from "@/db/schema";
import { eq } from "drizzle-orm";

function route(method: "GET" | "POST", path: string, handler: RouteDefinition["handler"]): RouteDefinition {
  return { method, path, handler };
}

export const authRoutes: RouteDefinition[] = [
  route("POST", "/auth/login", async (request, params, query) => {
    return wrapError(async () => {
      const body = await request.json();
      const input = loginSchema.parse(body);
      const ctx = await optionalAuth(request);

      // Look up church by name
      const church = await db.query.churches.findFirst({
        where: eq(churches.name, input.churchName),
      });
      if (!church) {
        return errorResponse(401, "INVALID_CREDENTIALS", "Invalid church or credentials");
      }

      const result = await AuthService.login({
        churchId: church.id,
        username: input.username,
        password: input.password,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
      });
      return jsonResponse(result);
    });
  }),

  route("POST", "/auth/logout", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      const authHeader = request.headers.get("authorization")!;
      const token = authHeader.slice(7);
      await AuthService.logout(ctx.session.userId, token);
      return jsonResponse({ success: true });
    });
  }),

  route("POST", "/auth/logout-all", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      await AuthService.logoutAll(ctx.session.userId);
      return jsonResponse({ success: true });
    });
  }),

  route("POST", "/auth/change-password", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      const body = await request.json();
      const input = changePasswordSchema.parse(body);
      await AuthService.changePassword(ctx.session.userId, input.currentPassword, input.newPassword);
      return jsonResponse({ success: true });
    });
  }),

  route("GET", "/auth/me", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      return jsonResponse({
        userId: ctx.session.userId,
        churchId: ctx.session.churchId,
        name: ctx.session.name,
        role: ctx.session.role,
        mustChangePassword: ctx.session.mustChangePassword,
      });
    });
  }),
];
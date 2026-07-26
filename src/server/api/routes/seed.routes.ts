import { SeedService } from "@/server/services/seed.service";
import { jsonResponse, wrapError, requireSession, ApiError } from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";

function route(method: "POST", path: string, handler: RouteDefinition["handler"]): RouteDefinition {
  return { method, path, handler };
}

export const seedRoutes: RouteDefinition[] = [
  route("POST", "/seed", async (request, params, query) => {
    return wrapError(async () => {
      const session = await requireSession(request);
      // SECURITY FIX: Only super_admin can seed the database
      // This prevents any authenticated user from re-seeding and overwriting production data
      if (session.role !== "super_admin") {
        throw new ApiError(403, "FORBIDDEN", "Only super_admin can seed the database");
      }
      const body = await request.json().catch(() => ({}));
      const result = await SeedService.seed({
        churchName: body.churchName,
        adminPassword: body.adminPassword,
        fiscalYearStart: body.fiscalYearStart,
        currency: body.currency,
      });
      return jsonResponse(result, 201);
    });
  }),
];

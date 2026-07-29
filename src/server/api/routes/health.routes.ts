/**
 * Grace Ledger v2 — Health Check API Route
 *
 * Returns server status, version, and uptime.
 * No authentication required.
 */

import type { RouteDefinition } from "@/server/api/routes";
import { jsonResponse } from "@/server/api/middleware";

function route(method: "GET", path: string, handler: RouteDefinition["handler"]): RouteDefinition {
  return { method, path, handler };
}

export const healthRoutes: RouteDefinition[] = [
  route("GET", "/health", async () => {
    return jsonResponse({
      status: "healthy",
      service: "grace-ledger-api",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  }),
];

/**
 * Grace Ledger v2 — API Route Registry
 *
 * Simple route matching without URLPattern (compatible with all Node.js versions).
 * Each route module exports an array of RouteDefinition.
 */

import { authRoutes } from "./routes/auth.routes";
import { journalRoutes } from "./routes/journal.routes";
import { fundRoutes } from "./routes/fund.routes";
import { periodRoutes } from "./routes/period.routes";
import { transferRoutes } from "./routes/transfer.routes";
import { reconciliationRoutes } from "./routes/reconciliation.routes";
import { auditRoutes } from "./routes/audit.routes";
import { seedRoutes } from "./routes/seed.routes";
import { offeringRoutes } from "./routes/offering.routes";
import { settingsRoutes } from "./routes/settings.routes";
import { chartRoutes } from "./routes/chart.routes";
import { errorResponse } from "./middleware";

export interface RouteDefinition {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path with :param placeholders, e.g. "/journal/:entryId/approve" */
  path: string;
  handler: (request: Request, params: Record<string, string>, query: URLSearchParams) => Promise<Response>;
}

const routes: RouteDefinition[] = [
  ...authRoutes,
  ...journalRoutes,
  ...fundRoutes,
  ...periodRoutes,
  ...transferRoutes,
  ...reconciliationRoutes,
  ...auditRoutes,
  ...seedRoutes,
  ...offeringRoutes,
  ...settingsRoutes,
  ...chartRoutes,
];

/**
 * Match a URL pathname against a route pattern.
 * Extracts :param placeholders from the pattern.
 */
function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return params;
}

/**
 * Main API request handler.
 * Matches incoming requests against registered routes and dispatches.
 */
export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  for (const route of routes) {
    if (route.method !== method) continue;

    const params = matchPath(`/api${route.path}`, url.pathname);
    if (params) {
      return route.handler(request, params, url.searchParams);
    }
  }

  return errorResponse(404, "NOT_FOUND", `No route matches ${method} ${url.pathname}`);
}
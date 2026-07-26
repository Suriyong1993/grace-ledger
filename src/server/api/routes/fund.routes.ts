/**
 * Grace Ledger v2 — Fund API Routes
 */

import { FundService } from "@/server/services/fund.service";
import { Money } from "@/server/domain/money";
import { createFundSchema, updateFundSchema } from "@/server/domain/validation";
import {
  requireAuth,
  wrapError,
  jsonResponse,
  errorResponse,
  requirePermission,
} from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";

function route(
  method: "GET" | "POST" | "PUT",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

export const fundRoutes: RouteDefinition[] = [
  route("GET", "/funds", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "fund.read");
      const includeInactive = query.get("includeInactive") === "true";
      const funds = await FundService.listFunds(ctx.session.churchId, includeInactive);
      return jsonResponse(funds);
    });
  }),

  route("GET", "/funds/:fundId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "fund.read");
      const fund = await FundService.getFund(ctx.session.churchId, params.fundId);
      if (!fund) return errorResponse(404, "NOT_FOUND", "Fund not found");
      return jsonResponse(fund);
    });
  }),

  route("POST", "/funds", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "fund.manage");
      const body = await request.json();
      const input = createFundSchema.parse(body);
      const fund = await FundService.createFund(
        {
          churchId: ctx.session.churchId,
          fundCode: input.fundCode,
          name: input.name,
          accountId: input.accountId,
          description: input.description,
          isRestricted: input.isRestricted,
          openingBalance: input.openingBalance ? Money.fromBaht(input.openingBalance) : undefined,
        },
        ctx.session.userId,
        ctx.session.name,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(fund, 201);
    });
  }),

  route("PUT", "/funds/:fundId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "fund.manage");
      const body = await request.json();
      const input = updateFundSchema.parse({ ...body, fundId: params.fundId });
      const fund = await FundService.updateFund(
        {
          churchId: ctx.session.churchId,
          fundId: input.fundId,
          name: input.name,
          description: input.description,
          isActive: input.isActive,
          isRestricted: input.isRestricted,
        },
        ctx.session.userId,
        ctx.session.name,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(fund);
    });
  }),

  route("GET", "/funds/:fundId/balance", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "fund.read");
      const balance = await FundService.getFundBalance(ctx.session.churchId, params.fundId);
      return jsonResponse({ fundId: params.fundId, balance: balance.toNumber() });
    });
  }),
];

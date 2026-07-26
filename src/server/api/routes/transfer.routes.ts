/**
 * Grace Ledger v2 — Fund Transfer API Routes
 */

import { TransferService } from "@/server/services/transfer.service";
import { Money } from "@/server/domain/money";
import { fundTransferSchema } from "@/server/domain/validation";
import { requireAuth, wrapError, jsonResponse, requirePermission } from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";

function route(method: "POST", path: string, handler: RouteDefinition["handler"]): RouteDefinition {
  return { method, path, handler };
}

export const transferRoutes: RouteDefinition[] = [
  route("POST", "/transfers", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "fund.transfer");
      const body = await request.json();
      const input = fundTransferSchema.parse(body);
      const entry = await TransferService.createTransfer(
        {
          fromFundId: input.fromFundId,
          toFundId: input.toFundId,
          amount: Money.fromBaht(input.amount),
          description: input.description,
          postingDate: input.postingDate,
          fiscalYear: input.fiscalYear,
          fiscalPeriod: input.fiscalPeriod,
        },
        ctx.session.churchId,
        ctx.session.userId,
        ctx.session.name,
        ctx.ipAddress,
        ctx.userAgent,
      );
      return jsonResponse(entry, 201);
    });
  }),
];

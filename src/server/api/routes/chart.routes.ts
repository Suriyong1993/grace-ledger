/**
 * Grace Ledger v2 — Chart of Accounts API Routes
 */

import { db } from "@/server/infrastructure/db";
import { chartOfAccounts } from "@/db/schema";
import { createAccountSchema } from "@/server/domain/validation";
import { requireAuth, wrapError, jsonResponse, requirePermission } from "@/server/api/middleware";
import { eq, and } from "drizzle-orm";
import type { RouteDefinition } from "@/server/api/routes";

function route(
  method: "GET" | "POST",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

export const chartRoutes: RouteDefinition[] = [
  route("GET", "/chart-of-accounts", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.read");
      const accounts = await db
        .select()
        .from(chartOfAccounts)
        .where(eq(chartOfAccounts.churchId, ctx.session.churchId))
        .orderBy(chartOfAccounts.sortOrder);
      return jsonResponse(accounts);
    });
  }),

  route("POST", "/chart-of-accounts", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "fund.manage");
      const body = await request.json();
      const input = createAccountSchema.parse(body);
      const [account] = await db
        .insert(chartOfAccounts)
        .values({
          churchId: ctx.session.churchId,
          accountCode: input.accountCode,
          accountName: input.accountName,
          accountType: input.accountType,
          parentId: input.parentId ?? null,
          isContra: input.isContra ?? false,
          normalBalance: input.normalBalance,
          description: input.description ?? null,
          sortOrder: input.sortOrder ?? 0,
          tfrsCode: input.tfrsCode ?? null,
        })
        .returning();
      return jsonResponse(account, 201);
    });
  }),
];

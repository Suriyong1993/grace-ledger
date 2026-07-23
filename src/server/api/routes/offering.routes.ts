import { db } from "@/server/infrastructure/db";
import { offeringCountSheets, journalEntries } from "@/db/schema";
import { createCountSheetSchema, submitCountSchema, lockCountSheetSchema } from "@/server/domain/validation";
import { requireAuth, wrapError, jsonResponse, errorResponse, requirePermission } from "@/server/api/middleware";
import { Money } from "@/server/domain/money";
import type { RouteDefinition } from "@/server/api/routes";
import { eq, and } from "drizzle-orm";

function route(method: "GET" | "POST", path: string, handler: RouteDefinition["handler"]): RouteDefinition {
  return { method, path, handler };
}

export const offeringRoutes: RouteDefinition[] = [
  route("GET", "/count-sheets", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "offering.count");
      const date = query.get("date");
      const conditions = [eq(offeringCountSheets.churchId, ctx.session.churchId)];
      if (date) conditions.push(eq(offeringCountSheets.date, date));
      const sheets = await db.select().from(offeringCountSheets).where(and(...conditions));
      return jsonResponse(sheets);
    });
  }),

  route("POST", "/count-sheets", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "offering.count");
      const body = await request.json();
      const input = createCountSheetSchema.parse(body);
      const [sheet] = await db.insert(offeringCountSheets).values({
        churchId: ctx.session.churchId,
        date: input.date,
        counter1Id: ctx.session.userId,
        counter2Id: input.counter2Id,
        counter3Id: input.counter3Id ?? null,
      }).returning();
      return jsonResponse(sheet, 201);
    });
  }),

  route("POST", "/count-sheets/:sheetId/submit", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "offering.count");
      const body = await request.json();
      const input = submitCountSchema.parse(body);
      const sheet = await db.query.offeringCountSheets.findFirst({
        where: and(eq(offeringCountSheets.id, params.sheetId), eq(offeringCountSheets.churchId, ctx.session.churchId)),
      });
      if (!sheet) return errorResponse(404, "NOT_FOUND", "Count sheet not found");

      const isCounter1 = sheet.counter1Id === ctx.session.userId;
      const isCounter2 = sheet.counter2Id === ctx.session.userId;
      const isCounter3 = sheet.counter3Id === ctx.session.userId;

      if (!isCounter1 && !isCounter2 && !isCounter3) {
        return errorResponse(403, "FORBIDDEN", "You are not a counter on this sheet");
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (isCounter1) updates.counter1Amount = Money.fromBaht(input.amount).toSqlDecimal();
      if (isCounter2) updates.counter2Amount = Money.fromBaht(input.amount).toSqlDecimal();
      if (isCounter3) updates.counter3Amount = Money.fromBaht(input.amount).toSqlDecimal();

      // Check for discrepancies
      const allAmounts = [
        isCounter1 ? input.amount : sheet.counter1Amount,
        isCounter2 ? input.amount : sheet.counter2Amount,
        sheet.counter3Amount ? (isCounter3 ? input.amount : sheet.counter3Amount) : null,
      ].filter(Boolean);

      if (allAmounts.length >= 2) {
        const amounts = allAmounts.filter(a => a !== null) as string[];
        if (new Set(amounts).size > 1) {
          updates.status = "discrepancy";
        } else if (allAmounts.length >= 2) {
          updates.status = "in_review";
        }
      }

      await db.update(offeringCountSheets).set(updates)
        .where(eq(offeringCountSheets.id, params.sheetId));

      const updated = await db.query.offeringCountSheets.findFirst({
        where: eq(offeringCountSheets.id, params.sheetId),
      });
      return jsonResponse(updated);
    });
  }),

  route("POST", "/count-sheets/:sheetId/lock", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "offering.lock");
      const body = await request.json();
      const input = lockCountSheetSchema.parse(body);
      const sheet = await db.query.offeringCountSheets.findFirst({
        where: and(eq(offeringCountSheets.id, params.sheetId), eq(offeringCountSheets.churchId, ctx.session.churchId)),
      });
      if (!sheet) return errorResponse(404, "NOT_FOUND", "Count sheet not found");
      if (sheet.status === "locked") return errorResponse(400, "ALREADY_LOCKED", "Sheet already locked");

      await db.update(offeringCountSheets).set({
        reconciledAmount: Money.fromBaht(input.reconciledAmount).toSqlDecimal(),
        status: "locked",
        lockedBy: ctx.session.userId,
        lockedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(offeringCountSheets.id, params.sheetId));

      return jsonResponse({ success: true, note: "Count sheet locked. Create a journal entry separately to record the offering." });
    });
  }),
];
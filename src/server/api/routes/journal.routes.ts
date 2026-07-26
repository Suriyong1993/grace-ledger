/**
 * Grace Ledger v2 — Journal Entry API Routes
 */

import { JournalService } from "@/server/domain/journal";
import { Money } from "@/server/domain/money";
import { AuditService } from "@/server/services/audit.service";
import {
  createJournalEntrySchema,
  rejectEntrySchema,
  voidEntrySchema,
  journalQuerySchema,
} from "@/server/domain/validation";
import {
  requireAuth,
  wrapError,
  jsonResponse,
  errorResponse,
  requirePermission,
} from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";
import { db } from "@/server/infrastructure/db";
import { journalEntries, journalEntryLines } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

function route(
  method: "GET" | "POST",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

export const journalRoutes: RouteDefinition[] = [
  route("POST", "/journal", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.write");
      const body = await request.json();
      const input = createJournalEntrySchema.parse(body);

      const lines = input.lines.map((l) => ({
        accountId: l.accountId,
        lineType: l.lineType,
        amount: Money.fromBaht(l.amount),
        fundId: l.fundId,
        memberId: l.memberId,
        departmentId: l.departmentId,
        projectId: l.projectId,
        description: l.description,
      }));

      const entry = await JournalService.createEntry(
        {
          entryType: input.entryType,
          postingDate: new Date(input.postingDate),
          description: input.description,
          fundId: input.fundId,
          fiscalYear: input.fiscalYear,
          fiscalPeriod: input.fiscalPeriod,
          lines,
          referenceDocument: input.referenceDocument,
        },
        ctx.session.churchId,
        ctx.session.userId,
      );

      await AuditService.logCreate(
        ctx.session.churchId,
        "journal_entry",
        entry.id,
        ctx.session.userId,
        ctx.session.name,
        {
          entryNumber: entry.entryNumber,
          entryType: entry.entryType,
          postingDate: entry.postingDate.toISOString(),
        },
        ctx.ipAddress,
        ctx.userAgent,
      );

      return jsonResponse(entry, 201);
    });
  }),

  route("POST", "/journal/:entryId/submit", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.write");
      await JournalService.submitForApproval(
        params.entryId,
        ctx.session.userId,
        ctx.session.churchId,
      );
      return jsonResponse({ success: true });
    });
  }),

  route("POST", "/journal/:entryId/approve", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.approve");
      const entry = await JournalService.approveEntry(
        params.entryId,
        ctx.session.userId,
        ctx.session.role,
        ctx.session.churchId,
      );
      return jsonResponse(entry);
    });
  }),

  route("POST", "/journal/:entryId/reject", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.approve");
      const body = await request.json();
      const input = rejectEntrySchema.parse(body);
      await JournalService.rejectEntry(params.entryId, input.reason, ctx.session.churchId);
      return jsonResponse({ success: true });
    });
  }),

  route("POST", "/journal/:entryId/void", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.void");
      const body = await request.json();
      const input = voidEntrySchema.parse(body);
      const entry = await JournalService.voidEntry(
        params.entryId,
        ctx.session.userId,
        input.reason,
        ctx.session.churchId,
      );
      return jsonResponse(entry);
    });
  }),

  route("GET", "/journal/:entryId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.read");
      const entry = await db.query.journalEntries.findFirst({
        where: and(
          eq(journalEntries.id, params.entryId),
          eq(journalEntries.churchId, ctx.session.churchId),
          isNull(journalEntries.deletedAt), // Exclude soft-deleted
        ),
      });
      if (!entry) return errorResponse(404, "NOT_FOUND", "Journal entry not found");
      const lines = await db
        .select()
        .from(journalEntryLines)
        .where(eq(journalEntryLines.journalEntryId, params.entryId));
      return jsonResponse({ ...entry, lines });
    });
  }),

  route("GET", "/journal", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.read");
      const filters = journalQuerySchema.parse(Object.fromEntries(query));
      const conditions = [
        eq(journalEntries.churchId, ctx.session.churchId),
        isNull(journalEntries.deletedAt), // Exclude soft-deleted
      ];
      if (filters.status) conditions.push(eq(journalEntries.status, filters.status));
      if (filters.entryType) conditions.push(eq(journalEntries.entryType, filters.entryType));
      if (filters.fundId) conditions.push(eq(journalEntries.fundId, filters.fundId));
      if (filters.fiscalYear) conditions.push(eq(journalEntries.fiscalYear, filters.fiscalYear));
      if (filters.fiscalPeriod)
        conditions.push(eq(journalEntries.fiscalPeriod, filters.fiscalPeriod));
      const entries = await db
        .select()
        .from(journalEntries)
        .where(and(...conditions))
        .limit(filters.limit)
        .offset(filters.offset)
        .orderBy(desc(journalEntries.createdAt));
      return jsonResponse(entries);
    });
  }),
];

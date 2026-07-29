/**
 * Grace Ledger v2 — Offering Financial API Routes
 *
 * Routes offering CRUD through the server for the `offerings` table.
 * The existing offering.routes.ts handles count sheets — this file
 * handles the offerings table itself.
 *
 * Offerings create journal entries upon creation (debit cash/bank,
 * credit offering income category).
 */

import { getAdminClient } from "@/server/infrastructure/supabase";
import { JournalService } from "@/server/domain/journal";
import { Money } from "@/server/domain/money";
import {
  requireAuth,
  wrapError,
  jsonResponse,
  errorResponse,
  requirePermission,
  ApiError,
} from "@/server/api/middleware";
import type { RouteDefinition } from "@/server/api/routes";
import { AuditService } from "@/server/services/audit.service";
import { z } from "zod";

function route(
  method: "GET" | "POST" | "DELETE",
  path: string,
  handler: RouteDefinition["handler"],
): RouteDefinition {
  return { method, path, handler };
}

const createOfferingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoryId: z.string().uuid(),
  subcategoryId: z.string().uuid().optional(),
  channel: z.enum(["cash", "bank", "qr"]),
  amount: z.number().positive(),
  fundId: z.string().uuid(),
  memberId: z.string().uuid().optional(),
  note: z.string().max(500).optional().default(""),
});

export const offeringFinancialRoutes: RouteDefinition[] = [
  // ── List offerings ─────────────────────────────────────────────────
  route("GET", "/offering-financial", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.read");

      const churchId = query.get("churchId") ?? ctx.session.churchId;

      const admin = getAdminClient();
      const { data, error } = await (admin.from("offerings") as any)
        .select("*")
        .eq("church_id", churchId)
        .order("date", { ascending: false })
        .limit(500);

      if (error) throw new ApiError(500, "DB_ERROR", error.message);
      return jsonResponse(data ?? []);
    });
  }),

  // ── Get single offering ─────────────────────────────────────────────
  route("GET", "/offering-financial/:offeringId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.read");

      const admin = getAdminClient();
      const { data, error } = await (admin.from("offerings") as any)
        .select("*")
        .eq("id", params.offeringId)
        .eq("church_id", ctx.session.churchId)
        .single();

      if (error || !data) {
        return errorResponse(404, "NOT_FOUND", "Offering not found");
      }
      return jsonResponse(data);
    });
  }),

  // ── Create offering ─────────────────────────────────────────────────
  route("POST", "/offering-financial", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.write");

      const body = await request.json();
      const input = createOfferingSchema.parse(body);

      const admin = getAdminClient();

      const { data, error } = await (admin.from("offerings") as any)
        .insert({
          church_id: ctx.session.churchId,
          date: input.date,
          category_id: input.categoryId,
          subcategory_id: input.subcategoryId ?? null,
          channel: input.channel,
          amount: input.amount,
          fund_id: input.fundId,
          member_id: input.memberId ?? null,
          note: input.note ?? "",
          created_by: ctx.session.userId,
        })
        .select()
        .single();

      if (error) throw new ApiError(500, "DB_ERROR", error.message);

      // Create journal entry: debit cash/bank, credit offering income
      try {
        const journalEntry = await JournalService.createEntry(
          {
            entryType: "offering",
            postingDate: new Date(input.date),
            description: input.note ?? `Offering: ${input.amount} baht`,
            fundId: input.fundId,
            fiscalYear: new Date(input.date).getFullYear(),
            fiscalPeriod: new Date(input.date).getMonth() + 1,
            lines: [
              {
                accountId: input.fundId,
                lineType: "debit" as const,
                amount: Money.fromBaht(String(input.amount)),
                fundId: input.fundId,
              },
              {
                accountId: input.categoryId,
                lineType: "credit" as const,
                amount: Money.fromBaht(String(input.amount)),
                fundId: input.fundId,
              },
            ],
          },
          ctx.session.churchId,
          ctx.session.userId,
        );
        // Auto-submit and approve
        await JournalService.submitForApproval(
          journalEntry.id,
          ctx.session.userId,
          ctx.session.churchId,
        );
        await JournalService.approveEntry(
          journalEntry.id,
          ctx.session.userId,
          ctx.session.role,
          ctx.session.churchId,
        );
      } catch (journalError) {
        console.error("Journal entry creation for offering failed:", journalError);
        // Offering was created but journal entry failed — log and continue
      }

      await AuditService.logCreate(
        ctx.session.churchId,
        "offering",
        (data as any).id,
        ctx.session.userId,
        ctx.session.name,
        { amount: input.amount, date: input.date, channel: input.channel } as Record<
          string,
          unknown
        >,
        ctx.ipAddress,
        ctx.userAgent,
      );

      return jsonResponse(data, 201);
    });
  }),

  // ── Delete offering ─────────────────────────────────────────────────
  route("DELETE", "/offering-financial/:offeringId", async (request, params, query) => {
    return wrapError(async () => {
      const ctx = await requireAuth(request);
      requirePermission(ctx.session, "journal.write");

      const admin = getAdminClient();

      const { data: offering } = await (admin.from("offerings") as any)
        .select("id")
        .eq("id", params.offeringId)
        .eq("church_id", ctx.session.churchId)
        .single();

      if (!offering) {
        return errorResponse(404, "NOT_FOUND", "Offering not found");
      }

      const { error } = await (admin.from("offerings") as any)
        .delete()
        .eq("id", params.offeringId)
        .eq("church_id", ctx.session.churchId);

      if (error) throw new ApiError(500, "DB_ERROR", error.message);

      await AuditService.logDelete(
        ctx.session.churchId,
        "offering",
        params.offeringId,
        ctx.session.userId,
        ctx.session.name,
        { id: params.offeringId } as Record<string, unknown>,
        ctx.ipAddress,
        ctx.userAgent,
      );

      return jsonResponse({ success: true });
    });
  }),
];

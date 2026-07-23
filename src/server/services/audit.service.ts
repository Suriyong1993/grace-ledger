/**
 * Grace Ledger v2 — Audit Logging Service
 *
 * Append-only audit trail with SHA-256 hash chaining per church.
 * Every state mutation is recorded with before/after snapshots.
 *
 * CRITICAL FIX (CF-3): Per-church hash chain — no global serialization bottleneck.
 */

import { createHash } from "crypto";
import { db } from "@/server/infrastructure/db";
import { auditLog } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export interface AuditEntryInput {
  churchId: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  userName: string;
  action: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export class AuditService {
  /**
   * Log an audit event. Computes the next hash in the church's chain.
   */
  static async log(input: AuditEntryInput): Promise<void> {
    const correlationId = input.correlationId ?? crypto.randomUUID();

    // Get the last audit entry's hash for this church (CF-3: per-church chain)
    const lastEntry = await db.query.auditLog.findFirst({
      where: eq(auditLog.churchId, input.churchId),
      orderBy: [desc(auditLog.createdAt)],
      columns: { currentHash: true },
    });

    const previousHash = lastEntry?.currentHash ?? null;

    // Build the payload for hashing
    const payload = JSON.stringify({
      churchId: input.churchId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId,
      userName: input.userName,
      action: input.action,
      beforeState: input.beforeState,
      afterState: input.afterState,
      correlationId,
      previousHash,
      timestamp: new Date().toISOString(),
    });

    const currentHash = createHash("sha256").update(payload).digest("hex");

    await db.insert(auditLog).values({
      churchId: input.churchId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      userId: input.userId ?? null,
      userName: input.userName,
      action: input.action,
      beforeState: input.beforeState ? JSON.stringify(input.beforeState) : null,
      afterState: input.afterState ? JSON.stringify(input.afterState) : null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      correlationId,
      previousHash,
      currentHash,
    });
  }

  /**
   * Log a creation event (no beforeState).
   */
  static async logCreate(
    churchId: string,
    entityType: string,
    entityId: string,
    userId: string | undefined,
    userName: string,
    afterState: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    return AuditService.log({
      churchId,
      eventType: `${entityType}.created`,
      entityType,
      entityId,
      userId,
      userName,
      action: "create",
      afterState,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log an update event with before/after.
   */
  static async logUpdate(
    churchId: string,
    entityType: string,
    entityId: string,
    userId: string | undefined,
    userName: string,
    beforeState: Record<string, unknown>,
    afterState: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    return AuditService.log({
      churchId,
      eventType: `${entityType}.updated`,
      entityType,
      entityId,
      userId,
      userName,
      action: "update",
      beforeState,
      afterState,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log a deletion/void/soft-delete event.
   */
  static async logDelete(
    churchId: string,
    entityType: string,
    entityId: string,
    userId: string | undefined,
    userName: string,
    beforeState: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    return AuditService.log({
      churchId,
      eventType: `${entityType}.deleted`,
      entityType,
      entityId,
      userId,
      userName,
      action: "delete",
      beforeState,
      afterState: { deleted: true },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log an approval event.
   */
  static async logApproval(
    churchId: string,
    entityType: string,
    entityId: string,
    userId: string,
    userName: string,
    beforeState: Record<string, unknown>,
    afterState: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    return AuditService.log({
      churchId,
      eventType: `${entityType}.approved`,
      entityType,
      entityId,
      userId,
      userName,
      action: "approve",
      beforeState,
      afterState,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Verify the integrity of a church's audit chain.
   * Recomputes each hash and checks against the stored value.
   * Returns true if the chain is unbroken.
   */
  static async verifyChain(churchId: string): Promise<{
    valid: boolean;
    entriesChecked: number;
    firstBreakAt?: string;
  }> {
    const entries = await db.query.auditLog.findMany({
      where: eq(auditLog.churchId, churchId),
      orderBy: [desc(auditLog.createdAt)],
      columns: {
        id: true,
        churchId: true,
        eventType: true,
        entityType: true,
        entityId: true,
        userId: true,
        userName: true,
        action: true,
        beforeState: true,
        afterState: true,
        correlationId: true,
        previousHash: true,
        currentHash: true,
        createdAt: true,
      },
    });

    let entriesChecked = 0;
    // Check from oldest to newest
    const sorted = [...entries].reverse();

    for (const entry of sorted) {
      entriesChecked++;

      const payload = JSON.stringify({
        churchId: entry.churchId,
        eventType: entry.eventType,
        entityType: entry.entityType,
        entityId: entry.entityId,
        userId: entry.userId,
        userName: entry.userName,
        action: entry.action,
        beforeState: entry.beforeState ? JSON.parse(entry.beforeState) : null,
        afterState: entry.afterState ? JSON.parse(entry.afterState) : null,
        correlationId: entry.correlationId,
        previousHash: entry.previousHash,
        timestamp: entry.createdAt.toISOString(),
      });

      const computedHash = createHash("sha256").update(payload).digest("hex");

      if (computedHash !== entry.currentHash) {
        return {
          valid: false,
          entriesChecked,
          firstBreakAt: entry.id,
        };
      }
    }

    return { valid: true, entriesChecked };
  }

  /**
   * Query audit log entries with optional filters.
   */
  static async query(params: {
    churchId: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    eventType?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    return db.query.auditLog.findMany({
      where: (fields, { eq, and }) => {
        const conditions = [eq(fields.churchId, params.churchId)];
        if (params.entityType) conditions.push(eq(fields.entityType, params.entityType));
        if (params.entityId) conditions.push(eq(fields.entityId, params.entityId));
        if (params.userId) conditions.push(eq(fields.userId, params.userId));
        if (params.eventType) conditions.push(eq(fields.eventType, params.eventType));
        if (params.action) conditions.push(eq(fields.action, params.action));
        return and(...conditions);
      },
      orderBy: [desc(auditLog.createdAt)],
      limit,
      offset,
    });
  }
}
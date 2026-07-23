/**
 * Grace Ledger v2 — Session Management
 * 
 * CRITICAL FIX (MF-4): Token version (token_version) for instant session revocation.
 * CRITICAL FIX (MF-12): Force password change on first login after migration.
 * 
 * Uses httpOnly, Secure, SameSite=Strict cookies with JWT.
 */

import { eq, and, lt, sql } from "drizzle-orm";
import { db } from "@/server/infrastructure/db";
import { users, userSessions } from "@/db/schema";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import type { UserRole } from "@/server/domain/types";

const JWT_SECRET = process.env.JWT_SECRET ?? "grace-ledger-dev-secret-change-in-production";
const JWT_EXPIRY = "8h";

export interface SessionPayload {
  sub: string; // user ID
  churchId: string;
  role: UserRole;
  name: string;
  tokVer: number; // Token version (MF-4: instant revocation)
  iat: number;
  exp: number;
}

export interface Session {
  userId: string;
  churchId: string;
  role: UserRole;
  name: string;
  mustChangePassword: boolean;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class SessionService {
  /**
   * Create a new session for a user.
   * Returns the JWT token (set as httpOnly cookie by the caller).
   */
  static async createSession(
    userId: string,
    churchId: string,
    role: UserRole,
    name: string,
    tokenVersion: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours

    // Generate JWT with token version
    const token = jwt.sign(
      {
        sub: userId,
        churchId,
        role,
        name,
        tokVer: tokenVersion,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );

    // Store session hash in database
    const tokenHash = hashToken(token);
    await db.insert(userSessions).values({
      userId,
      churchId,
      tokenHash,
      ipAddress,
      userAgent,
      expiresAt,
      lastActivityAt: now,
    });

    return { token, expiresAt };
  }

  /**
   * Validate a JWT token and return the session.
   * Also checks token version for instant revocation (MF-4).
   */
  static async validateSession(token: string): Promise<Session> {
    // Verify JWT signature
    const payload = jwt.verify(token, JWT_SECRET) as SessionPayload;

    // Check token version against database (MF-4: instant revocation)
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      columns: {
        id: true,
        role: true,
        name: true,
        churchId: true,
        isActive: true,
        tokenVersion: true,
        passwordChangedAt: true,
        createdAt: true,
      },
    });

    if (!user || !user.isActive) {
      throw new SessionValidationError("User not found or deactivated", "USER_NOT_FOUND");
    }

    // MF-4: Instantly revoke if token version changed (password change, admin action)
    if (user.tokenVersion !== payload.tokVer) {
      throw new SessionValidationError("Session revoked — please log in again", "TOKEN_VERSION_MISMATCH");
    }

    // Check session exists in database and hasn't expired
    const tokenHash = hashToken(token);
    const session = await db.query.userSessions.findFirst({
      where: and(
        eq(userSessions.tokenHash, tokenHash),
        eq(userSessions.userId, payload.sub),
      ),
    });

    if (!session) {
      throw new SessionValidationError("Session not found", "SESSION_NOT_FOUND");
    }

    if (session.expiresAt < new Date()) {
      throw new SessionValidationError("Session expired", "SESSION_EXPIRED");
    }

    // MF-12: Check if password change is required (first login after migration)
    // If passwordChangedAt equals createdAt, user hasn't changed their temp password
    const mustChangePassword =
      user.passwordChangedAt &&
      user.createdAt &&
      Math.abs(user.passwordChangedAt.getTime() - user.createdAt.getTime()) < 1000;

    return {
      userId: user.id,
      churchId: user.churchId,
      role: user.role as UserRole,
      name: user.name,
      mustChangePassword,
    };
  }

  /**
   * Invalidates all sessions for a user (e.g., on logout from all devices).
   * Increments token_version to instantly revoke all JWTs (MF-4).
   */
  static async invalidateAllSessions(userId: string): Promise<void> {
    await db.update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId));
  }

  /**
   * Invalidate a single session (e.g., on manual logout).
   */
  static async invalidateSession(userId: string, token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await db.delete(userSessions)
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.tokenHash, tokenHash),
      ));
  }

  /** Update last activity timestamp */
  static async touchSession(userId: string, token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await db.update(userSessions)
      .set({ lastActivityAt: new Date() })
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.tokenHash, tokenHash),
      ));
  }

  /** Clean up expired sessions */
  static async cleanupExpiredSessions(): Promise<number> {
    const result = await db.delete(userSessions)
      .where(lt(userSessions.expiresAt, new Date()));
    return result.rowCount ?? 0;
  }
}

export class SessionValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "SessionValidationError";
  }
}
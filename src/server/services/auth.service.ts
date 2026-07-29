/**
 * Grace Ledger v2 — Authentication Service
 * Orchestrates login, logout, password changes, and migration.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/server/infrastructure/db";
import { users } from "@/db/schema";
import { PasswordService } from "@/server/auth/password";
import { SessionService, SessionValidationError } from "@/server/auth/session";
import type { UserRole } from "@/server/domain/types";

export interface LoginInput {
  churchId: string;
  username: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginResult {
  token: string;
  expiresAt: Date;
  user: {
    id: string;
    churchId: string;
    name: string;
    role: UserRole;
    mustChangePassword: boolean;
  };
}

export class AuthService {
  /** Authenticate a user and create a session */
  static async login(input: LoginInput): Promise<LoginResult> {
    const user = await db.query.users.findFirst({
      where: and(eq(users.name, input.username), eq(users.churchId, input.churchId)),
    });

    if (!user || !user.isActive) {
      throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    // Check lockout — use a generic error message to avoid revealing existence
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    // Verify password
    const valid = await PasswordService.verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      // Increment failed attempts
      const failedAttempts = user.failedAttempts + 1;
      const updates: Record<string, unknown> = { failedAttempts };

      if (failedAttempts >= 5) {
        updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min
      }

      await db.update(users).set(updates).where(eq(users.id, user.id));
      throw new AuthError("Invalid credentials", "INVALID_CREDENTIALS");
    }

    // Reset failed attempts on success
    await db
      .update(users)
      .set({ failedAttempts: 0, lockedUntil: null })
      .where(eq(users.id, user.id));

    // MF-12: If passwordChangedAt == createdAt, must change password
    const mustChangePassword =
      user.passwordChangedAt &&
      user.createdAt &&
      Math.abs(user.passwordChangedAt.getTime() - user.createdAt.getTime()) < 1000;

    // Create session
    const { token, expiresAt } = await SessionService.createSession(
      user.id,
      user.churchId,
      user.role as UserRole,
      user.name,
      user.tokenVersion,
      input.ipAddress,
      input.userAgent,
    );

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        churchId: user.churchId,
        name: user.name,
        role: user.role as UserRole,
        mustChangePassword,
      },
    };
  }

  /** Change password for a user */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new AuthError("User not found", "NOT_FOUND");

    // Verify current password
    const valid = await PasswordService.verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      throw new AuthError("Current password is incorrect", "INVALID_PASSWORD");
    }

    // Validate new password strength
    const strength = PasswordService.validatePasswordStrength(newPassword);
    if (!strength.valid) {
      throw new AuthError(strength.reason!, "WEAK_PASSWORD");
    }

    const newHash = await PasswordService.hashPassword(newPassword);
    await db
      .update(users)
      .set({
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        // Increment token version to revoke all existing sessions (MF-4)
        tokenVersion: user.tokenVersion + 1,
      })
      .where(eq(users.id, userId));
  }

  /** Logout — invalidate a specific session */
  static async logout(userId: string, token: string): Promise<void> {
    await SessionService.invalidateSession(userId, token);
  }

  /** Logout from all devices — invalidate all sessions */
  static async logoutAll(userId: string): Promise<void> {
    await SessionService.invalidateAllSessions(userId);
  }

  /** Validate an existing session token */
  static async validateToken(token: string) {
    return SessionService.validateSession(token);
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

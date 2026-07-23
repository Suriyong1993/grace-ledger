/**
 * Grace Ledger v2 — Password Service
 * 
 * CRITICAL FIX (MF-12): Forces password change on first login after migration.
 * Uses argon2id consistently (fixes the bcrypt/argon2id inconsistency from mF-1).
 */

import { hash, verify } from "argon2";

const ARGON2_OPTIONS = {
  type: 2 as const, // argon2id (hybrid — most resistant to GPU/side-channel attacks)
  memoryCost: 65536, // 64 MB
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 threads
};

export class PasswordService {
  /** Hash a plaintext password */
  static async hashPassword(plaintext: string): Promise<string> {
    return hash(plaintext, ARGON2_OPTIONS);
  }

  /** Verify a password against a hash (constant-time comparison) */
  static async verifyPassword(hash: string, plaintext: string): Promise<boolean> {
    try {
      return await verify(hash, plaintext);
    } catch {
      return false;
    }
  }

  /** Validate password meets complexity requirements */
  static validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
    if (password.length < 12) {
      return { valid: false, reason: "รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร" };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, reason: "รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว" };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, reason: "รหัสผ่านต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว" };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, reason: "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว" };
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return { valid: false, reason: "รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว" };
    }
    return { valid: true };
  }
}
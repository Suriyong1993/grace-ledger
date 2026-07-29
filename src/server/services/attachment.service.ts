/**
 * Grace Ledger v2 — Attachment Service
 *
 * Shared utility for attachment storage operations.
 * Prevents duplicate try/catch storage cleanup blocks across route handlers.
 */

import { getAdminClient } from "@/server/infrastructure/supabase";

export class AttachmentService {
  /**
   * Delete a file from Supabase Storage.
   * Non-critical operation — logs warning on failure, never throws.
   */
  static async deleteAttachment(storagePath: string): Promise<void> {
    try {
      const admin = getAdminClient();
      await admin.storage.from("attachments").remove([storagePath]);
    } catch {
      console.warn(`Failed to delete storage file: ${storagePath}`);
    }
  }
}

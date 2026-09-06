import { escapeHtml } from "../../lib/format";

/**
 * Shared field-level validation error renderer.
 *
 * Consolidates the identical `fieldErrorHtml` helper previously
 * duplicated across TransactionsPage / FundsPage / MembersPage.
 */
export function fieldErrorHtml(
  errors: Record<string, string>,
  field: string,
): string {
  const msg = errors[field];
  return msg
    ? `<p class="gl-field-error" role="alert">${escapeHtml(msg)}</p>`
    : "";
}

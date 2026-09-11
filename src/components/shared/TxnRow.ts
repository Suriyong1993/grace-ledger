import { escapeHtml } from "../../lib/format";
import { Money } from "../../lib/money";

export type TxnDirection = "income" | "expense" | "transfer";

export const ICON_INCOME = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`;
export const ICON_EXPENSE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`;
export const ICON_TRANSFER = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 9h13l-3-3M20 15H7l3 3"/></svg>`;

/**
 * Direction-derived presentation (icon, row-icon modifier class, amount
 * color, sign prefix) shared by every transaction-row rendering across the
 * app. Single source — do not re-derive this ternary chain a third time.
 */
export function txnDirectionPresentation(direction: TxnDirection): {
  iconSvg: string;
  iconClass: string;
  amountColor: string;
  sign: string;
} {
  const isIncome = direction === "income";
  const isExpense = direction === "expense";
  return {
    iconSvg: isIncome ? ICON_INCOME : isExpense ? ICON_EXPENSE : ICON_TRANSFER,
    iconClass: isIncome
      ? "gl-row__icon--income"
      : isExpense
        ? "gl-row__icon--expense"
        : "gl-row__icon--transfer",
    amountColor: isIncome
      ? "var(--income)"
      : isExpense
        ? "var(--expense)"
        : "var(--foreground)",
    sign: isIncome ? "+" : isExpense ? "−" : "",
  };
}

export interface TxnRowProps {
  href: string;
  direction: TxnDirection;
  /** Raw (unescaped) title text — escaped internally. */
  title: string;
  /**
   * Pre-composed meta-line HTML (tags, date, plain subtitle, ...). Callers
   * own escaping for whatever they put in here, since the shape varies
   * (a plain subtitle vs. fund/category tags + date).
   */
  metaHtml: string;
  amount: Money;
  /**
   * Pre-rendered status badge HTML. Callers may use different status
   * vocabularies (e.g. the dashboard's simplified 3-state summary vs. the
   * full 6-state `TransactionStatus` lifecycle) — this component only lays
   * out the row shell, it does not interpret status.
   */
  statusBadgeHtml: string;
  className?: string;
  dataTxnId?: string;
  /** Fully-formed aria-label (caller escapes any dynamic content). */
  ariaLabel?: string;
}

/**
 * Shared transaction-row renderer (R3 promoted). Consolidates the row
 * markup previously duplicated between DashboardPage.ts and
 * TransactionsPage.ts — see COMPONENTS.md.
 */
export function renderTxnRowHtml(props: TxnRowProps): string {
  const { iconSvg, iconClass, amountColor, sign } = txnDirectionPresentation(
    props.direction,
  );
  const extraClass = props.className ? ` ${props.className}` : "";
  const dataAttr = props.dataTxnId ? ` data-txn-id="${props.dataTxnId}"` : "";
  const ariaAttr = props.ariaLabel ? ` aria-label="${props.ariaLabel}"` : "";

  return `
    <a href="${props.href}" class="gl-row${extraClass}"${dataAttr}${ariaAttr}>
      <span class="gl-row__icon ${iconClass}" aria-hidden="true">${iconSvg}</span>
      <span class="gl-row__body">
        <span class="gl-row__title">${escapeHtml(props.title)}</span>
        <span class="gl-row__meta">${props.metaHtml}</span>
      </span>
      <span class="gl-row__end">
        <span class="num-display" style="color: ${amountColor};">${sign}${props.amount.format()}</span>
        ${props.statusBadgeHtml}
      </span>
    </a>`;
}

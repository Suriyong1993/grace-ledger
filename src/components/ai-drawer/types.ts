/**
 * Grace AI Drawer — strict UI contracts.
 *
 * The drawer renders exactly three capability kinds: READ, DRAFT and
 * ACTION_PROPOSAL. Payloads here are UI-facing projections of the service
 * layer (src/lib/ai/*); the mappers below are the single place where service
 * shapes are converted. No `any` crosses this boundary.
 */

import type { DataProvenance } from "../../lib/ai/grace-ai-read";
import type { ActionProposalUiCard } from "../../lib/ai/grace-ai-proposals";

export type AiDrawerSender = "user" | "grace_ai";

export type AiProposalAction =
  | "post_transaction"
  | "fund_transfer"
  | "void_transaction";

/** Audit context attached to every READ answer — where the numbers came from. */
export interface ReadProvenance {
  /** Ledger period the facts cover, e.g. `2026-08` or a Thai range label. */
  readonly period: string;
  /** Tool that produced the facts, e.g. `get_financial_summary`. */
  readonly sourceTool: string;
  readonly sourceType: DataProvenance["source_type"];
  /** Records actually included in the calculation. */
  readonly includedCount: number;
  /** Records deliberately excluded (drafts, unverified, …). */
  readonly excludedCount: number;
  /** ISO timestamp of the calculation. */
  readonly generatedAt: string;
}

export function readProvenanceFromService(provenance: DataProvenance): ReadProvenance {
  return {
    period: provenance.period,
    sourceTool: provenance.source_tool,
    sourceType: provenance.source_type,
    includedCount: provenance.included_count ?? 0,
    excludedCount: provenance.excluded_states.length,
    generatedAt: provenance.generated_at,
  };
}

/** One labelled financial fact inside a READ card. */
export interface AiFact {
  readonly label: string;
  readonly value: string;
}

/** Content of a READ answer card. */
export interface ReadMessageContent {
  readonly title: string;
  readonly facts: readonly AiFact[];
  /** Service-generated analysis of the facts. */
  readonly analysis: string | null;
  /** Clearly-marked AI interpretation — always rendered apart from facts. */
  readonly interpretation: string | null;
  readonly provenance: ReadProvenance;
}

/**
 * A DRAFT payload — zero financial impact by service contract. `draftId` is
 * the persisted server id when one exists; fund-transfer drafts currently
 * carry `null`.
 */
export interface DraftTransactionPayload {
  readonly draftId: string | null;
  /** Formatted amount (Money-formatted decimal string, e.g. `฿5,000.00`). */
  readonly amount: string;
  readonly category: string;
  readonly fundName: string;
  readonly fundId: string;
  readonly description: string;
  /** ISO date suggested for the transaction. */
  readonly suggestedDate: string;
  readonly sourceFundName?: string;
}

/**
 * An ACTION_PROPOSAL payload. Carries everything the confirmation modal
 * needs for display; the raw confirmation material (nonce + payload hash)
 * never crosses this boundary — the controller keeps it internally.
 */
export interface ActionProposalPayload {
  readonly proposalId: string;
  readonly action: AiProposalAction;
  readonly toolName: string;
  readonly title: string;
  readonly summary: string;
  /** Ledger resource the proposal acts on (transaction id when applicable). */
  readonly resourceId: string;
  readonly parameters: Readonly<Record<string, string>>;
  /** Single-use confirmation token id (bound to payload_hash server-side). */
  readonly confirmationToken: string;
  /** ISO instant after which the proposal can no longer be confirmed. */
  readonly expiresAt: string;
  readonly amount?: string;
  readonly financialEffect?: string;
}

export function actionProposalFromService(card: ActionProposalUiCard): ActionProposalPayload {
  const parameters: Record<string, string> = {};
  for (const [key, value] of Object.entries(card.current_state)) {
    parameters[key] = String(value);
  }
  const rawResourceId: unknown = card.current_state["transaction_id"];
  return {
    proposalId: card.proposal_id,
    action: card.action,
    toolName: card.provenance.source_tool,
    title: card.title,
    summary: card.summary,
    resourceId:
      typeof rawResourceId === "string" && rawResourceId.length > 0
        ? rawResourceId
        : card.proposal_id,
    parameters,
    confirmationToken: card.confirmation_id,
    expiresAt: card.expires_at,
    amount: card.amount,
    financialEffect: card.financial_effect,
  };
}

/** Result reported after the human confirmed and the action executed. */
export interface ProposalExecutionResult {
  readonly proposalId: string;
  readonly resourceId: string;
  readonly message: string;
}

/** Hooks the host application supplies when mounting the drawer. */
export interface AiDrawerCallbacks {
  /** User tapped "review draft" — the host navigates to Transactions. */
  readonly onDraftReview?: (draft: DraftTransactionPayload) => void;
  /** A proposal was confirmed by the human and executed server-side. */
  readonly onProposalExecuted?: (result: ProposalExecutionResult) => void;
  /** The drawer was closed (close button or backdrop tap). */
  readonly onClose?: () => void;
}

export interface AiChatMessageBase {
  readonly id: string;
  readonly sender: AiDrawerSender;
  /** Display timestamp, e.g. `21:04`. */
  readonly timestamp: string;
}

/** Discriminated union of everything the message stream can render. */
export type AiChatMessage =
  | (AiChatMessageBase & { readonly kind: "text"; readonly text: string })
  | (AiChatMessageBase & { readonly kind: "read"; readonly read: ReadMessageContent })
  | (AiChatMessageBase & { readonly kind: "draft"; readonly draft: DraftTransactionPayload })
  | (AiChatMessageBase & { readonly kind: "proposal"; readonly proposal: ActionProposalPayload })
  | (AiChatMessageBase & { readonly kind: "error"; readonly text: string });

export type AiChatMessageKind = AiChatMessage["kind"];

# Graph Report - src  (2026-09-03)

## Corpus Check
- 85 files · ~68,185 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 739 nodes · 2043 edges · 29 communities (25 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Login / PIN Auth Flow
- Money Engine + Offering Reports
- AI Drawer Cards + Offering Views
- Offering Lifecycle Service
- Approvals Service + AI Confirmation/Idempotency
- Members Management
- Hermes/Telegram AI Bridge
- Approvals UI Components
- AI Tool Registry + RBAC
- Money Formatting + Offering Page
- Funds Service
- Historical Reports
- AI Drawer Shell + Action Cards
- AI Drawer Types
- AI Draft/Proposal Generation
- RBAC + Transactions + Attention Service
- Transactions Service + Page
- App Shell + Dashboard Bootstrap
- AppShell RBAC Gating
- Profile Page + Attention Service
- AI Proposal Confirmation Modal
- Telegram Identity Mapping
- Period Utilities + Transactions Page
- AI Drawer / Proposal Modal Bridge
- AI Read-only Queries
- Dashboard + Attention Wiring
- Router
- Observability Health Check

## God Nodes (most connected - your core abstractions)
1. `Money` - 116 edges
2. `escapeHtml()` - 53 edges
3. `Database` - 50 edges
4. `GraceAiDrawer` - 37 edges
5. `OfferingPage` - 34 edges
6. `formatDateThai()` - 33 edges
7. `UserRole` - 26 edges
8. `LoginPage` - 25 edges
9. `App` - 23 edges
10. `ApprovalsPage` - 22 edges

## Surprising Connections (you probably didn't know these)
- `FundDetail` --references--> `Money`  [EXTRACTED]
  pages/FundsPage.ts → lib/money.ts
- `TransactionItem` --references--> `Money`  [EXTRACTED]
  pages/TransactionsPage.ts → lib/money.ts
- `GraceAiDrawer` --references--> `FinancialActionExecutionService`  [EXTRACTED]
  components/ai-drawer/GraceAiDrawer.ts → lib/ai/financial-action-endpoint.ts
- `GraceAiDrawer` --references--> `GraceAiDraftService`  [EXTRACTED]
  components/ai-drawer/GraceAiDrawer.ts → lib/ai/grace-ai-draft.ts
- `GraceAiDrawer` --references--> `ActionProposalUiCard`  [EXTRACTED]
  components/ai-drawer/GraceAiDrawer.ts → lib/ai/grace-ai-proposals.ts

## Import Cycles
- None detected.

## Communities (29 total, 3 thin omitted)

### Community 0 - "Login / PIN Auth Flow"
Cohesion: 0.06
Nodes (38): escapeHtml(), renderLoginStylesHtml(), isStatusTextAlert(), KEYPAD_DIGITS, PIN_LENGTH, PinStatus, renderCountText(), renderDots() (+30 more)

### Community 1 - "Money Engine + Offering Reports"
Cohesion: 0.06
Nodes (29): STATUS_CONFIG, StatusBadgeProps, ChannelAmountsState, Money, MoneyFormatOptions, MoneyInput, sumMoney(), validateSplitSum() (+21 more)

### Community 2 - "AI Drawer Cards + Offering Views"
Cohesion: 0.10
Nodes (41): DraftCardRefs, renderDraftTransactionCard(), renderReadProvenanceCard(), CashCountFormState, CashCountViewProps, ProfileOption, renderCashCountViewHtml(), renderDenomRow() (+33 more)

### Community 3 - "Offering Lifecycle Service"
Cohesion: 0.11
Nodes (21): DenominationEngine, ALLOWED_OFFERING_TRANSITIONS, OfferingLifecycle, OfferingService, CashCount, CashVarianceResult, ChannelTotalsResult, CreateOfferingSessionInput (+13 more)

### Community 4 - "Approvals Service + AI Confirmation/Idempotency"
Cohesion: 0.08
Nodes (23): ActionConfirmationEngine, canonicalizeJson(), CanonicalProposalPayload, computePayloadHash(), computeProposalPayloadHash(), ConsumeConfirmationInput, ConsumedConfirmationData, CreateConfirmationInput (+15 more)

### Community 5 - "Members Management"
Cohesion: 0.07
Nodes (23): CertificateData, CreateMemberInput, CreateMemberSchema, GivingHistoryRecord, GivingHistoryRequestInput, GivingHistoryRequestSchema, MemberModel, MembersService (+15 more)

### Community 6 - "Hermes/Telegram AI Bridge"
Cohesion: 0.09
Nodes (17): ExecutionResultCode, FinancialActionExecutionRequest, FinancialActionExecutionRequestSchema, FinancialActionExecutionResponse, FinancialActionExecutionService, HermesContext, HermesGraceLedgerSkill, HermesSkillTool (+9 more)

### Community 7 - "Approvals UI Components"
Cohesion: 0.12
Nodes (12): ApprovalDecisionSheetProps, renderApprovalDecisionSheetHtml(), ApprovalsQueueViewProps, renderApprovalsQueueViewHtml(), renderHeaderHtml(), ProjectedBalanceCardProps, renderProjectedBalanceCardHtml(), RejectionModalProps (+4 more)

### Community 8 - "AI Tool Registry + RBAC"
Cohesion: 0.08
Nodes (24): ToolExecutionContext, ToolExecutionRequest, ToolExecutionResult, APPROVED_TOOLS_LIST, APPROVED_TOOLS_MAP, CreateDraftTransactionTool, CreateTransferDraftTool, GetBudgetVsActualTool (+16 more)

### Community 9 - "Money Formatting + Offering Page"
Cohesion: 0.17
Nodes (3): toUserMessage(), ReportsService, OfferingPage

### Community 10 - "Funds Service"
Cohesion: 0.11
Nodes (14): CreateFundInput, CreateFundSchema, FundModel, FundsService, ServiceResult, TransferFundsInput, TransferFundsSchema, UpdateFundInput (+6 more)

### Community 11 - "Historical Reports"
Cohesion: 0.14
Nodes (7): HistoricalGrandTotals, HistoricalMonthlySummary, HistoricalService, HistoricalWeeklySummary, LIVE_CUTOVER_DATE, ChurchLeadership, ReportsPage

### Community 12 - "AI Drawer Shell + Action Cards"
Cohesion: 0.13
Nodes (19): renderAiDrawerStyles(), ACTION_LABELS, proposalActionLabel(), renderActionProposalCard(), QUICK_PROMPTS, actionProposalFromService(), ActionProposalPayload, AiChatMessageBase (+11 more)

### Community 13 - "AI Drawer Types"
Cohesion: 0.30
Nodes (3): extractAmount(), GraceAiDrawer, AiDrawerCallbacks

### Community 14 - "AI Draft/Proposal Generation"
Cohesion: 0.15
Nodes (6): CreateDraftTransactionInput, CreateDraftTransferInput, GraceAiDraftResponse, GraceAiDraftService, GraceAiProposalService, SecureAiToolExecutor

### Community 15 - "RBAC + Transactions + Attention Service"
Cohesion: 0.15
Nodes (15): assertPermission(), can(), ROLE_PERMISSIONS, toUserRole(), CreateDraftTransactionInput, NOTE: category_id lives on transaction_splits, not on transactions — the, ReasonSchema, ServiceResult (+7 more)

### Community 16 - "Transactions Service + Page"
Cohesion: 0.18
Nodes (3): TransactionsService, dateGroupFor(), TransactionsPage

### Community 17 - "App Shell + Dashboard Bootstrap"
Cohesion: 0.19
Nodes (11): AppShellUser, getSupabaseClient(), ActiveSession, DashboardData, HistoricalTrendBar, OfferingPageMode, ProfilePageProps, MatchedRoute (+3 more)

### Community 18 - "AppShell RBAC Gating"
Cohesion: 0.25
Nodes (14): ALL_DESTINATIONS, ATTENTION_GROUP_ICONS, buildMobileComposition(), destinationsForRole(), icon(), MOBILE_CONTENT_PRIORITY, MobileNavComposition, NavDestination (+6 more)

### Community 19 - "Profile Page + Attention Service"
Cohesion: 0.24
Nodes (3): App, ProfilePage, AttentionService

### Community 20 - "AI Proposal Confirmation Modal"
Cohesion: 0.22
Nodes (7): ProposalConfirmationModalProps, ActionProposalUiCard, ActionProposalUiCardSchema, GraceAiProposalResponse, ProposeFundTransferInput, ProposeTransactionPostInput, ProposeVoidTransactionInput

### Community 21 - "Telegram Identity Mapping"
Cohesion: 0.22
Nodes (4): LinkTokenPayload, TelegramIdentityMapping, TelegramIdentityService, UserRole

### Community 22 - "Period Utilities + Transactions Page"
Cohesion: 0.24
Nodes (8): monthBounds, pad(), PERIOD_LABEL, SelectOption, TransactionItem, TXN_STATUS, TxnPeriod, TxnSort

### Community 25 - "Dashboard + Attention Wiring"
Cohesion: 0.38
Nodes (3): AppShellProps, DashboardPage, AttentionSummary

### Community 27 - "Observability Health Check"
Cohesion: 0.33
Nodes (3): ComponentHealthStatus, SystemHealthCheckService, SystemHealthReport

## Knowledge Gaps
- **126 isolated node(s):** `QUICK_PROMPTS`, `ACTION_LABELS`, `DraftCardRefs`, `AiDrawerSender`, `AiFact` (+121 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 163 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Money` connect `Money Engine + Offering Reports` to `Money Formatting + Offering Page`, `Funds Service`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `SecureAiToolExecutor` connect `AI Draft/Proposal Generation` to `Approvals Service + AI Confirmation/Idempotency`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **Why does `GraceAiDrawer` connect `AI Drawer Types` to `Approvals Service + AI Confirmation/Idempotency`, `Hermes/Telegram AI Bridge`, `AI Drawer Shell + Action Cards`, `AI Draft/Proposal Generation`, `AI Proposal Confirmation Modal`, `AI Drawer / Proposal Modal Bridge`, `AI Read-only Queries`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `QUICK_PROMPTS`, `ACTION_LABELS`, `DraftCardRefs` to the rest of the system?**
  _126 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Login / PIN Auth Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.05965324713488099 - nodes in this community are weakly interconnected._
- **Should `Money Engine + Offering Reports` be split into smaller, more focused modules?**
  _Cohesion score 0.06223358908780904 - nodes in this community are weakly interconnected._
- **Should `AI Drawer Cards + Offering Views` be split into smaller, more focused modules?**
  _Cohesion score 0.09679370840895342 - nodes in this community are weakly interconnected._
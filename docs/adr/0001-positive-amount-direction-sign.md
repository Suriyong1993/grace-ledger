# Amount Is Always Positive; Sign Comes From Direction

`Transaction.amount` and `TransactionSplit.amount` are stored as positive `Money` magnitudes — enforced at the database boundary by `chk_transaction_amount_positive`, `chk_split_amount_positive`, and `chk_transfer_amount_positive` (`supabase/migrations/20260817000001_core_schema.sql:215,234,254`) — with sign derived from `TransactionDirection` (`income` | `expense` | `transfer`, `src/lib/transactions/types.ts:12`) via `ProjectedBalanceEngine.calculateTransactionFundDelta`'s direction-based branches (`src/lib/transactions/projected-balance-engine.ts:13-17`). We chose this over a signed-decimal amount because it makes reversal trivial and safe: `void_transaction` reverses a posted transaction by copying the identical positive amount and flipping `direction` (income ⇄ expense) rather than negating a stored value (`supabase/migrations/20260817000003_financial_rpcs_and_triggers.sql:139-157`), and a `CHECK (amount > 0)` at the schema level rules out an entire class of silent double-negation bugs that a signed column cannot.

## Rejected alternative

A signed `amount` (negative for expense / transfer-out) was rejected: a stray double-negation would silently flip a transaction's real-world meaning without changing its type, and reversal would require negating a value instead of swapping one enum field.

## Consequence

Every consumer that needs a fund's signed impact (balance engine, posting triggers, reports) must derive sign from `direction` (and `sourceFundId`/`destFundId` for transfers) rather than trusting the stored amount's sign. This cost is paid once, in `ProjectedBalanceEngine`, rather than being reimplemented ad hoc by each caller.

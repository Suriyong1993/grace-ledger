// Grace Ledger — Phase 2B fixture seeding. Fixture rows are inserted directly
// (as the lab's superuser setup connection) because seeding test data is not
// itself part of what Phase 2B is verifying — only the RPC/trigger/RLS
// behavior exercised afterwards is.

import type { PgLab } from "../../../scripts/pg-lab.mjs";

export const CHURCH = "a1000000-0000-0000-0000-000000000001";
export const TREASURER = "a1000000-0000-0000-0000-0000000000a1"; // posts/voids/transfers
export const TREASURER2 = "a1000000-0000-0000-0000-0000000000a2"; // second treasurer (two-person rule)
export const APPROVER = "a1000000-0000-0000-0000-0000000000a3";
export const CREATOR = "a1000000-0000-0000-0000-0000000000a4"; // finance_staff, drafts only
export const ACCOUNT = "a1000000-0000-0000-0000-0000000000b1";
export const FUND_MAIN = "a1000000-0000-0000-0000-0000000000c1";
export const FUND_MISSION = "a1000000-0000-0000-0000-0000000000c2";

export async function seedChurch(lab: PgLab): Promise<void> {
  const c = lab.client!;
  await c.query(
    `INSERT INTO churches (id, name) VALUES ($1, 'Phase 2B Test Church')`,
    [CHURCH],
  );
  await c.query(
    `INSERT INTO profiles (id, church_id, email, full_name) VALUES
       ($1,$5,'treasurer1@2b.local','Treasurer One'),
       ($2,$5,'treasurer2@2b.local','Treasurer Two'),
       ($3,$5,'approver@2b.local','Approver One'),
       ($4,$5,'creator@2b.local','Creator One')`,
    [TREASURER, TREASURER2, APPROVER, CREATOR, CHURCH],
  );
  await c.query(
    `INSERT INTO user_roles (user_id, church_id, role) VALUES
       ($1,$5,'treasurer'), ($2,$5,'treasurer'), ($3,$5,'approver'), ($4,$5,'finance_staff')`,
    [TREASURER, TREASURER2, APPROVER, CREATOR, CHURCH],
  );
  await c.query(
    `INSERT INTO accounts (id, church_id, name, type, current_balance) VALUES ($1,$2,'Phase2B Cash','cash_drawer',1000000.00)`,
    [ACCOUNT, CHURCH],
  );
  await c.query(
    `INSERT INTO funds (id, church_id, name, current_balance) VALUES
       ($1,$3,'Phase2B Main',500000.00), ($2,$3,'Phase2B Mission',500000.00)`,
    [FUND_MAIN, FUND_MISSION, CHURCH],
  );
}

/** Insert a fresh draft transaction with two splits (fund_main + fund_mission)
 * summing to `amount`. Returns the new transaction id. */
export async function seedDraftTransaction(
  lab: PgLab,
  opts: {
    amount: number;
    direction?: "income" | "expense";
    description: string;
    createdBy?: string;
  },
): Promise<string> {
  const c = lab.client!;
  const direction = opts.direction ?? "income";
  const half = Math.round((opts.amount / 2) * 100) / 100;
  const rest = Math.round((opts.amount - half) * 100) / 100;
  const { rows } = await c.query(
    `INSERT INTO transactions (church_id, account_id, amount, direction, status, description, created_by)
     VALUES ($1,$2,$3,$4,'draft',$5,$6) RETURNING id`,
    [
      CHURCH,
      ACCOUNT,
      opts.amount,
      direction,
      opts.description,
      opts.createdBy ?? CREATOR,
    ],
  );
  const txnId = rows[0].id as string;
  await c.query(
    `INSERT INTO transaction_splits (transaction_id, church_id, fund_id, amount) VALUES
       ($1,$2,$3,$5), ($1,$2,$4,$6)`,
    [txnId, CHURCH, FUND_MAIN, FUND_MISSION, half, rest],
  );
  return txnId;
}

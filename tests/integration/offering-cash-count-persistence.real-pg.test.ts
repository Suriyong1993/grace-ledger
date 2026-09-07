/**
 * Offering cash count — real persistence, end to end.
 *
 * This is the layer every previous round could only assert against a fake:
 *
 *   service input -> record_cash_count() -> PostgreSQL -> read-back
 *
 * A real PostgreSQL 17 is booted, all 31 repository migrations are applied,
 * and isolated fixtures are created per run. No Supabase project is contacted
 * and no production data is used. Rows are read back with fresh SELECTs rather
 * than trusting the RPC's return value, because the point is to prove the
 * write landed, not that the function returns what it claims.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PgLabLinux, pgLabAvailable } from "../../scripts/pg-lab-linux.mjs";

const available = await pgLabAvailable();
const d = available ? describe : describe.skip;

const CHURCH = "10000000-0000-0000-0000-000000000001";
const TREASURER = "20000000-0000-0000-0000-000000000001";
const COUNTER_A = "20000000-0000-0000-0000-000000000002";
const COUNTER_B = "20000000-0000-0000-0000-000000000003";
const MEMBER = "20000000-0000-0000-0000-000000000004";
const OTHER_CHURCH = "10000000-0000-0000-0000-000000000009";
const OUTSIDER = "20000000-0000-0000-0000-000000000009";

d("record_cash_count against real PostgreSQL", () => {
  let lab: InstanceType<typeof PgLabLinux>;

  const seedPeople = async () => {
    await lab.client.query(
      `INSERT INTO churches (id, name) VALUES ($1,'คริสตจักรทดสอบ'), ($2,'คริสตจักรอื่น')
       ON CONFLICT (id) DO NOTHING`,
      [CHURCH, OTHER_CHURCH],
    );
    const people: Array<[string, string, string, string]> = [
      [TREASURER, CHURCH, "treasurer@test.local", "เหรัญญิก"],
      [COUNTER_A, CHURCH, "counter.a@test.local", "ผู้นับ ก"],
      [COUNTER_B, CHURCH, "counter.b@test.local", "ผู้นับ ข"],
      [MEMBER, CHURCH, "member@test.local", "สมาชิก"],
      [OUTSIDER, OTHER_CHURCH, "outsider@test.local", "คนนอก"],
    ];
    for (const [id, church, email, name] of people) {
      await lab.client.query(
        `INSERT INTO profiles (id, church_id, email, full_name)
         VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
        [id, church, email, name],
      );
    }
    const roles: Array<[string, string, string]> = [
      [TREASURER, CHURCH, "treasurer"],
      [COUNTER_A, CHURCH, "counter"],
      [COUNTER_B, CHURCH, "counter"],
      [MEMBER, CHURCH, "member"],
      [OUTSIDER, OTHER_CHURCH, "treasurer"],
    ];
    for (const [uid, church, role] of roles) {
      await lab.client.query(
        `INSERT INTO user_roles (user_id, church_id, role)
         VALUES ($1,$2,$3::user_role_enum) ON CONFLICT DO NOTHING`,
        [uid, church, role],
      );
    }
  };

  /** A fresh counting session with a known expected cash figure. */
  const newSession = async (expectedCash: number, status = "counting") => {
    const { rows } = await lab.client.query(
      `INSERT INTO offering_sessions
         (church_id, service_date, service_name, status,
          expected_cash_amount, expected_total_amount, created_by)
       VALUES ($1, CURRENT_DATE, 'รอบนมัสการเช้า', $2, $3, $3, $4)
       RETURNING id`,
      [CHURCH, status, expectedCash, TREASURER],
    );
    return rows[0].id as string;
  };

  const callRecord = (
    sessionId: string,
    userId: string,
    bills: Partial<Record<string, number>> = {},
  ) =>
    lab.asUser(userId, "authenticated", (c: any) =>
      c.query(
        `SELECT record_cash_count($1,$2,$3,$4,$5,$6,$7,$8,$9) AS r`,
        [
          sessionId, COUNTER_A, COUNTER_B,
          bills.b1000 ?? 0, bills.b500 ?? 0, bills.b100 ?? 0,
          bills.b50 ?? 0, bills.b20 ?? 0, bills.coins ?? 0,
        ],
      ),
    );

  beforeAll(async () => {
    lab = new PgLabLinux();
    await lab.start();
    await seedPeople();
  }, 120_000);

  afterAll(async () => {
    await lab?.stop();
  });

  beforeEach(async () => {
    // Isolation between cases; fixtures above are re-created, not reused rows.
    await lab.client.query("DELETE FROM offering_sessions WHERE church_id = $1", [CHURCH]);
  });

  it("persists the counted total and reads it back from the table", async () => {
    const id = await newSession(12000);
    await callRecord(id, TREASURER, { b1000: 10, b500: 4 });

    const { rows } = await lab.client.query(
      `SELECT counted_cash_amount, cash_variance_amount, variance_status, status
         FROM offering_sessions WHERE id = $1`,
      [id],
    );
    expect(Number(rows[0].counted_cash_amount)).toBe(12000);
    expect(Number(rows[0].cash_variance_amount)).toBe(0);
    expect(rows[0].variance_status).toBe("zero_match");
  });

  it("computes and stores a shortage against expected cash", async () => {
    const id = await newSession(12000);
    await callRecord(id, TREASURER, { b1000: 11, b500: 1 }); // 11,500

    const { rows } = await lab.client.query(
      `SELECT counted_cash_amount, cash_variance_amount, variance_status
         FROM offering_sessions WHERE id = $1`,
      [id],
    );
    expect(Number(rows[0].counted_cash_amount)).toBe(11500);
    expect(Number(rows[0].cash_variance_amount)).toBe(-500);
    expect(rows[0].variance_status).not.toBe("zero_match");
  });

  it("stores coins as an exact decimal rather than a float", async () => {
    const id = await newSession(120.25);
    await callRecord(id, TREASURER, { b100: 1, b20: 1, coins: 0.25 });

    const { rows } = await lab.client.query(
      `SELECT counted_cash_amount, cash_variance_amount FROM offering_sessions WHERE id=$1`,
      [id],
    );
    // Money must be exact: 120.25, not 120.25000000000001.
    expect(rows[0].counted_cash_amount).toBe("120.25");
    expect(Number(rows[0].cash_variance_amount)).toBe(0);
  });

  it("records both counters, satisfying the dual-custody requirement", async () => {
    const id = await newSession(1000);
    await callRecord(id, TREASURER, { b1000: 1 });

    const { rows } = await lab.client.query(
      `SELECT counter1_id, counter2_id FROM offering_sessions WHERE id=$1`,
      [id],
    );
    expect(rows[0].counter1_id).toBe(COUNTER_A);
    expect(rows[0].counter2_id).toBe(COUNTER_B);
    expect(rows[0].counter1_id).not.toBe(rows[0].counter2_id);
  });

  it("rejects the same person as both counters, and writes nothing", async () => {
    const id = await newSession(1000);

    await expect(
      lab.asUser(TREASURER, "authenticated", (c: any) =>
        c.query(`SELECT record_cash_count($1,$2,$2,1,0,0,0,0,0)`, [id, COUNTER_A]),
      ),
    ).rejects.toThrow(/DUAL_COUNTER_VIOLATION/);

    const { rows } = await lab.client.query(
      `SELECT counted_cash_amount, counter1_id FROM offering_sessions WHERE id=$1`,
      [id],
    );
    expect(Number(rows[0].counted_cash_amount)).toBe(0);
    expect(rows[0].counter1_id).toBeNull();
  });

  it("refuses to count a session that was already posted", async () => {
    const id = await newSession(1000, "posted");

    await expect(callRecord(id, TREASURER, { b1000: 1 })).rejects.toThrow(
      /INVALID_STATE/,
    );
  });

  it("refuses an unauthenticated caller", async () => {
    const id = await newSession(1000);
    // No JWT claim set: auth.uid() is null inside the function.
    await expect(
      lab.client.query(`SELECT record_cash_count($1,$2,$3,1,0,0,0,0,0)`, [
        id, COUNTER_A, COUNTER_B,
      ]),
    ).rejects.toThrow(/UNAUTHORIZED/);
  });

  it("does not accumulate when a count is repeated — it locks the session instead", async () => {
    const id = await newSession(12000);
    await callRecord(id, TREASURER, { b1000: 12 });

    // FINDING (documented, not worked around): a zero-variance count moves the
    // session to status 'counted', but the guard inside record_cash_count only
    // admits ('draft','counting','variance_review'). So a balanced count can
    // never be re-counted, while an unbalanced one (status 'variance_review')
    // can. 'counted' is also absent from offering_session_status_enum; the
    // column is plain text, which is the only reason the write is accepted.
    await expect(callRecord(id, TREASURER, { b1000: 12 })).rejects.toThrow(
      /INVALID_STATE/,
    );

    const { rows } = await lab.client.query(
      `SELECT counted_cash_amount, status FROM offering_sessions WHERE id=$1`,
      [id],
    );
    // The important half either way: no accumulation into 24,000.
    expect(Number(rows[0].counted_cash_amount)).toBe(12000);
    expect(rows[0].status).toBe("counted");
  });

  it("allows a genuine recount while the session is still in variance review", async () => {
    const id = await newSession(12000);
    await callRecord(id, TREASURER, { b1000: 11 }); // short -> variance_review
    await callRecord(id, TREASURER, { b1000: 12 }); // corrected recount

    const { rows } = await lab.client.query(
      `SELECT counted_cash_amount, cash_variance_amount FROM offering_sessions WHERE id=$1`,
      [id],
    );
    expect(Number(rows[0].counted_cash_amount)).toBe(12000);
    expect(Number(rows[0].cash_variance_amount)).toBe(0);
  });

  it("records a status that the status enum does not contain", async () => {
    const id = await newSession(1000);
    await callRecord(id, TREASURER, { b1000: 1 });

    const { rows } = await lab.client.query(
      `SELECT s.status,
              EXISTS (SELECT 1 FROM pg_enum e
                        JOIN pg_type t ON t.oid = e.enumtypid
                       WHERE t.typname = 'offering_session_status_enum'
                         AND e.enumlabel = s.status) AS in_enum
         FROM offering_sessions s WHERE s.id = $1`,
      [id],
    );
    // Asserting the gap rather than hiding it: if 'counted' is ever added to
    // the enum, or the RPC switched to 'confirmed', this test should be
    // revisited deliberately.
    expect(rows[0].status).toBe("counted");
    expect(rows[0].in_enum).toBe(false);
  });

  it("writes an audit trail for the count", async () => {
    const id = await newSession(1000);
    await callRecord(id, TREASURER, { b1000: 1 });

    const { rows } = await lab.client.query(
      `SELECT count(*)::int AS n FROM audit_logs WHERE entity_id = $1`,
      [id],
    );
    expect(rows[0].n).toBeGreaterThan(0);
  });
});

d("record_cash_count authorization, enforced by the database", () => {
  let lab: InstanceType<typeof PgLabLinux>;
  let sessionId: string;

  beforeAll(async () => {
    lab = new PgLabLinux();
    await lab.start();

    await lab.client.query(
      `INSERT INTO churches (id, name) VALUES ($1,'คริสตจักรทดสอบ'), ($2,'คริสตจักรอื่น')`,
      [CHURCH, OTHER_CHURCH],
    );
    for (const [id, church, email, name, role] of [
      [TREASURER, CHURCH, "t@test.local", "เหรัญญิก", "treasurer"],
      [COUNTER_A, CHURCH, "a@test.local", "ผู้นับ ก", "counter"],
      [COUNTER_B, CHURCH, "b@test.local", "ผู้นับ ข", "counter"],
      [MEMBER, CHURCH, "m@test.local", "สมาชิก", "member"],
      [OUTSIDER, OTHER_CHURCH, "o@test.local", "คนนอก", "treasurer"],
    ] as string[][]) {
      await lab.client.query(
        `INSERT INTO profiles (id, church_id, email, full_name) VALUES ($1,$2,$3,$4)`,
        [id, church, email, name],
      );
      await lab.client.query(
        `INSERT INTO user_roles (user_id, church_id, role) VALUES ($1,$2,$3::user_role_enum)`,
        [id, church, role],
      );
    }
  }, 120_000);

  afterAll(async () => {
    await lab?.stop();
  });

  beforeEach(async () => {
    await lab.client.query("DELETE FROM offering_sessions");
    const { rows } = await lab.client.query(
      `INSERT INTO offering_sessions
         (church_id, service_date, service_name, status,
          expected_cash_amount, expected_total_amount, created_by)
       VALUES ($1, CURRENT_DATE, 'รอบนมัสการ', 'counting', 1000, 1000, $2)
       RETURNING id`,
      [CHURCH, TREASURER],
    );
    sessionId = rows[0].id;
  });

  const attempt = (userId: string) =>
    lab.asUser(userId, "authenticated", (c: any) =>
      c.query(`SELECT record_cash_count($1,$2,$3,1,0,0,0,0,0)`, [
        sessionId, COUNTER_A, COUNTER_B,
      ]),
    );

  it("allows a treasurer", async () => {
    await expect(attempt(TREASURER)).resolves.toBeDefined();
  });

  it("allows a counter", async () => {
    await expect(attempt(COUNTER_A)).resolves.toBeDefined();
  });

  it("denies a plain member — the UI never offers this, the database refuses it too", async () => {
    await expect(attempt(MEMBER)).rejects.toThrow(/FORBIDDEN/);
  });

  it("denies a treasurer of a different church", async () => {
    // Bypassing the UI entirely and calling the RPC directly must not work
    // across a tenant boundary.
    await expect(attempt(OUTSIDER)).rejects.toThrow(/FORBIDDEN/);
  });

  it("leaves no partial write behind after a denied attempt", async () => {
    await expect(attempt(MEMBER)).rejects.toThrow();
    const { rows } = await lab.client.query(
      `SELECT counted_cash_amount, counter1_id FROM offering_sessions WHERE id=$1`,
      [sessionId],
    );
    expect(Number(rows[0].counted_cash_amount)).toBe(0);
    expect(rows[0].counter1_id).toBeNull();
  });
});

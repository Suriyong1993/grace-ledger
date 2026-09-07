/**
 * Authorization matrix — observed from a real PostgreSQL, not from the UI.
 *
 * The application hides controls a role should not have, but hiding a button
 * is not authorization: anyone can call the RPC directly. These tests set a
 * JWT and SET ROLE authenticated so RLS and the SECURITY DEFINER guards are
 * genuinely in force, then assert what the database itself permits.
 *
 * Running as the owning `postgres` role would bypass every policy and make
 * the whole suite vacuous, so the first test proves RLS is actually biting.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PgLabLinux, pgLabAvailable } from "../../scripts/pg-lab-linux.mjs";

const available = await pgLabAvailable();
const d = available ? describe : describe.skip;

const CHURCH = "10000000-0000-0000-0000-000000000001";
const OTHER = "10000000-0000-0000-0000-000000000002";

const ROLES = [
  "super_admin", "pastor", "treasurer",
  "finance_staff", "approver", "counter", "member",
] as const;
type Role = (typeof ROLES)[number];

const uid = (r: Role) => `4000000${ROLES.indexOf(r)}-0000-0000-0000-000000000001`;
const OUTSIDER = "49000000-0000-0000-0000-000000000001";

d("authorization enforced by PostgreSQL", () => {
  let lab: InstanceType<typeof PgLabLinux>;

  beforeAll(async () => {
    lab = new PgLabLinux();
    await lab.start();

    await lab.client.query(
      `INSERT INTO churches (id,name) VALUES ($1,'คริสตจักรทดสอบ'),($2,'คริสตจักรอื่น')`,
      [CHURCH, OTHER],
    );
    for (const r of ROLES) {
      await lab.client.query(
        `INSERT INTO profiles (id,church_id,email,full_name) VALUES ($1,$2,$3,$4)`,
        [uid(r), CHURCH, `${r}@test.local`, r],
      );
      await lab.client.query(
        `INSERT INTO user_roles (user_id,church_id,role) VALUES ($1,$2,$3::user_role_enum)`,
        [uid(r), CHURCH, r],
      );
    }
    // A treasurer of a *different* church: the tenant-boundary probe.
    await lab.client.query(
      `INSERT INTO profiles (id,church_id,email,full_name) VALUES ($1,$2,'out@test.local','คนนอก')`,
      [OUTSIDER, OTHER],
    );
    await lab.client.query(
      `INSERT INTO user_roles (user_id,church_id,role) VALUES ($1,$2,'treasurer')`,
      [OUTSIDER, OTHER],
    );
  }, 120_000);

  afterAll(async () => {
    await lab?.stop();
  });

  const access = async (user: string, minRole: string): Promise<boolean> => {
    const r: any = await lab.asUser(user, "authenticated", (c: any) =>
      c.query(`SELECT has_church_access($1,$2::user_role_enum) AS ok`, [CHURCH, minRole]),
    );
    return r.rows[0].ok;
  };

  it("has row level security enabled on every public table", async () => {
    const { rows } = await lab.client.query(`
      SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity
    `);
    expect(rows.map((r: any) => r.relname)).toEqual([]);
  });

  it("actually applies RLS to the test sessions — otherwise nothing below means anything", async () => {
    // An unauthenticated authenticated-role session must not see churches.
    const visible: any = await lab.asUser(
      "00000000-0000-0000-0000-000000000000",
      "authenticated",
      (c: any) => c.query("SELECT count(*)::int AS n FROM churches"),
    );
    expect(visible.rows[0].n).toBe(0);

    // The owner connection bypasses RLS, which is exactly why asUser exists.
    const asOwner = await lab.client.query("SELECT count(*)::int AS n FROM churches");
    expect(asOwner.rows[0].n).toBeGreaterThan(0);
  });

  describe("role hierarchy, as the database resolves it", () => {
    // Observed matrix. Written down so a change to the hierarchy has to be a
    // deliberate edit here, not a silent drift.
    const matrix: Record<Role, Record<string, boolean>> = {
      super_admin:   { pastor: true,  treasurer: true,  finance_staff: true,  approver: true,  counter: true,  member: true },
      pastor:        { pastor: true,  treasurer: true,  finance_staff: true,  approver: true,  counter: false, member: true },
      treasurer:     { pastor: false, treasurer: true,  finance_staff: true,  approver: true,  counter: true,  member: true },
      finance_staff: { pastor: false, treasurer: false, finance_staff: true,  approver: false, counter: false, member: true },
      approver:      { pastor: false, treasurer: false, finance_staff: false, approver: true,  counter: false, member: true },
      counter:       { pastor: false, treasurer: false, finance_staff: false, approver: false, counter: true,  member: true },
      member:        { pastor: false, treasurer: false, finance_staff: false, approver: false, counter: false, member: true },
    };

    it.each(ROLES)("%s resolves exactly its documented capabilities", async (role) => {
      const observed: Record<string, boolean> = {};
      for (const level of Object.keys(matrix[role])) {
        observed[level] = await access(uid(role), level);
      }
      expect(observed).toEqual(matrix[role]);
    });

    it("does not let a pastor record a cash count", () => {
      // Noted explicitly because it is surprising: the hierarchy deliberately
      // excludes pastor from 'counter', keeping counting with treasury staff.
      expect(matrix.pastor.counter).toBe(false);
    });
  });

  describe("tenant isolation", () => {
    it("denies church access to a user of another church, whatever their role", async () => {
      for (const level of ["member", "counter", "treasurer"]) {
        const r: any = await lab.asUser(OUTSIDER, "authenticated", (c: any) =>
          c.query(`SELECT has_church_access($1,$2::user_role_enum) AS ok`, [CHURCH, level]),
        );
        expect(r.rows[0].ok, `outsider gained ${level} access`).toBe(false);
      }
    });

    it("hides another church's offering sessions from a treasurer", async () => {
      await lab.client.query(
        `INSERT INTO offering_sessions
           (church_id, service_date, service_name, status,
            expected_cash_amount, expected_total_amount, created_by)
         VALUES ($1, CURRENT_DATE, 'ของคริสตจักรอื่น', 'counting', 500, 500, $2)`,
        [OTHER, OUTSIDER],
      );

      const mine: any = await lab.asUser(uid("treasurer"), "authenticated", (c: any) =>
        c.query("SELECT count(*)::int AS n FROM offering_sessions WHERE church_id = $1", [OTHER]),
      );
      expect(mine.rows[0].n).toBe(0);
    });

    it("denies an inactive user even with a valid role grant", async () => {
      await lab.client.query("UPDATE profiles SET is_active = false WHERE id = $1", [
        uid("treasurer"),
      ]);
      try {
        expect(await access(uid("treasurer"), "treasurer")).toBe(false);
      } finally {
        await lab.client.query("UPDATE profiles SET is_active = true WHERE id = $1", [
          uid("treasurer"),
        ]);
      }
    });

    it("denies an unauthenticated caller", async () => {
      const { rows } = await lab.client.query(
        `SELECT has_church_access($1,'member'::user_role_enum) AS ok`,
        [CHURCH],
      );
      // No JWT: auth.uid() is NULL and the guard short-circuits.
      expect(rows[0].ok).toBe(false);
    });
  });

  describe("SECURITY DEFINER surface", () => {
    it("pins search_path on every SECURITY DEFINER function", async () => {
      // A definer function without a fixed search_path is a privilege
      // escalation vector: the caller can shadow an unqualified name.
      const { rows } = await lab.client.query(`
        SELECT p.proname FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prosecdef
          AND NOT EXISTS (
            SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) cfg
             WHERE cfg LIKE 'search_path=%'
          )
      `);
      expect(rows.map((r: any) => r.proname)).toEqual([]);
    });

    it("has SECURITY DEFINER functions at all, so the check above is meaningful", async () => {
      const { rows } = await lab.client.query(`
        SELECT count(*)::int AS n FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname='public' AND p.prosecdef
      `);
      expect(rows[0].n).toBeGreaterThan(10);
    });
  });
});

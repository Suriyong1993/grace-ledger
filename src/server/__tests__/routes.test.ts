/**
 * Grace Ledger v2 — API Route Layer Integration Tests
 *
 * Tests handleApiRequest() dispatching across every registered route
 * module by constructing real HTTP Request objects and asserting on the
 * Response. This is dispatch/auth/permission-boundary coverage — the
 * domain logic itself (double-entry rules, approval thresholds, etc.)
 * is covered at the service level by backend.test.ts.
 *
 * Run: npx vitest run src/server/__tests__/routes.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { handleApiRequest } from "@/server/api/routes";
import { db } from "@/server/infrastructure/db";
import { SeedService } from "@/server/services/seed.service";
import { AuthService } from "@/server/services/auth.service";
import { PasswordService } from "@/server/auth/password";
import { users, funds } from "@/db/schema";
import { eq } from "drizzle-orm";

let superAdminToken: string;
let adminToken: string;
let churchId: string;
let fundId: string;

/**
 * Build a Request for handleApiRequest(). Each call site passes a
 * distinct `ip` so state-changing tests across describe blocks don't
 * share a rate-limit bucket (middleware keys on x-forwarded-for/unknown).
 */
function req(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; ip?: string } = {},
): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.ip) headers["x-forwarded-for"] = opts.ip;
  return new Request(`http://localhost/api${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

beforeAll(async () => {
  const result = await SeedService.seed({
    churchName: "Route Test Church",
    adminPassword: "Admin@Route2026!",
  });
  churchId = result.churchId;

  const superAdminLogin = await AuthService.login({
    churchId,
    username: "ผู้ดูแลระบบ",
    password: "Admin@Route2026!",
  });
  superAdminToken = superAdminLogin.token;

  // Second user with the operational "admin" role (fewer permissions
  // than super_admin — used for permission-boundary tests).
  const adminHash = await PasswordService.hashPassword("Ops@Route2026!");
  const [adminUser] = await db
    .insert(users)
    .values({
      churchId,
      name: "ผู้ดูแลปฏิบัติการทดสอบ",
      role: "admin",
      passwordHash: adminHash,
      isActive: true,
    })
    .returning();
  const adminLogin = await AuthService.login({
    churchId,
    username: adminUser.name,
    password: "Ops@Route2026!",
  });
  adminToken = adminLogin.token;

  const [fund] = await db.select().from(funds).where(eq(funds.churchId, churchId)).limit(1);
  fundId = fund.id;
});

// ============================================================================
// Cross-cutting dispatch behavior
// ============================================================================

describe("handleApiRequest dispatch", () => {
  it("returns 404 for an unregistered route", async () => {
    const res = await handleApiRequest(req("GET", "/does-not-exist"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 401 for a protected route with no Authorization header", async () => {
    const res = await handleApiRequest(req("GET", "/income"));
    expect(res.status).toBe(401);
  });

  it("returns 401 for a protected route with a garbage token", async () => {
    const res = await handleApiRequest(req("GET", "/income", { token: "not-a-real-token" }));
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Health (public)
// ============================================================================

describe("GET /health", () => {
  it("responds without authentication", async () => {
    const res = await handleApiRequest(req("GET", "/health"));
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// Auth
// ============================================================================

describe("Auth routes", () => {
  it("POST /auth/login succeeds with valid credentials", async () => {
    const res = await handleApiRequest(
      req("POST", "/auth/login", {
        ip: "10.0.1.1",
        body: {
          churchName: "Route Test Church",
          username: "ผู้ดูแลระบบ",
          password: "Admin@Route2026!",
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
  });

  it("POST /auth/login rejects invalid credentials", async () => {
    const res = await handleApiRequest(
      req("POST", "/auth/login", {
        ip: "10.0.1.1",
        body: {
          churchName: "Route Test Church",
          username: "ผู้ดูแลระบบ",
          password: "wrong-password",
        },
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("GET /auth/me returns the authenticated user", async () => {
    const res = await handleApiRequest(req("GET", "/auth/me", { token: superAdminToken }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.churchId).toBe(churchId);
  });
});

// ============================================================================
// Income
// ============================================================================

// NOTE: income.service.ts, expense.service.ts, and offering-financial's
// underlying service all read/write via the raw Supabase admin client
// (getAdminClient()) rather than Drizzle `db` — a genuine architectural
// inconsistency from the other route modules tested in this file, all of
// which use Drizzle. This means even their GET/list handlers cannot be
// exercised in this environment (no SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
// configured for local/CI test runs — confirmed absent from
// .github/workflows/ci.yml). Only the auth-dispatch boundary (which runs
// before the Supabase-dependent code) is tested here; the actual
// create/list logic needs either real Supabase test credentials wired
// into CI, or migrating these three services onto Drizzle like the rest
// of the route layer. Flagged as a follow-up, not fixed in this pass.

describe("Income routes", () => {
  it("GET /income requires authentication", async () => {
    const res = await handleApiRequest(req("GET", "/income"));
    expect(res.status).toBe(401);
  });

  it("POST /income requires authentication", async () => {
    const res = await handleApiRequest(req("POST", "/income", { ip: "10.0.2.1", body: {} }));
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Expense
// ============================================================================

describe("Expense routes", () => {
  it("GET /expense requires authentication", async () => {
    const res = await handleApiRequest(req("GET", "/expense"));
    expect(res.status).toBe(401);
  });

  it("POST /expense requires authentication", async () => {
    const res = await handleApiRequest(req("POST", "/expense", { ip: "10.0.3.1", body: {} }));
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Offering (financial)
// ============================================================================

describe("Offering-financial routes", () => {
  it("GET /offering-financial requires authentication", async () => {
    const res = await handleApiRequest(req("GET", "/offering-financial"));
    expect(res.status).toBe(401);
  });

  it("POST /offering-financial requires authentication", async () => {
    const res = await handleApiRequest(
      req("POST", "/offering-financial", { ip: "10.0.3.2", body: {} }),
    );
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Budget
// ============================================================================

describe("Budget routes", () => {
  it("GET /budget requires authentication", async () => {
    const res = await handleApiRequest(req("GET", "/budget"));
    expect(res.status).toBe(401);
  });

  it("GET /budget succeeds with a valid session", async () => {
    const res = await handleApiRequest(req("GET", "/budget", { token: superAdminToken }));
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// Funds
// ============================================================================

describe("Fund routes", () => {
  it("GET /funds requires authentication", async () => {
    const res = await handleApiRequest(req("GET", "/funds"));
    expect(res.status).toBe(401);
  });

  it("GET /funds succeeds with a valid session", async () => {
    const res = await handleApiRequest(req("GET", "/funds", { token: superAdminToken }));
    expect(res.status).toBe(200);
  });

  it("GET /funds/:fundId/balance succeeds with a valid session", async () => {
    const res = await handleApiRequest(
      req("GET", `/funds/${fundId}/balance`, { token: superAdminToken }),
    );
    expect(res.status).toBe(200);
  });

  it("POST /funds is forbidden for the operational admin role (fund.manage is super_admin-only)", async () => {
    const res = await handleApiRequest(
      req("POST", "/funds", {
        token: adminToken,
        ip: "10.0.4.1",
        body: { name: "Should be forbidden", fundCode: "X-99" },
      }),
    );
    expect(res.status).toBe(403);
  });
});

// ============================================================================
// Journal
// ============================================================================

describe("Journal routes", () => {
  it("GET /journal requires authentication", async () => {
    const res = await handleApiRequest(req("GET", "/journal"));
    expect(res.status).toBe(401);
  });

  it("GET /journal succeeds with a valid session", async () => {
    const res = await handleApiRequest(req("GET", "/journal", { token: superAdminToken }));
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// Transfers
// ============================================================================

describe("Transfer routes", () => {
  it("POST /transfers requires authentication", async () => {
    const res = await handleApiRequest(req("POST", "/transfers", { body: {} }));
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Reconciliation
// ============================================================================

describe("Reconciliation routes", () => {
  it("GET /reconciliations requires authentication", async () => {
    const res = await handleApiRequest(req("GET", "/reconciliations"));
    expect(res.status).toBe(401);
  });

  it("GET /reconciliations succeeds with a valid session", async () => {
    const res = await handleApiRequest(req("GET", "/reconciliations", { token: superAdminToken }));
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// Periods
// ============================================================================

describe("Period routes", () => {
  it("GET /periods requires authentication", async () => {
    const res = await handleApiRequest(req("GET", "/periods"));
    expect(res.status).toBe(401);
  });

  it("GET /periods succeeds with a valid session", async () => {
    const res = await handleApiRequest(req("GET", "/periods", { token: superAdminToken }));
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// Audit
// ============================================================================

describe("Audit routes", () => {
  it("GET /audit requires authentication", async () => {
    const res = await handleApiRequest(req("GET", "/audit"));
    expect(res.status).toBe(401);
  });

  it("POST /audit/verify succeeds with a valid session", async () => {
    const res = await handleApiRequest(
      req("POST", "/audit/verify", { token: superAdminToken, ip: "10.0.5.1" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.valid).toBe("boolean");
  });
});

// ============================================================================
// Chart of Accounts
// ============================================================================

describe("Chart of accounts routes", () => {
  it("GET /chart-of-accounts succeeds with a valid session", async () => {
    const res = await handleApiRequest(
      req("GET", "/chart-of-accounts", { token: superAdminToken }),
    );
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// Projects
// ============================================================================

describe("Project routes", () => {
  it("POST /projects requires authentication", async () => {
    const res = await handleApiRequest(req("POST", "/projects", { body: {} }));
    expect(res.status).toBe(401);
  });

  it("POST /projects creates a project, then DELETE removes it", async () => {
    const create = await handleApiRequest(
      req("POST", "/projects", {
        token: superAdminToken,
        ip: "10.0.6.1",
        body: {
          name: "Route test project",
          budgetAmount: "10000.00",
          startDate: "2026-08-01",
        },
      }),
    );
    expect(create.status).toBe(201);
    const project = await create.json();

    const del = await handleApiRequest(
      req("DELETE", `/projects/${project.id}`, { token: superAdminToken, ip: "10.0.6.1" }),
    );
    expect(del.status).toBe(200);
  });
});

// ============================================================================
// Members
// ============================================================================

describe("Member routes", () => {
  it("POST /members requires authentication", async () => {
    const res = await handleApiRequest(req("POST", "/members", { body: {} }));
    expect(res.status).toBe(401);
  });

  it("POST /members creates a member", async () => {
    const res = await handleApiRequest(
      req("POST", "/members", {
        token: superAdminToken,
        ip: "10.0.7.1",
        body: { firstName: "ทดสอบ", lastName: "เส้นทาง" },
      }),
    );
    expect(res.status).toBe(201);
  });
});

// ============================================================================
// Offering categories / subcategories
// ============================================================================

describe("Offering category routes", () => {
  it("POST /offering-categories requires authentication", async () => {
    const res = await handleApiRequest(req("POST", "/offering-categories", { body: {} }));
    expect(res.status).toBe(401);
  });

  it("POST /offering-categories creates, PUT updates, reorder + DELETE work end to end", async () => {
    const create = await handleApiRequest(
      req("POST", "/offering-categories", {
        token: superAdminToken,
        ip: "10.0.8.1",
        body: { name: "Route test category" },
      }),
    );
    expect(create.status).toBe(201);
    const category = await create.json();

    const update = await handleApiRequest(
      req("PUT", "/offering-categories", {
        token: superAdminToken,
        ip: "10.0.8.1",
        body: { categoryId: category.id, name: "Route test category (updated)" },
      }),
    );
    expect(update.status).toBe(200);

    const reorder = await handleApiRequest(
      req("POST", "/offering-categories/reorder", {
        token: superAdminToken,
        ip: "10.0.8.1",
        body: { orderedIds: [category.id] },
      }),
    );
    expect(reorder.status).toBe(200);

    const del = await handleApiRequest(
      req("DELETE", `/offering-categories/${category.id}`, {
        token: superAdminToken,
        ip: "10.0.8.1",
      }),
    );
    expect(del.status).toBe(200);
  });
});

describe("Offering subcategory routes", () => {
  it("POST /offering-subcategories requires authentication", async () => {
    const res = await handleApiRequest(req("POST", "/offering-subcategories", { body: {} }));
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Count sheets (offering.routes.ts)
// ============================================================================

describe("Count sheet routes", () => {
  it("GET /count-sheets requires authentication", async () => {
    const res = await handleApiRequest(req("GET", "/count-sheets"));
    expect(res.status).toBe(401);
  });

  it("GET /count-sheets succeeds with a valid session", async () => {
    const res = await handleApiRequest(req("GET", "/count-sheets", { token: superAdminToken }));
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// Settings
// ============================================================================

describe("Settings routes", () => {
  it("GET /settings requires authentication", async () => {
    const res = await handleApiRequest(req("GET", "/settings"));
    expect(res.status).toBe(401);
  });

  it("PUT /settings is forbidden for the operational admin role (settings.write is super_admin-only)", async () => {
    const res = await handleApiRequest(
      req("PUT", "/settings", {
        token: adminToken,
        ip: "10.0.9.1",
        body: { churchName: "Should be forbidden" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("PUT /settings succeeds for super_admin", async () => {
    const res = await handleApiRequest(
      req("PUT", "/settings", {
        token: superAdminToken,
        ip: "10.0.9.2",
        body: { churchName: "Route Test Church (renamed)" },
      }),
    );
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// Seed (should not be re-runnable against an already-seeded church)
// ============================================================================

describe("Seed route", () => {
  it("POST /seed requires authentication or a setup key", async () => {
    const res = await handleApiRequest(req("POST", "/seed", { body: {} }));
    expect([401, 400, 403]).toContain(res.status);
  });
});

// ============================================================================
// LINE users
// ============================================================================

describe("LINE user routes", () => {
  it("GET /line-users/status requires authentication", async () => {
    const res = await handleApiRequest(req("GET", "/line-users/status"));
    expect(res.status).toBe(401);
  });

  it("GET /line-users/status succeeds with a valid session", async () => {
    const res = await handleApiRequest(
      req("GET", "/line-users/status", { token: superAdminToken }),
    );
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// AI proxy
// ============================================================================

describe("AI proxy routes", () => {
  it("POST /ai/parse-document requires authentication", async () => {
    const res = await handleApiRequest(req("POST", "/ai/parse-document", { body: {} }));
    expect(res.status).toBe(401);
  });
});

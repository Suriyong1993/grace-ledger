import { afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// scripts/lint-secrets.mjs is the guard that keeps a privileged credential out
// of the repository, so the guard itself has to be proven to fire. A linter
// that silently passes everything is worse than no linter: it turns "we checked
// for committed secrets" into a false statement on every CI run.
//
// These tests run the real script, unmodified, against throwaway git
// repositories in the system temp directory. Fixtures are assembled at runtime
// from base64url-encoded parts, so this file never contains a credential-shaped
// literal of its own (which lint-secrets would rightly flag in a tracked file).

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LINT_SCRIPT = path.join(REPO_ROOT, "scripts/lint-secrets.mjs");

/**
 * Assemble a fixture at runtime. This file is itself tracked and therefore
 * itself scanned by the lint under test, so it must never contain a complete
 * credential-shaped literal — `cat("AKIA", "IOSFODNN7EXAMPLE")` is not a match,
 * the string it produces is.
 */
const cat = (...parts: string[]) => parts.join("");

const workdirs: string[] = [];

/** Build a Supabase-shaped JWT whose payload declares the given role. */
function fakeJwt(role: string): string {
  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc({
    iss: "supabase",
    ref: "projectref",
    role,
    iat: 1700000000,
    exp: 2100000000,
  })}.${"s".repeat(43)}`;
}

/** Create a temp git repo containing lint-secrets.mjs plus the given files. */
function sandbox(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gl-lint-secrets-"));
  workdirs.push(dir);
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.copyFileSync(LINT_SCRIPT, path.join(dir, "scripts/lint-secrets.mjs"));
  for (const [name, body] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, "utf8");
  }
  execFileSync("git", ["init", "--quiet"], { cwd: dir });
  execFileSync("git", ["add", "-A"], { cwd: dir });
  return dir;
}

function runLint(dir: string): { code: number; stderr: string; stdout: string } {
  try {
    const stdout = execFileSync("node", ["scripts/lint-secrets.mjs"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err: any) {
    return {
      code: err.status ?? 1,
      stdout: String(err.stdout ?? ""),
      stderr: String(err.stderr ?? ""),
    };
  }
}

describe("scripts/lint-secrets.mjs", () => {
  afterAll(() => {
    for (const dir of workdirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("passes a clean repository", () => {
    const dir = sandbox({
      "src/lib/supabase/client.ts": [
        `const ANON_KEY = "${fakeJwt("anon")}";`,
        "export const url = process.env.SUPABASE_URL;",
        "",
      ].join("\n"),
    });
    const res = runLint(dir);
    expect(res.stderr).toBe("");
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("lint-secrets passed");
  });

  it("fails on a committed Supabase service_role JWT — the 2026-09-11 finding", () => {
    const dir = sandbox({
      // Neutral variable name on purpose: this fixture targets the JWT rule.
      // Naming it SERVICE_ROLE_KEY would trip the "privileged credential
      // assigned a literal value" rule on THIS tracked source file instead
      // (that rule has its own fixture below).
      "scripts/operator.mjs": cat('const KEY = "', fakeJwt("service_role"), '";\n'),
    });
    const res = runLint(dir);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("service_role JWT (bypasses RLS)");
    expect(res.stderr).toContain("scripts/operator.mjs:1");
    // The credential value itself must not be echoed into the log.
    expect(res.stderr).not.toContain(fakeJwt("service_role"));
    expect(res.stderr).toContain("ROTATE");
  });

  it("allows the public anon key, which ships inside the browser bundle", () => {
    const dir = sandbox({
      "src/lib/supabase/client.ts": `const K = "${fakeJwt("anon")}";\n`,
      "scripts/other.mjs": `const K2 = "${fakeJwt("authenticated")}";\n`,
    });
    expect(runLint(dir).code).toBe(0);
  });

  it("fails on a database URL with an embedded password", () => {
    const dir = sandbox({
      "scripts/db.mjs": cat(
        'const url = "postgres://postgres.abc:',
        'sup3rsecret@db.example.com:5432/postgres";\n',
      ),
    });
    const res = runLint(dir);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("embedded password");
  });

  it("fails on a literal assigned to a privileged-looking name, but not on an env read", () => {
    const bad = sandbox({
      "scripts/a.mjs": cat('const SUPABASE_SECRET_KEY = ', '"abcdef123456789";\n'),
    });
    expect(runLint(bad).code).toBe(1);

    const good = sandbox({
      "scripts/b.mjs": "const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;\n",
    });
    expect(runLint(good).code).toBe(0);
  });

  it("fails on vendor credential shapes and private key blocks", () => {
    const dir = sandbox({
      "scripts/c.mjs": [
        cat('const gh = "ghp_', '0123456789abcdefghijklmnopqrstuvwxyzABC";'),
        cat('const aws = "AKIA', 'IOSFODNN7EXAMPLE";'),
        cat('const openai = "sk-proj-', '0123456789abcdefghijABCDEF";'),
        cat("const pem = `-----BEGIN RSA PRIVATE ", "KEY-----`;"),
        "",
      ].join("\n"),
    });
    const res = runLint(dir);
    expect(res.code).toBe(1);
    for (const rule of [
      "GitHub credential",
      "AWS-style access key id",
      "OpenAI API key",
      "private key block",
    ]) {
      expect(res.stderr, rule).toContain(rule);
    }
  });

  it("reports every finding, not just the first, and names each file:line", () => {
    const dir = sandbox({
      "scripts/x.mjs": `const A = "${fakeJwt("service_role")}";\nconst B = 1;\n`,
      "scripts/y.mjs": cat('const C = "postgresql://u:', 'p@h:5432/d";\n'),
    });
    const res = runLint(dir);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("2 finding(s)");
    expect(res.stderr).toContain("scripts/x.mjs:1");
    expect(res.stderr).toContain("scripts/y.mjs:1");
  });

  it("fails on a bare password literal — the shape the audit found in five E2E scripts", () => {
    // Both the identifier and the assignment are split across `cat` arguments:
    // written contiguously, this tracked test file would itself present the
    // shape the rule looks for and be flagged by the self-check below.
    const dir = sandbox({
      "scripts/e2e.mjs": cat("const PASS", "WORD = ", '"hunter2-fixture";\n'),
    });
    const res = runLint(dir);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain("privileged credential assigned a literal value");
    expect(res.stderr).toContain("scripts/e2e.mjs:1");
  });

  it("exempts the single allowlisted value, and only that value", () => {
    // scripts/pg-lab.mjs:46 — the password of the throwaway local PostgreSQL
    // cluster the harness starts and destroys inside one test run.
    const allowed = sandbox({
      "scripts/pg-lab.mjs": cat("const LAB_PASS", "WORD = ", '"GLpg#Lab2026x";\n'),
    });
    const res = runLint(allowed);
    expect(res.stderr, res.stderr).toBe("");
    expect(res.code).toBe(0);

    // The allowlist is keyed on the value, not the file or the variable name,
    // so any other literal in the same shape is still a finding.
    const notAllowed = sandbox({
      "scripts/pg-lab.mjs": cat("const LAB_PASS", "WORD = ", '"a-different-one";\n'),
    });
    expect(runLint(notAllowed).code).toBe(1);
  });

  it("the repository it ships in passes its own check", () => {
    // Guards against the lint being added in a passing state and then broken by
    // the next commit that re-introduces a literal.
    const res = runLint(REPO_ROOT);
    expect(res.stderr).toBe("");
    expect(res.code).toBe(0);
  });
});

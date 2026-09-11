#!/usr/bin/env node
// Target: scripts/lint-secrets.mjs
//
// Mechanical guard against privileged credentials being committed again.
//
// WHY: the 2026-09-11 audit found a live Supabase `service_role` JWT pasted
// into three scripts and a seeded user's real password pasted into five. The
// service_role role bypasses Row Level Security entirely, so committing it
// handed anyone with repo read access every church's ledger, member giving
// records, PIN hashes and audit logs. Deleting the literals is not enough —
// this lint is what stops them coming back.
//
// Same shape as scripts/lint-design.mjs: regex over tracked file text, an
// explicitly commented ALLOWLIST, non-zero exit on any finding. Deliberately
// simple; false positives are allowlisted with a reason, never silently
// tolerated.
//
// What is NOT a finding:
//   * the Supabase **anon** key. It is public by design, ships inside the
//     browser bundle (src/lib/supabase/client.ts), and carries no privilege
//     beyond what RLS grants.
//   * the word `service_role` used as a PostgreSQL role name by the test
//     harness (scripts/pg-lab.mjs, tests/integration/phase2b/helpers.ts).
//     The rules below match credential *values*, not role names.
//   * anything listed in ALLOWED_VALUES, each entry carrying the reason it is
//     not a secret. Today that is exactly one value: the password of the
//     throwaway local PostgreSQL cluster the test harness builds and destroys
//     inside a single run.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Files this lint never scans, with the reason for each. */
const IGNORED = [
  // This file necessarily describes the shapes it detects, and
  // scripts/supabase-credentials.mjs documents the incident. Neither contains
  // a live credential value.
  "scripts/lint-secrets.mjs",
];

/**
 * Each rule matches a credential VALUE, not a keyword, so ordinary code that
 * mentions "service_role" or "password" as an identifier is not flagged.
 */
const RULES = [
  {
    name: "Supabase service_role JWT (bypasses RLS)",
    // A JWT is three base64url segments. Decode the payload and fail only when
    // it declares the service_role role, so the public anon key stays allowed.
    re: /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    verify: (match) => {
      try {
        const payload = JSON.parse(
          Buffer.from(match.split(".")[1], "base64url").toString("utf8"),
        );
        return payload?.role === "service_role";
      } catch {
        return false;
      }
    },
  },
  {
    name: "database connection string with an embedded password",
    re: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:/@]+:[^\s@]+@[^\s]+/g,
  },
  {
    name: "AWS-style access key id",
    re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    name: "GitHub credential",
    re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
  },
  {
    name: "Slack credential",
    re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    name: "Google API key",
    re: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    name: "OpenAI API key",
    re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "private key block",
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g,
  },
  {
    // Matches `SERVICE_ROLE_KEY = "..."`, `secretKey: '...'`,
    // `const PASSWORD = "..."` etc. — a literal assigned to a name that says
    // "this is privileged". Reading from process.env is fine and does not
    // match, because there is no quoted value.
    //
    // Bare PASSWORD/PASSWD are included because that is exactly the shape the
    // audit found in the wild (`const PASSWORD = "<seeded user's password>"`
    // in five browser-E2E scripts). Genuine non-secrets of that shape are
    // listed in ALLOWED_VALUES below with a reason, never silently tolerated.
    name: "privileged credential assigned a literal value",
    re: /\b[A-Za-z0-9_]*(?:SERVICE_ROLE|SERVICE_KEY|SECRET_KEY|API_SECRET|ACCESS_TOKEN|PRIVATE_KEY|DB_PASSWORD|DATABASE_PASSWORD|PASSWORD|PASSWD)[A-Za-z0-9_]*\s*[:=]\s*(?:"[^"\n]{6,}"|'[^'\n]{6,}'|`[^`\n]{6,}`)/g,
  },
];

/**
 * Individual matched VALUES that are not findings, each with its reason.
 *
 * Deliberately narrow and keyed on the literal value rather than a file path,
 * so an entry keeps working when the file moves and cannot blanket-exempt a
 * whole file. Adding an entry here must be a deliberate, reviewable act: if a
 * real credential ever needs exempting, the answer is to rotate it and remove
 * it from the repo, not to allowlist it.
 */
const ALLOWED_VALUES = [
  {
    value: "GLpg#Lab2026x",
    reason:
      "scripts/pg-lab.mjs:46 — password for the throwaway PostgreSQL cluster the " +
      "test harness starts and destroys inside a single run. It is bound to the " +
      "local socket only, is never a production credential, and the harness must " +
      "work with zero configuration.",
  },
];

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.split("\0").filter(Boolean);
}

const findings = [];
let scanned = 0;

for (const file of trackedFiles()) {
  const rel = relative(ROOT, join(ROOT, file));
  if (IGNORED.includes(rel)) continue;
  // Binary-ish and vendored paths are not credential sources here; skipping
  // them keeps the lint fast enough to run on every commit.
  if (/\.(png|jpe?g|gif|webp|ico|zip|woff2?|ttf|pdf|pyc)$/i.test(rel)) continue;

  let text;
  try {
    text = readFileSync(join(ROOT, file), "utf8");
  } catch {
    continue; // e.g. a submodule pointer
  }
  scanned += 1;

  const lines = text.split("\n");
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let match;
      while ((match = rule.re.exec(line)) !== null) {
        if (rule.verify && !rule.verify(match[0])) continue;
        if (ALLOWED_VALUES.some((allowed) => match[0].includes(allowed.value))) continue;
        findings.push({
          file: rel,
          line: index + 1,
          rule: rule.name,
          // Never echo the credential itself into a CI log — that would
          // re-publish exactly what this lint exists to keep out of the repo.
          snippet: `${match[0].slice(0, 12)}… (${match[0].length} chars)`,
        });
        if (match.index === rule.re.lastIndex) rule.re.lastIndex += 1;
      }
    }
  });
}

if (findings.length > 0) {
  console.error(`\nlint-secrets FAILED — ${findings.length} finding(s):\n`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.rule}`);
    console.error(`      matched ${f.snippet}`);
  }
  console.error(
    [
      "",
      "  A committed privileged credential cannot be un-leaked by deleting it:",
      "  it stays in git history. Move the value to the environment",
      "  (scripts/supabase-credentials.mjs), then ROTATE it at the issuer",
      "  (Supabase → Project Settings → API for the service_role key).",
      "",
      "  The Supabase anon key is public by design and is not a finding.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`lint-secrets passed. (scanned ${scanned} tracked files)`);

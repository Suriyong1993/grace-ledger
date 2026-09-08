#!/usr/bin/env node
// Target: scripts/lint-design.mjs (new file)
//
// Mechanical guard against undocumented literal color/radius/shadow/font-size values creeping back into
// src/**. Values that belong in design-system-extracted/tokens/*.css or src/styles/app.css must not be
// retyped inline. See DESIGN.md and CLAUDE.md's "Design source of truth" section.
//
// This is intentionally simple (regex over file text, no CSS parser) — false positives are handled via the
// ALLOWLIST below, each entry commented with why it exists and which phase is expected to remove it.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const SRC = join(ROOT, "src");

// Each pattern targets one class of literal that should come from a token instead.
const PATTERNS = [
  { name: "literal font-size", re: /font-size:\s*[0-9.]+px/g },
  { name: "literal border-radius", re: /border-radius:\s*[0-9]+px/g },
  { name: "rgba()/rgb() color literal", re: /rgba?\([^)]*\)/g },
  { name: "hex color literal", re: /#[0-9a-fA-F]{3,8}\b/g },
];

// Each entry: file path relative to repo root, and the exact number of expected hits per pattern name.
// A count mismatch (higher OR lower) fails the lint — this catches both new violations and forgotten
// cleanup (so nobody "fixes" an allowlisted file and leaves a stale, now-too-generous allowance).
//
// Every entry here was verified against the live repo on 2026-09-02 (Strategic Review). Each is tagged
// with the phase expected to remove it — do not raise a count without also tightening the tag.
const ALLOWLIST = {
  // Offering module predates the .gl-* class layer (Strategic Review §5). Removed in R5.
  "src/components/offering/OfferingEntryForm.ts": {
    "literal font-size": 8,       // 24px h1, 13.5/12.5/14/11.5px labels — R5
    "literal border-radius": 5,   // var(--radius-lg, 12px) fallback + 6px stepper buttons — R5
    "rgba()/rgb() color literal": 1, // box-shadow rgba(0,0,0,0.02) — R5
    "hex color literal": 0,
  },
  "src/components/offering/OfferingReviewSheet.ts": {
    "literal font-size": 8,
    "literal border-radius": 3,
    "rgba()/rgb() color literal": 2,
    "hex color literal": 0,
  },
  "src/components/offering/VarianceResolutionView.ts": {
    "literal font-size": 5,
    "literal border-radius": 3,
    "rgba()/rgb() color literal": 6,
    "hex color literal": 0,
  },
  // Confirmation modal uses ad-hoc semantic tints instead of --pending-muted/--expense-muted. R3/R6 cleanup.
  "src/components/ai/ProposalConfirmationModal.ts": {
    "literal font-size": 1,       // 10px font-family: var(--font-mono) debug block
    "literal border-radius": 0,
    "rgba()/rgb() color literal": 5,
    "hex color literal": 0,
  },
  // Login surface owns its own stylesheet by design (DESIGN.md hierarchy, item 4) — its pixel sizes
  // (avatar 50/68/72/76/190px etc.) are documented, intentional, feature-local values, not drift. Not
  // scheduled for removal; re-verify against design-plans/01 if this file changes.
  "src/components/login/loginStyles.ts": {
    "literal font-size": 0,
    "literal border-radius": 2,   // 16px / 18px card radii predating the shared token pass
    "rgba()/rgb() color literal": 3,
    "hex color literal": 1,       // #ffffff literal
  },
  // AppShell's own <style> block owns its shell-local look (DESIGN.md hierarchy) — the shell mark/avatar
  // flat-color fix (R1) removed the only hex/gradient here; nothing left to allow. Present with all-zero
  // counts so a future re-introduction of a literal is caught immediately.
  "src/components/layout/AppShell.ts": {
    "literal font-size": 0,
    "literal border-radius": 0,
    "rgba()/rgb() color literal": 0,
    "hex color literal": 0,
  },
  // ReportsPage's inline progress-bar radius (3px, used nowhere else) predates .gl-progress (R2/R6).
  "src/pages/ReportsPage.ts": {
    "literal font-size": 2,       // 12px meta labels
    "literal border-radius": 4,   // 3px progress bars x2 (income/expense) — R6
    "rgba()/rgb() color literal": 0,
    "hex color literal": 0,
  },
  "src/pages/DashboardPage.ts": {
    "literal font-size": 0,
    "literal border-radius": 4,   // trend-chart bar corners (2px x2) and legend swatches (2px x2) — R4
    "rgba()/rgb() color literal": 0,
    "hex color literal": 1,       // color: #ffffff on the shell avatar text — pairs with AppShell fix, R1 leftover, R3
  },
};

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function countMatches(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

let failed = false;
const files = walk(SRC);

for (const file of files) {
  const rel = relative(ROOT, file).split(require("node:path").sep).join("/");
  const text = readFileSync(file, "utf8");
  const allowed = ALLOWLIST[rel];

  for (const { name, re } of PATTERNS) {
    const count = countMatches(text, re);
    const allowedCount = allowed ? allowed[name] ?? 0 : 0;

    if (count !== allowedCount) {
      failed = true;
      const verb = count > allowedCount ? "found MORE than allowed" : "found FEWER than allowed — tighten the allowlist";
      console.error(`[lint-design] ${rel}: ${verb} for "${name}" (expected ${allowedCount}, got ${count})`);
    }
  }
}

if (failed) {
  console.error("\nlint-design FAILED. See DESIGN.md and COMPONENTS.md before adding a literal value.");
  process.exit(1);
} else {
  console.log("lint-design passed.");
}

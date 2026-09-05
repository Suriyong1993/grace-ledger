#!/usr/bin/env node
// Target: scripts/lint-design.mjs
//
// Mechanical guard against undocumented literal color/radius/shadow/font-size values creeping back into
// src/**. Values that belong in design-system-extracted/tokens/*.css or src/styles/app.css must not be
// retyped inline. See DESIGN.md and CLAUDE.md's "Design source of truth" section.
//
// This is intentionally simple (regex over file text, no CSS parser) — false positives are handled via the
// ALLOWLIST below, each entry commented with why it exists and which phase is expected to remove it.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, "src");

// Each pattern targets one class of literal that should come from a token instead.
const PATTERNS = [
  { name: "literal font-size", re: /font-size:\s*[0-9.]+px/g },
  { name: "literal border-radius", re: /border-radius:\s*[0-9]+px/g },
  { name: "rgba()/rgb() color literal", re: /rgba?\([^)]*\)/g },
  { name: "hex color literal", re: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b(?!-)/g },
  // Blur belongs on an overlay scrim only. Glass on a content surface makes the
  // figures behind it unreadable and costs frame time on a phone, which is why
  // the directive rejects it. Each allowed use is counted below.
  { name: "backdrop-filter", re: /backdrop-filter:/g },
];

// Each entry: file path relative to repo root, and the exact number of expected hits per pattern name.
// A count mismatch (higher OR lower) fails the lint — this catches both new violations and forgotten
// cleanup (so nobody "fixes" an allowlisted file and leaves a stale, now-too-generous allowance).
const ALLOWLIST = {
  // Application stylesheet. Brought under this lint in the 2026-09-05 refinement
  // pass; before that only .ts files were scanned, which is how the "2026
  // Evolved Glassmorphism" layer landed unnoticed. Every remaining literal is
  // accounted for here:
  //   font-size 1, border-radius 3 — dev-only HMR badge (1 of each) and two
  //     hairline/pill radii below the smallest radius token. R6 cleanup.
  //   rgb/rgba 7 — dev-only HMR badge (2), two overlay scrims that need a plain
  //     black veil (2), and three faint ink-tinted shadows written inline
  //     rather than as tokens (3). R6 cleanup.
  //   hex 10 — dev-only HMR badge (1) and the print stylesheet (9), which must
  //     use pure black and white on paper.
  //   backdrop-filter 5 — overlay scrims only: modal backdrop, sheet backdrop,
  //     sticky mobile action bar. No content surface may blur.
  "src/styles/app.css": {
    "literal font-size": 1,
    "literal border-radius": 3,
    "rgba()/rgb() color literal": 7,
    "hex color literal": 10,
    "backdrop-filter": 5,
  },

  // Confirmation modal uses ad-hoc semantic tints instead of --pending-muted/--expense-muted. R3/R6 cleanup.
  "src/components/ai/ProposalConfirmationModal.ts": {
    "literal font-size": 0,
    "literal border-radius": 0,
    "rgba()/rgb() color literal": 7,
    "hex color literal": 0,
  },
};

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (
      (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) ||
      entry.endsWith(".css")
    ) {
      out.push(full);
    }
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
  const rel = relative(ROOT, file).split(sep).join("/");
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

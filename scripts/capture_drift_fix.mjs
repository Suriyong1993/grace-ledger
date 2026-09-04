import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "docs", "screenshots", "drift-fix-2026-09-04");
const PORT = 5190;
const BASE_URL = `http://localhost:${PORT}`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer() {
  console.log(`Starting Vite on port ${PORT}...`);
  const proc = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout.on("data", (d) => process.stdout.write(d.toString()));
  proc.stderr.on("data", (d) => process.stderr.write(d.toString()));

  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) {
        console.log("Vite dev server is ready!");
        return proc;
      }
    } catch {
      // Keep waiting
    }
  }
  throw new Error("Vite server failed to start within 15 seconds");
}

async function capture(page, name, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: true });
  console.log(`  ✓ ${name}`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Output: ${OUT_DIR}\n`);

  const server = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext();

  const routes = [
    { path: "/transactions", name: "transactions" },
    { path: "/", name: "dashboard" },
  ];

  const viewports = [
    { width: 1280, height: 900, suffix: "desktop" },
    { width: 390, height: 844, suffix: "mobile" },
  ];

  try {
    for (const route of routes) {
      console.log(`Capturing ${route.name}:`);
      const page = await context.newPage();
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" });

      for (const vp of viewports) {
        await capture(page, `${route.name}-${vp.suffix}`, vp);
      }

      await page.close();
    }

    console.log(`\nDone! Screenshots saved to ${OUT_DIR}`);
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

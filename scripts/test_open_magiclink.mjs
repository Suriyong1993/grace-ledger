import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import {
  serviceRoleKey,
  supabaseUrl,
  testOperatorEmail,
} from "./supabase-credentials.mjs";

// service_role BYPASSES RLS: it is read from the environment, never committed.
const SUPABASE_URL = supabaseUrl();
const SERVICE_ROLE_KEY = serviceRoleKey();

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const targetEmail = testOperatorEmail();
  console.log("Generating fresh magiclink for test:", targetEmail);

  const linkRes = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetEmail,
    options: { redirectTo: "http://localhost:5174/" },
  });

  const actionLink = linkRes.data?.properties?.action_link;
  console.log("Action link generated:", actionLink);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Opening action link in browser...");
  await page.goto(actionLink, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const title = await page.title();
  const url = page.url();
  const content = await page.content();

  console.log("Page URL after redirect:", url);
  console.log("Contains 'ตั้งรหัส PIN 6 หลักของคุณ':", content.includes("ตั้งรหัส PIN 6 หลักของคุณ"));
  console.log("Contains 'วันนี้ใครเข้าใช้งาน?':", content.includes("วันนี้ใครเข้าใช้งาน?"));
  console.log("Contains 'Grace Ledger':", content.includes("Grace Ledger"));

  await page.screenshot({ path: "C:/Users/Administrator/.gemini/antigravity/brain/4db218c9-363c-4da2-9271-bf90ff6ccb5c/test_magiclink_landing.png" });

  await browser.close();
}

main().catch(console.error);

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jeklcfpqmytdmwczxqlx.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impla2xjZnBxbXl0ZG13Y3p4cWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njk3NjQ0NSwiZXhwIjoyMTAyNTUyNDQ1fQ.goxdjDIYz5hk0wSypHqVVWQr-fHbPbNMX4fG968Mn6k";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const targetEmail = "suriyongbralpret7@gmail.com";
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

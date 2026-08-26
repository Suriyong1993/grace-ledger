import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jeklcfpqmytdmwczxqlx.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impla2xjZnBxbXl0ZG13Y3p4cWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njk3NjQ0NSwiZXhwIjoyMTAyNTUyNDQ1fQ.goxdjDIYz5hk0wSypHqVVWQr-fHbPbNMX4fG968Mn6k";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impla2xjZnBxbXl0ZG13Y3p4cWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NzY0NDUsImV4cCI6MjEwMjU1MjQ0NX0.ZSM88SkzsWhqsD7x8gpyTSguKB2oG51lZqKLGHQETHA";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const anon = createClient(SUPABASE_URL, ANON_KEY);

async function testEmail() {
  const targetEmail = "suriyongbralpret7@gmail.com";
  console.log("Testing email dispatch methods for:", targetEmail);

  // 1. generateLink check
  console.log("\n1. admin.auth.admin.generateLink():");
  const linkRes = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetEmail,
    options: { redirectTo: "http://localhost:5174/#setup-pin" },
  });
  console.log("generateLink error:", linkRes.error);
  console.log("generateLink action_link:", linkRes.data?.properties?.action_link);

  // 2. signInWithOtp check (This is what triggers real email dispatch via Supabase Mailer)
  console.log("\n2. anon.auth.signInWithOtp():");
  const otpRes = await anon.auth.signInWithOtp({
    email: targetEmail,
    options: { emailRedirectTo: "http://localhost:5174/#setup-pin" },
  });
  console.log("signInWithOtp error:", otpRes.error);
  console.log("signInWithOtp data:", otpRes.data);
}

testEmail().catch(console.error);

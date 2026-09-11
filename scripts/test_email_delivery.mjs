import { createClient } from "@supabase/supabase-js";
import {
  anonKey,
  serviceRoleKey,
  supabaseUrl,
  testOperatorEmail,
} from "./supabase-credentials.mjs";

// service_role BYPASSES RLS: it is read from the environment, never committed.
const SUPABASE_URL = supabaseUrl();
const SERVICE_ROLE_KEY = serviceRoleKey();
const ANON_KEY = anonKey();

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const anon = createClient(SUPABASE_URL, ANON_KEY);

async function testEmail() {
  const targetEmail = testOperatorEmail();
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

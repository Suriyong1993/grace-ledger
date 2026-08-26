import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jeklcfpqmytdmwczxqlx.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impla2xjZnBxbXl0ZG13Y3p4cWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NzY0NDUsImV4cCI6MjEwMjU1MjQ0NX0.ZSM88SkzsWhqsD7x8gpyTSguKB2oG51lZqKLGHQETHA";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function runReadOnlyAudit() {
  console.log("==================================================================");
  console.log("READ-ONLY RELEASE AUDIT PROBE — EVIDENCE GATHERING");
  console.log("==================================================================");

  const results = {};

  // Probe 1: login-profiles live Edge Function
  console.log("\n[Probe 1: login-profiles live Edge Function]");
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/login-profiles`, {
      method: "POST",
      headers: {
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const status = res.status;
    const body = await res.json();
    console.log("login-profiles HTTP status:", status);
    console.log("login-profiles response body:", JSON.stringify(body, null, 2));
    results.loginProfiles = { status, body };
  } catch (err) {
    console.error("login-profiles error:", err.message);
    results.loginProfiles = { error: err.message };
  }

  // Probe 2: verify-pin live Edge Function
  console.log("\n[Probe 2: verify-pin live Edge Function]");
  try {
    const dummyId = "00000000-0000-0000-0000-000000000000";
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-pin`, {
      method: "POST",
      headers: {
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profile_id: dummyId, pin: "123456" }),
    });
    const status = res.status;
    const body = await res.json();
    console.log("verify-pin HTTP status (dummy request):", status);
    console.log("verify-pin response body:", JSON.stringify(body, null, 2));
    results.verifyPin = { status, body };
  } catch (err) {
    console.error("verify-pin error:", err.message);
    results.verifyPin = { error: err.message };
  }

  // Probe 3: request-pin-bootstrap live Edge Function
  console.log("\n[Probe 3: request-pin-bootstrap live Edge Function]");
  try {
    const dummyId = "00000000-0000-0000-0000-000000000000";
    const res = await fetch(`${SUPABASE_URL}/functions/v1/request-pin-bootstrap`, {
      method: "POST",
      headers: {
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profile_id: dummyId }),
    });
    const status = res.status;
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    console.log("request-pin-bootstrap HTTP status:", status);
    console.log("request-pin-bootstrap response body:", body);
    results.requestPinBootstrap = { status, body };
  } catch (err) {
    console.error("request-pin-bootstrap error:", err.message);
    results.requestPinBootstrap = { error: err.message };
  }

  // Probe 4: Read-only DB check for auth_pins RLS
  console.log("\n[Probe 4: Read-only DB check for auth_pins]");
  try {
    const { data, error, count } = await supabase
      .from("auth_pins")
      .select("*", { count: "exact", head: true });
    console.log("Direct select from auth_pins error:", error?.message, error?.code);
    console.log("Direct select from auth_pins count:", count, "data:", data);
    results.authPinsSelect = { error: error?.message, code: error?.code, count, data };
  } catch (err) {
    console.error("auth_pins select error:", err.message);
    results.authPinsSelect = { error: err.message };
  }

  // Probe 5: Read-only DB check for profiles
  console.log("\n[Probe 5: Read-only DB check for profiles]");
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, is_active, church_id")
      .limit(10);
    console.log("Profiles count reachable by anon:", data?.length, "error:", error?.message);
    results.profiles = { count: data?.length, error: error?.message, data };
  } catch (err) {
    console.error("profiles select error:", err.message);
    results.profiles = { error: err.message };
  }

  // Probe 6: Check RPC set_own_pin from anon
  console.log("\n[Probe 6: Call RPC set_own_pin from unauthenticated client]");
  try {
    const { data, error } = await supabase.rpc("set_own_pin", {
      p_current_pin: null,
      p_new_pin: "849201",
    });
    console.log("set_own_pin unauthenticated response data:", data, "error:", error?.message);
    results.setOwnPinAnon = { data, error: error?.message };
  } catch (err) {
    console.error("set_own_pin error:", err.message);
    results.setOwnPinAnon = { error: err.message };
  }

  // Probe 7: Check RPC verify_and_consume_pin from anon
  console.log("\n[Probe 7: Call RPC verify_and_consume_pin from unauthenticated client]");
  try {
    const { data, error } = await supabase.rpc("verify_and_consume_pin", {
      p_profile_id: "00000000-0000-0000-0000-000000000000",
      p_church_id: "00000000-0000-0000-0000-000000000000",
      p_pin: "849201",
    });
    console.log("verify_and_consume_pin unauthenticated response data:", data, "error:", error?.message);
    results.verifyAndConsumePinAnon = { data, error: error?.message };
  } catch (err) {
    console.error("verify_and_consume_pin error:", err.message);
    results.verifyAndConsumePinAnon = { error: err.message };
  }

  console.log("\n==================================================================");
  console.log("AUDIT PROBES COMPLETE");
  console.log("==================================================================");
}

runReadOnlyAudit().catch(console.error);

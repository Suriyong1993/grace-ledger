import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jeklcfpqmytdmwczxqlx.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impla2xjZnBxbXl0ZG13Y3p4cWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NzY0NDUsImV4cCI6MjEwMjU1MjQ0NX0.ZSM88SkzsWhqsD7x8gpyTSguKB2oG51lZqKLGHQETHA";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function main() {
  const profileId = "f0fc6cdd-07ad-4d76-8fe6-80427525d340";
  console.log("Triggering request-pin-bootstrap for target profile:", profileId);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/request-pin-bootstrap`, {
    method: "POST",
    headers: {
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profile_id: profileId,
      redirect_to: "http://localhost:5174/#setup-pin",
    }),
  });

  const status = res.status;
  const body = await res.json();
  console.log("HTTP status:", status);
  console.log("Response body:", body);
}

main().catch(console.error);

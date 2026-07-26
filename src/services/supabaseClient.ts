// src/services/supabaseClient.ts
// Supabase client initialized with the user's session
// Uses the @supabase/supabase-js v2 browser client

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. " +
      "Please set them in .env or Vercel environment variables.",
  );
}

/**
 * Supabase client for the browser frontend.
 * Uses the anon key — RLS policies enforce access control at the DB level.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      "x-client-info": "grace-ledger-client",
    },
  },
});

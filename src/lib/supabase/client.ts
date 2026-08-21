import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./types";

const DEFAULT_SUPABASE_URL = "https://jeklcfpqmytdmwczxqlx.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impla2xjZnBxbXl0ZG13Y3p4cWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NzY0NDUsImV4cCI6MjEwMjU1MjQ0NX0.ZSM88SkzsWhqsD7x8gpyTSguKB2oG51lZqKLGHQETHA";

let supabaseInstance: SupabaseClient<Database> | null = null;

export function getSupabaseClient(
  url: string = DEFAULT_SUPABASE_URL,
  anonKey: string = DEFAULT_SUPABASE_ANON_KEY
): SupabaseClient<Database> {
  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabaseInstance;
}

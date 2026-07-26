// src/services/api.ts — Updated for Supabase (real backend)
// Changes from mock version:
// 1. baseURL now points to Supabase (REST API via supabase-js)
// 2. No axios needed — supabase-js handles HTTP internally
// 3. Auth is handled by Supabase Auth (httpOnly cookies)
// 4. Token comes from Supabase session, not localStorage

import { supabase } from "./supabaseClient";

// Supabase client handles all HTTP internally.
// This file exists as a compatibility layer for code that
// previously used axios directly.
// New code should use supabaseClient.ts or church.ts instead.

export const API_URL = ""; // Not used when using supabase-js directly
export const http = null; // No axios needed with Supabase

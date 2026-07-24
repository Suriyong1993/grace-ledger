// supabase/functions/auth-login/index.ts
// Handle email/password login for Grace Ledger
// Returns session token + user data

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { email, password } = await req.json();

    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'email and password are required' }),
        { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 1. Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (authError) {
      // Generic error to prevent user enumeration
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get user's church_id from our users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, church_id, name, role, avatar_color, is_active')
      .eq('auth_user_id', authData.user!.id)
      .single();

    if (userError || !userData) {
      // User exists in auth but not in our users table — not registered for this church
      console.error(`User ${authData.user!.id} not found in church users table`);
      return new Response(
        JSON.stringify({ error: 'User not registered' }),
        { status: 403, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if user is active
    if (!userData.is_active) {
      return new Response(
        JSON.stringify({ error: 'Account is deactivated' }),
        { status: 403, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 4. Log audit
    await supabase.from('audit_log').insert({
      church_id: userData.church_id,
      user_id: userData.id,
      user_name: userData.name,
      action: 'login',
      entity: 'auth',
      details: 'User logged in',
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      user_agent: req.headers.get('user-agent'),
    });

    // 5. Return session info (client stores the access_token)
    const session = authData.session;

    return new Response(
      JSON.stringify({
        user: userData,
        access_token: session?.access_token,
        refresh_token: session?.refresh_token,
        expires_at: session?.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  }
});
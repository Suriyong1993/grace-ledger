// supabase/functions/auth-register/index.ts
// Register a new user for a church

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { email, password, name, church_id, role } = await req.json();

    // Validate
    if (!email || !password || !name || !church_id) {
      return new Response(
        JSON.stringify({ error: 'email, password, name, and church_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    const validRoles = ['super_admin', 'pastor', 'treasurer', 'finance_staff', 'auditor', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: { name, church_id },
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Create user record in our users table
    const userId = authData.user!.id;
    const finalRole = role || 'viewer';

    const { error: insertError } = await supabase.from('users').insert({
      id: crypto.randomUUID(),
      auth_user_id: userId,
      church_id,
      name,
      role: finalRole,
      is_active: true,
    });

    if (insertError) {
      // Rollback: delete the auth user we just created
      await supabase.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: 'Failed to create user record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Log audit
    await supabase.from('audit_log').insert({
      church_id,
      user_id: userId,
      user_name: name,
      action: 'create_user',
      entity: 'user',
      details: `Registered with role ${finalRole}`,
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      user_agent: req.headers.get('user-agent'),
    });

    return new Response(
      JSON.stringify({ message: 'User registered successfully', user_id: userId }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
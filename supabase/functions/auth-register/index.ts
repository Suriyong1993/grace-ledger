// supabase/functions/auth-register/index.ts
// Register a new user for a church

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Require caller to be authenticated as super_admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: caller },
      error: callerError,
    } = await supabase.auth.getUser(token);

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Verify caller is super_admin in their church
    const { data: callerData, error: callerDataError } = await supabase
      .from("users")
      .select("id, role, church_id")
      .eq("auth_user_id", caller.id)
      .single();

    if (callerDataError || !callerData || callerData.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Only super_admin can register new users" }), {
        status: 403,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { email, password, name, church_id, role } = await req.json();

    // Validate: new user must be for same church as caller
    if (church_id !== callerData.church_id) {
      return new Response(
        JSON.stringify({ error: "Cannot register user for a different church" }),
        { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Validate
    if (!email || !password || !name || !church_id) {
      return new Response(
        JSON.stringify({ error: "email, password, name, and church_id are required" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Validate role
    const validRoles = ["super_admin", "admin"];
    if (role && !validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
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
      return new Response(JSON.stringify({ error: "Failed to create user account" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // 2. Create user record in our users table
    const userId = authData.user!.id;
    const finalRole = role || "admin";

    const { error: insertError } = await supabase.from("users").insert({
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
      return new Response(JSON.stringify({ error: "Failed to create user record" }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // 3. Log audit
    await supabase.from("audit_log").insert({
      church_id,
      user_id: userId,
      user_name: name,
      action: "create_user",
      entity: "user",
      details: `Registered with role ${finalRole}`,
      ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      user_agent: req.headers.get("user-agent"),
    });

    return new Response(
      JSON.stringify({ message: "User registered successfully", user_id: userId }),
      { status: 201, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

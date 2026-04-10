import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: roleData } = await callerClient.rpc("get_my_role");
    if (roleData !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can invite users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, full_name, department, designation, employment_type, join_date, role, phone, shift_start, shift_end, reminder_offset_minutes, password } = body;

    if (!email || !full_name || !department || !designation || !employment_type || !join_date || !password) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const callerId = (await callerClient.auth.getUser()).data.user?.id;

    const { error: profileError } = await adminClient.from("users").insert({
      id: userId,
      email,
      full_name,
      department,
      designation,
      employment_type,
      join_date,
      role: role || "employee",
      phone: phone || null,
      shift_start: shift_start || "09:00",
      shift_end: shift_end || "18:00",
      reminder_offset_minutes: reminder_offset_minutes || 30,
      must_change_password: true,
      status: "active",
      created_by: callerId,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Write audit log
    await adminClient.from("audit_logs").insert({
      actor_id: callerId,
      action: "user.created",
      target_entity: "users",
      target_id: userId,
      metadata: { email, full_name, role: role || "employee" },
    });

    // Send invite email
    const callerProfile = await adminClient.from("users").select("full_name").eq("id", callerId!).single();
    await adminClient.functions.invoke("send-invite", {
      body: {
        user_email: email,
        user_name: full_name,
        inviter_name: callerProfile.data?.full_name || "Admin",
      },
    });

    return new Response(
      JSON.stringify({ user_id: userId, email }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

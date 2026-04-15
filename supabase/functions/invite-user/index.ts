import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ ok: false, error: "Missing authorization" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: roleData } = await callerClient.rpc("get_my_role");
    if (roleData !== "admin") {
      return jsonResponse({ ok: false, error: "Only admins can invite users" });
    }

    const body = await req.json();
    const {
      email, full_name, department, designation, employment_type,
      join_date, role, phone, shift_start, shift_end,
      reminder_offset_minutes, password,
    } = body;

    if (!email || !full_name || !department || !designation || !employment_type || !join_date) {
      return jsonResponse({ ok: false, error: "Missing required fields: email, full_name, department, designation, employment_type, join_date" });
    }

    const userPassword = password && password.length >= 8
      ? password
      : crypto.randomUUID().slice(0, 12) + "A1!";

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
    });

    if (authError) {
      console.error("Auth create error:", authError.message);
      return jsonResponse({ ok: false, error: authError.message });
    }

    const userId = authData.user.id;
    const callerId = (await callerClient.auth.getUser()).data.user?.id;

    // 2. Upsert user row — the handle_new_user trigger may have already created a row
    // with default values, so we always update to ensure the admin-entered values are saved.
    const profileData = {
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
    };

    const { error: upsertError } = await adminClient.from("users").upsert(profileData, { onConflict: "id" });

    if (upsertError) {
      console.error("Profile upsert error:", upsertError.message);
      await adminClient.auth.admin.deleteUser(userId);
      return jsonResponse({ ok: false, error: upsertError.message });
    }

    // 3. Audit log
    await adminClient.from("audit_logs").insert({
      actor_id: callerId,
      action: "user.created",
      target_entity: "users",
      target_id: userId,
      metadata: { email, full_name, role: role || "employee" },
    });

    return jsonResponse({ ok: true, user_id: userId, email });
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse({ ok: false, error: err.message || "Unexpected error" });
  }
});

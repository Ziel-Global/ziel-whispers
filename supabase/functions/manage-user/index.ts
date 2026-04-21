import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Always status 200 — errors surface in the body so supabase-js never swallows them.
function jsonResponse(body: Record<string, unknown>) {
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
      return jsonResponse({ ok: false, error: "Only admins can manage users" });
    }

    const body = await req.json();
    const { action, user_id } = body;

    if (!action || !user_id) {
      return jsonResponse({ ok: false, error: "Missing action or user_id" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const callerId = (await callerClient.auth.getUser()).data.user?.id;

    if (action === "deactivate") {
      const { error: updateError } = await adminClient.from("users").update({ status: "inactive" }).eq("id", user_id);
      if (updateError) {
        return jsonResponse({ ok: false, error: updateError.message });
      }

      await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "876600h" });

      await adminClient.from("audit_logs").insert({
        actor_id: callerId,
        action: "user.deactivated",
        target_entity: "users",
        target_id: user_id,
      });

      return jsonResponse({ ok: true });
    }

    if (action === "reactivate") {
      const { error: updateError } = await adminClient.from("users").update({ status: "active" }).eq("id", user_id);
      if (updateError) {
        return jsonResponse({ ok: false, error: updateError.message });
      }

      await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "none" });

      await adminClient.from("audit_logs").insert({
        actor_id: callerId,
        action: "user.reactivated",
        target_entity: "users",
        target_id: user_id,
      });

      return jsonResponse({ ok: true });
    }

    if (action === "set_password") {
      const { new_password } = body;
      if (!new_password || typeof new_password !== "string" || new_password.length < 8) {
        return jsonResponse({ ok: false, error: "Password must be at least 8 characters" });
      }
      if (!/[0-9]/.test(new_password) || !/[^a-zA-Z0-9]/.test(new_password)) {
        return jsonResponse({ ok: false, error: "Password must contain a number and a special character" });
      }

      const { error: authError } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
      if (authError) {
        return jsonResponse({ ok: false, error: authError.message });
      }

      await adminClient.from("users").update({ must_change_password: false }).eq("id", user_id);

      await adminClient.from("audit_logs").insert({
        actor_id: callerId,
        action: "user.password_set_by_admin",
        target_entity: "users",
        target_id: user_id,
      });

      return jsonResponse({ ok: true });
    }

    if (action === "update_email") {
      const { new_email } = body;
      if (!new_email) {
        return jsonResponse({ ok: false, error: "Missing new_email" });
      }

      const { error: authError } = await adminClient.auth.admin.updateUserById(user_id, { email: new_email });
      if (authError) {
        return jsonResponse({ ok: false, error: authError.message });
      }

      const { error: dbError } = await adminClient.from("users").update({ email: new_email }).eq("id", user_id);
      if (dbError) {
        return jsonResponse({ ok: false, error: dbError.message });
      }

      await adminClient.from("audit_logs").insert({
        actor_id: callerId,
        action: "user.email_changed",
        target_entity: "users",
        target_id: user_id,
        metadata: { new_email },
      });

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: "Unknown action" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("manage-user error:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

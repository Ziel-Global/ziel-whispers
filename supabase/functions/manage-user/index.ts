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
      return new Response(JSON.stringify({ error: "Only admins can manage users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, user_id } = body;

    if (!action || !user_id) {
      return new Response(JSON.stringify({ error: "Missing action or user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const callerId = (await callerClient.auth.getUser()).data.user?.id;

    if (action === "deactivate") {
      // Update user status
      const { error: updateError } = await adminClient.from("users").update({ status: "inactive" }).eq("id", user_id);
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ban the auth user (prevents sign-in)
      await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "876600h" }); // ~100 years

      // Audit log
      await adminClient.from("audit_logs").insert({
        actor_id: callerId,
        action: "user.deactivated",
        target_entity: "users",
        target_id: user_id,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reactivate") {
      const { error: updateError } = await adminClient.from("users").update({ status: "active" }).eq("id", user_id);
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Unban the auth user
      await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "none" });

      await adminClient.from("audit_logs").insert({
        actor_id: callerId,
        action: "user.reactivated",
        target_entity: "users",
        target_id: user_id,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_email") {
      const { new_email } = body;
      if (!new_email) {
        return new Response(JSON.stringify({ error: "Missing new_email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: authError } = await adminClient.auth.admin.updateUserById(user_id, { email: new_email });
      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: dbError } = await adminClient.from("users").update({ email: new_email }).eq("id", user_id);
      if (dbError) {
        return new Response(JSON.stringify({ error: dbError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("audit_logs").insert({
        actor_id: callerId,
        action: "user.email_changed",
        target_entity: "users",
        target_id: user_id,
        metadata: { new_email },
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

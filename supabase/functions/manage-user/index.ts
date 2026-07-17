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

    if (action === "delete") {
      // Permanently delete related DB rows, the user row, and the auth account
      try {
        // Delete data records owned by the user
        const relatedDeletes = [
          { table: "project_members", col: "user_id" },
          { table: "auto_clockout_acks", col: "user_id" },
          { table: "audit_logs", col: "actor_id" },
          { table: "audit_logs", col: "target_id" },
          { table: "attendance", col: "user_id" },
          { table: "daily_logs", col: "user_id" },
          { table: "leave_requests", col: "user_id" },
          { table: "notifications", col: "user_id" },
          { table: "leave_balances", col: "user_id" },
          { table: "announcement_reads", col: "user_id" },
          { table: "announcements", col: "created_by" },
          { table: "time_entries", col: "user_id" },
          { table: "missed_logs", col: "user_id" },
          { table: "remote_work_requests", col: "user_id" },
        ];

        for (const d of relatedDeletes) {
          const { error: relErr } = await adminClient.from(d.table).delete().eq(d.col, user_id);
          if (relErr) {
            console.warn(`manage-user: failed deleting from ${d.table}:`, relErr.message);
          }
        }

        // Set metadata reference fields to null (these point TO the user being deleted,
        // so we don't want to delete the whole record — just sever the reference)
        const nullifyRefs = [
          { table: "attendance", col: "edited_by" },
          { table: "leave_requests", col: "reviewed_by" },
          { table: "remote_work_requests", col: "reviewed_by" },
          { table: "clients", col: "created_by" },
          { table: "projects", col: "created_by" },
          { table: "users", col: "created_by" },
          { table: "system_settings", col: "updated_by" },
          { table: "tasks", col: "assigned_to" },
          { table: "tasks", col: "created_by" },
          { table: "task_comments", col: "author_id" },
          { table: "task_blockers", col: "raised_by" },
          { table: "task_blockers", col: "resolved_by" },
          { table: "task_status_history", col: "changed_by" },
          { table: "task_dependencies", col: "created_by" },
          { table: "project_status_updates", col: "author_id" },
          { table: "goals", col: "created_by" },
          { table: "goal_resources", col: "user_id" },
          { table: "workflow_templates", col: "created_by" },
        ];

        for (const r of nullifyRefs) {
          const { error: refErr } = await adminClient.from(r.table).update({ [r.col]: null }).eq(r.col, user_id);
          if (refErr) {
            console.warn(`manage-user: failed nullifying ${r.table}.${r.col}:`, refErr.message);
          }
        }

        // Remove user row from users table (server-side, no RLS issues with service_role client)
        const { error: dbErr } = await adminClient.from("users").delete().eq("id", user_id).maybeSingle();
        if (dbErr) return jsonResponse({ ok: false, error: dbErr.message });

        // Delete auth user
        const { error: delErr } = await adminClient.auth.admin.deleteUser(user_id);
        if (delErr) return jsonResponse({ ok: false, error: delErr.message });

        await adminClient.from("audit_logs").insert({
          actor_id: callerId,
          action: "user.deleted",
          target_entity: "users",
          target_id: user_id,
        });

        return jsonResponse({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return jsonResponse({ ok: false, error: msg });
      }
    }

    if (action === "oversight_on") {
      const { error: updateError } = await adminClient.from("users").update({ is_oversight: true }).eq("id", user_id);
      if (updateError) {
        return jsonResponse({ ok: false, error: updateError.message });
      }

      await adminClient.from("audit_logs").insert({
        actor_id: callerId,
        action: "user.oversight_on",
        target_entity: "users",
        target_id: user_id,
      });

      return jsonResponse({ ok: true });
    }

    if (action === "oversight_off") {
      const { error: updateError } = await adminClient.from("users").update({ is_oversight: false }).eq("id", user_id);
      if (updateError) {
        return jsonResponse({ ok: false, error: updateError.message });
      }

      await adminClient.from("audit_logs").insert({
        actor_id: callerId,
        action: "user.oversight_off",
        target_entity: "users",
        target_id: user_id,
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

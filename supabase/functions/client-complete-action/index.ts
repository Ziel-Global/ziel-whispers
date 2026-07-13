import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
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

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    const body = await req.json();
    const { action_item_id } = body;

    if (!action_item_id) {
      return jsonResponse({ ok: false, error: "action_item_id is required" });
    }

    const { data: item, error: itemError } = await supabase
      .from("client_action_items")
      .select("id, project_id, status")
      .eq("id", action_item_id)
      .single();

    if (itemError || !item) {
      return jsonResponse({ ok: false, error: "Action item not found" });
    }

    if (item.status === "completed") {
      return jsonResponse({ ok: false, error: "Already completed" });
    }

    const { data: membership } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", item.project_id)
      .eq("user_id", user.id)
      .is("removed_at", null)
      .single();

    if (!membership) {
      return jsonResponse({ ok: false, error: "Not a member of this project" });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      profile && !["client", "client member", "admin", "manager"].includes(profile.role)
    ) {
      return jsonResponse({ ok: false, error: "Insufficient permissions" });
    }

    const { error: updateError } = await supabase
      .from("client_action_items")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", action_item_id);

    if (updateError) {
      return jsonResponse({ ok: false, error: updateError.message });
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
});

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const todayStr = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return jsonResponse({ ok: true, skipped: "weekend" });
    }

    const { data: users } = await supabase.from("users").select("id, full_name, email").eq("status", "active");
    if (!users) return jsonResponse({ ok: true, missed: 0, message: "No active users" });

    const { data: todayLogs } = await supabase.from("daily_logs").select("user_id").eq("log_date", todayStr);
    const loggedUserIds = new Set((todayLogs || []).map((l: { user_id: string }) => l.user_id));

    const missedUsers = users.filter((u: { id: string }) => !loggedUserIds.has(u.id));

    // Insert missed_logs entries (detection logic kept, emails removed)
    for (const user of missedUsers) {
      await supabase.from("missed_logs").insert({ user_id: user.id, log_date: todayStr });
    }

    return jsonResponse({ ok: true, missed: missedUsers.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("detect-missed-logs error:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

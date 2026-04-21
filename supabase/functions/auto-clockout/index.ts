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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Fetch configuration from system_settings
    const { data: settings } = await adminClient
      .from("system_settings")
      .select("key, value")
      .in("key", ["auto_clockout_time", "timezone"]);
    
    const settingsMap = Object.fromEntries((settings || []).map(s => [s.key, s.value]));
    const timezone = "Asia/Karachi";
    const autoClockoutTime = settingsMap.auto_clockout_time || "00:00";

    // 2. Identify "Today" in the target timezone (PKT)
    const now = new Date();
    const todayPKT = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now); // Result: "YYYY-MM-DD"

    console.log(`Current server time (UTC): ${now.toISOString()}`);
    console.log(`Current ${timezone} date: ${todayPKT}`);

    // 3. Find all open sessions
    const { data: openSessions, error: fetchError } = await adminClient
      .from("attendance")
      .select(`
        id, 
        user_id, 
        clock_in, 
        date, 
        users!attendance_user_id_fkey(role, is_night_shift)
      `)
      .is("clock_out", null)
      .not("clock_in", "is", null);

    if (fetchError) {
      console.error("Error fetching open sessions:", fetchError);
      return jsonResponse({ ok: false, error: fetchError.message });
    }

    let processed = 0;
    for (const session of openSessions || []) {
      const user = session.users as any;
      
      // REQUIREMENT: Admin accounts are excluded from automatic clock-out
      if (user?.role === "admin") {
        console.log(`Skipping admin user: ${session.user_id}`);
        continue;
      }
      
      // SKIP night shift employees (existing practice)
      if (user?.is_night_shift) {
        console.log(`Skipping night shift user: ${session.user_id}`);
        continue;
      }

      // REQUIREMENT: Only auto clock-out if the session is from a previous day (relative to PKT)
      const sessionDate = session.date;
      if (sessionDate >= todayPKT) {
        console.log(`Skipping session from today/future (${sessionDate}) for user: ${session.user_id}`);
        continue;
      }

      // REQUIREMENT: Record clock-out as 11:59:59 PM PKT on the same day
      // Format: YYYY-MM-DDT23:59:59+05:00
      const midnightClockOut = `${sessionDate}T23:59:59+05:00`;

      const { error: updateError } = await adminClient
        .from("attendance")
        .update({
          clock_out: midnightClockOut,
          auto_clocked_out: true,
          auto_clockout_notes: "System auto clock-out — employee did not clock out manually.",
        })
        .eq("id", session.id)
        .is("clock_out", null);

      if (!updateError) {
        processed++;
        // Audit log
        await adminClient.from("audit_logs").insert({
          actor_id: null,
          action: "attendance.auto_clockout",
          target_entity: "attendance",
          target_id: session.id,
          metadata: { 
            user_id: session.user_id, 
            clock_in_date: sessionDate,
            clock_out_recorded: midnightClockOut,
            timezone_used: timezone
          },
        });
      }
    }

    return jsonResponse({ ok: true, processed, timezone, todayPKT });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("auto-clockout error:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

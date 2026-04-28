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
    const timezone = settingsMap.timezone || "Asia/Karachi";
    const autoClockoutTime = (settingsMap.auto_clockout_time as string) || "00:00";

    // 2. Identify "Today" in the target timezone (PKT)
    const now = new Date();
    const todayPKT = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now); // Result: "YYYY-MM-DD"

    console.log(`Current server time (UTC): ${now.toISOString()}`);
    console.log(`Using timezone: ${timezone}; configured autoClockoutTime: ${autoClockoutTime}`);
    console.log(`Current ${timezone} date: ${todayPKT}`);

    const nowInTZ = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now); // HH:MM
    const [cfgHour, cfgMin] = autoClockoutTime.split(":").map((v) => Number(v));
    const [nowHour, nowMin] = nowInTZ.split(":").map((v) => Number(v));
    const cfgMinutes = cfgHour * 60 + cfgMin;
    const nowMinutes = nowHour * 60 + nowMin;

    console.log(`Current time (PKT): ${nowInTZ} (${nowMinutes} mins); Auto-clockout time: ${autoClockoutTime} (${cfgMinutes} mins)`);

    // 3. Find all open sessions from previous dates only (reduce data transferred)
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
      .not("clock_in", "is", null)
      .lte("date", todayPKT);

    if (fetchError) {
      console.error("Error fetching open sessions:", fetchError);
      return jsonResponse({ ok: false, error: fetchError.message });
    }

    // Filter sessions in-memory for role/night-shift and collect ids to update in bulk
    console.log(`Found ${openSessions?.length || 0} open sessions total. Filtering for auto-clockout...`);

    const toUpdate: Array<{ id: string; sessionDate: string; user_id: string }> = [];
    for (const session of openSessions || []) {
      // If session is from today, only clock out if we are past the target time
      if (session.date === todayPKT && nowMinutes < cfgMinutes) {
        continue;
      }
      toUpdate.push({ id: session.id, sessionDate: session.date, user_id: session.user_id });
    }

    if (toUpdate.length === 0) {
      console.log("No sessions met the criteria for auto-clockout at this time.");
      return jsonResponse({ ok: true, processed: 0, reason: "no-sessions-eligible" });
    }

    const tzOffset = "+05:00"; // Asia/Karachi fixed offset
    console.log(`Processing auto-clockout for ${toUpdate.length} sessions...`);

    const succeeded: Array<{ id: string; user_id: string; sessionDate: string; clock_out: string }> = [];
    for (const t of toUpdate) {
      const clockOutValue = `${t.sessionDate}T${autoClockoutTime}:00${tzOffset}`;
      console.log(`Clocking out session ${t.id} for user ${t.user_id} at ${clockOutValue}`);
      try {
        const { error: updateError } = await adminClient
          .from("attendance")
          .update({ 
            clock_out: clockOutValue, 
            auto_clocked_out: true, 
            auto_clockout_notes: `System auto clock-out at ${autoClockoutTime}.` 
          })
          .eq("id", t.id)
          .is("clock_out", null);
        if (!updateError) {
          succeeded.push({ id: t.id, user_id: t.user_id, sessionDate: t.sessionDate, clock_out: clockOutValue });
        } else {
          console.error(`Failed to update attendance ${t.id}:`, updateError);
        }
      } catch (e) {
        console.error(`Exception updating attendance ${t.id}:`, e instanceof Error ? e.message : String(e));
      }
    }

    let processed = succeeded.length;
    if (processed > 0) {
      const auditRows = succeeded.map(s => ({
        actor_id: null,
        action: "attendance.auto_clockout",
        target_entity: "attendance",
        target_id: s.id,
        metadata: { user_id: s.user_id, clock_in_date: s.sessionDate, clock_out_recorded: s.clock_out, timezone_used: timezone, suppress_notifications: true },
      }));
      await adminClient.from("audit_logs").insert(auditRows);
    }

    return jsonResponse({ ok: true, processed, timezone, todayPKT });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("auto-clockout error:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

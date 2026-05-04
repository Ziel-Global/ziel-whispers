import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const timezone = "Asia/Karachi";
    const now = new Date();
    
    // Get Today in PKT
    const todayPKT = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    // Skip weekends (6=Saturday, 0=Sunday in JS getDay())
    // Note: getDay() on 'now' might be different from PKT day if we are near midnight.
    // Better to derive day of week from todayPKT.
    const pktDayOfWeek = new Date(todayPKT).getDay();
    if (pktDayOfWeek === 0 || pktDayOfWeek === 6) {
      return jsonResponse({ ok: true, skipped: "weekend", todayPKT });
    }

    // Get current time in PKT
    const nowInTZ = new Intl.DateTimeFormat("en-GB", { 
      timeZone: timezone, 
      hour: "2-digit", 
      minute: "2-digit", 
      hour12: false 
    }).format(now);
    const [nowHour, nowMin] = nowInTZ.split(":").map(Number);
    const nowTotalMinutes = nowHour * 60 + nowMin;

    // 1. Fetch global settings
    const { data: globalSettings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["default_shift_end"]);
    
    const settingsMap = Object.fromEntries((globalSettings || []).map(s => [s.key, s.value]));
    const defaultShiftEnd = settingsMap.default_shift_end || "18:00";
    const [defHour, defMin] = defaultShiftEnd.split(":").map(Number);
    const defaultTotalMinutes = defHour * 60 + defMin;

    // 2. Fetch all active users with their shift settings
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id, full_name, has_custom_shift, shift_end, join_date")
      .eq("status", "active");

    if (userError) throw userError;
    if (!users) return jsonResponse({ ok: true, missed: 0, message: "No active users" });

    // 3. Fetch already logged users for today
    const { data: todayLogs } = await supabase
      .from("daily_logs")
      .select("user_id")
      .eq("log_date", todayPKT);
    const loggedUserIds = new Set((todayLogs || []).map(l => l.user_id));

    // 4. Fetch users already marked as missed today (to avoid duplicates)
    const { data: alreadyMissed } = await supabase
      .from("missed_logs")
      .select("user_id")
      .eq("log_date", todayPKT);
    const alreadyMissedUserIds = new Set((alreadyMissed || []).map(m => m.user_id));

    const toMarkAsMissed = [];

    for (const user of users) {
      if (loggedUserIds.has(user.id)) continue;
      if (alreadyMissedUserIds.has(user.id)) continue;

      // FIX: Only mark as missed if the log_date is on or after the user's join_date
      if (user.join_date && todayPKT < user.join_date) {
        console.log(`Skipping missed log for ${user.full_name} - Joined on ${user.join_date}, checking for ${todayPKT}`);
        continue;
      }

      // Determine effective shift end time
      let effectiveMinutes = defaultTotalMinutes;
      if (user.has_custom_shift && user.shift_end) {
        const [h, m] = user.shift_end.split(":").map(Number);
        effectiveMinutes = h * 60 + m;
      }

      // Check if current time is past shift end
      if (nowTotalMinutes >= effectiveMinutes) {
        toMarkAsMissed.push({
          user_id: user.id,
          log_date: todayPKT,
          reason: "Past shift end without log"
        });
      }
    }

    if (toMarkAsMissed.length > 0) {
      const { error: insertError } = await supabase
        .from("missed_logs")
        .insert(toMarkAsMissed.map(({ user_id, log_date }) => ({ user_id, log_date })));
      
      if (insertError) {
        console.error("Error inserting missed logs:", insertError);
        return jsonResponse({ ok: false, error: insertError.message });
      }
    }

    return jsonResponse({ 
      ok: true, 
      processed: users.length, 
      missed: toMarkAsMissed.length,
      todayPKT,
      nowPKT: nowInTZ
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("detect-missed-logs error:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

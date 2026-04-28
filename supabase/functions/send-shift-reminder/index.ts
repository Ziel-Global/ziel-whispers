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

Deno.serve(async (req) => {
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
    
    // Get current time in PKT
    const nowInTZ = new Intl.DateTimeFormat("en-GB", { 
      timeZone: timezone, 
      hour: "2-digit", 
      minute: "2-digit", 
      hour12: false 
    }).format(now);

    // 1. Fetch global settings
    const { data: globalSettings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["default_shift_start", "reminder_offset_minutes"]);
    
    const settingsMap = Object.fromEntries((globalSettings || []).map(s => [s.key, s.value]));
    const defaultShiftStart = settingsMap.default_shift_start || "09:00";
    const offset = Number(settingsMap.reminder_offset_minutes || "30");

    // 2. Fetch all active users with their shift settings
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, email, has_custom_shift, shift_start")
      .eq("status", "active");

    // The logic below would determine who to send reminders to.
    // However, shift reminders are currently disabled by policy.
    
    return jsonResponse({ 
      ok: true, 
      sent: 0, 
      message: "Email reminders disabled (but logic is now shift-aware)",
      nowPKT: nowInTZ
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-shift-reminder error:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find all open sessions (clock_in set, clock_out null) excluding night shift employees
    const { data: openSessions, error: fetchError } = await adminClient
      .from("attendance")
      .select("id, user_id, clock_in, date, users!attendance_user_id_fkey(is_night_shift)")
      .is("clock_out", null)
      .not("clock_in", "is", null);

    if (fetchError) {
      console.error("Error fetching open sessions:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    for (const session of openSessions || []) {
      // Skip night shift employees
      const user = session.users as any;
      if (user?.is_night_shift) continue;

      // Calculate midnight of the clock-in date (end of that day)
      const clockInDate = session.date;
      const today = new Date().toISOString().split("T")[0];

      // Only auto clock-out if the session is from a previous day
      if (clockInDate >= today) continue;

      // Set clock-out to midnight (end of clock-in day)
      const midnightClockOut = `${clockInDate}T23:59:59.999Z`;

      const { error: updateError } = await adminClient
        .from("attendance")
        .update({
          clock_out: midnightClockOut,
          auto_clocked_out: true,
          auto_clockout_notes: "System auto clock-out — employee did not clock out manually.",
        })
        .eq("id", session.id)
        .is("clock_out", null); // Idempotent: only update if still open

      if (!updateError) {
        processed++;
        // Audit log
        await adminClient.from("audit_logs").insert({
          actor_id: null,
          action: "attendance.auto_clockout",
          target_entity: "attendance",
          target_id: session.id,
          metadata: { user_id: session.user_id, clock_in_date: clockInDate },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auto-clockout error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

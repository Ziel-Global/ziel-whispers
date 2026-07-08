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

    const now = new Date();
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

    const nowISO = now.toISOString();
    const fiveMinLaterISO = fiveMinutesLater.toISOString();

    console.log(`Checking for reminders between ${nowISO} and ${fiveMinLaterISO}`);

    // Fetch pending reminders whose time falls within the next 5 minutes
    const { data: reminders, error: fetchError } = await supabase
      .from("attendance")
      .select(`
        id,
        user_id,
        date,
        users!attendance_user_id_fkey!inner(email, full_name)
      `)
      .is("log_reminder_sent", false)
      .not("log_reminder_time", "is", null)
      .gte("log_reminder_time", nowISO)
      .lt("log_reminder_time", fiveMinLaterISO);

    if (fetchError) {
      console.error("Error fetching reminders:", fetchError);
      return jsonResponse({ ok: false, error: fetchError.message });
    }

    console.log(`Found ${reminders?.length || 0} pending reminders`);

    let sent = 0;
    let skipped = 0;

    for (const record of reminders || []) {
      const attendanceId = record.id;
      const userId = record.user_id;
      const logDate = record.date;
      const userEmail = (record.users as any)?.email;
      const userName = (record.users as any)?.full_name;

      if (!userEmail) {
        console.warn(`No email for user ${userId}, skipping reminder`);
        continue;
      }

      // Check if employee has already submitted logs for today
      const { data: existingLogs } = await supabase
        .from("daily_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("log_date", logDate)
        .eq("status", "submitted")
        .limit(1);

      if (existingLogs && existingLogs.length > 0) {
        console.log(`User ${userId} already submitted logs for ${logDate}, skipping reminder`);
        skipped++;
        // Mark reminder as sent so we don't re-check
        await supabase
          .from("attendance")
          .update({ log_reminder_sent: true })
          .eq("id", attendanceId);
        continue;
      }

      // Send email using the existing send-email edge function
      const emailPayload = {
        to: userEmail,
        subject: "Reminder: Submit Your Logs",
        html: `<p>Hi ${userName},</p><p>Your shift ends in 15 minutes. Please make sure your logs are submitted.</p><p>Thank you,<br/>Ziel Logs</p>`,
      };

      const functionUrl = `${supabaseUrl}/functions/v1/send-email`;

      try {
        const emailRes = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify(emailPayload),
        });

        const emailResult = await emailRes.json();

        if (emailResult.ok) {
          console.log(`Reminder sent to ${userEmail} for attendance ${attendanceId}`);
          sent++;
        } else {
          console.error(`Failed to send email to ${userEmail}:`, emailResult.error);
        }
      } catch (emailErr) {
        console.error(`Exception sending email to ${userEmail}:`, emailErr instanceof Error ? emailErr.message : String(emailErr));
      }

      // Mark reminder as sent regardless of email result to avoid re-processing
      await supabase
        .from("attendance")
        .update({ log_reminder_sent: true })
        .eq("id", attendanceId);
    }

    return jsonResponse({ ok: true, processed: reminders?.length || 0, sent, skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-log-reminder error:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

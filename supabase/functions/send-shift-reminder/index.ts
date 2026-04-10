import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    // Get active users
    const { data: users } = await supabase.from("users").select("id, email, full_name, shift_end, reminder_offset_minutes").eq("status", "active");
    if (!users || users.length === 0) return new Response("No users");

    // Get today's logs
    const { data: todayLogs } = await supabase.from("daily_logs").select("user_id").eq("log_date", todayStr);
    const loggedUserIds = new Set((todayLogs || []).map((l) => l.user_id));

    let sent = 0;
    for (const user of users) {
      if (loggedUserIds.has(user.id)) continue;

      const [h, m] = user.shift_end.split(":").map(Number);
      const shiftEndMinutes = h * 60 + m;
      const reminderTime = shiftEndMinutes - (user.reminder_offset_minutes || 30);

      if (Math.abs(currentMinutes - reminderTime) <= 1) {
        await supabase.functions.invoke("send-email", {
          body: {
            to: user.email,
            subject: "Reminder: Submit your daily log",
            html: `
              <div style="font-family:Arial,sans-serif;padding:20px;max-width:500px;">
                <h2 style="color:#1A1B1E;">Daily Log Reminder</h2>
                <p>Hi ${user.full_name},</p>
                <p>Your shift ends soon. Please submit your daily log before you leave.</p>
                <a href="https://id-preview--71558b0e-812b-4b7d-9faf-956160583e7f.lovable.app/logs/submit"
                   style="background:#D0FF71;color:#000;padding:10px 24px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;margin-top:15px;">
                  Submit Log
                </a>
              </div>
            `,
          },
        });
        sent++;
      }
    }

    return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

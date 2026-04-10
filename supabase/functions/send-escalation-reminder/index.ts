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

    // Get grace period from settings
    const { data: graceSetting } = await supabase.from("system_settings").select("value").eq("key", "grace_period_minutes").maybeSingle();
    const gracePeriod = graceSetting ? parseInt(graceSetting.value) : 30;

    const { data: users } = await supabase.from("users").select("id, email, full_name, shift_end").eq("status", "active");
    if (!users) return new Response("No users");

    const { data: todayLogs } = await supabase.from("daily_logs").select("user_id").eq("log_date", todayStr);
    const loggedUserIds = new Set((todayLogs || []).map((l) => l.user_id));

    let sent = 0;
    for (const user of users) {
      if (loggedUserIds.has(user.id)) continue;

      const [h, m] = user.shift_end.split(":").map(Number);
      const escalationTime = h * 60 + m + gracePeriod;

      if (Math.abs(currentMinutes - escalationTime) <= 1) {
        await supabase.functions.invoke("send-email", {
          body: {
            to: user.email,
            subject: "⚠️ Log submission overdue",
            html: `
              <div style="font-family:Arial,sans-serif;padding:20px;max-width:500px;">
                <h2 style="color:#dc2626;">Log Submission Overdue</h2>
                <p>Hi ${user.full_name},</p>
                <p>Your daily log for today is overdue. Please submit it as soon as possible.</p>
                <a href="https://id-preview--71558b0e-812b-4b7d-9faf-956160583e7f.lovable.app/logs/submit"
                   style="background:#D0FF71;color:#000;padding:10px 24px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;margin-top:15px;">
                  Submit Now
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

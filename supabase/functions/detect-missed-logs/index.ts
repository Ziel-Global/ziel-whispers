import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const todayStr = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay();
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(JSON.stringify({ skipped: "weekend" }), { headers: { "Content-Type": "application/json" } });
    }

    const { data: users } = await supabase.from("users").select("id, full_name, email").eq("status", "active");
    if (!users) return new Response("No users");

    const { data: todayLogs } = await supabase.from("daily_logs").select("user_id").eq("log_date", todayStr);
    const loggedUserIds = new Set((todayLogs || []).map((l) => l.user_id));

    const missedUsers = users.filter((u) => !loggedUserIds.has(u.id));

    // Insert missed_logs entries
    for (const user of missedUsers) {
      await supabase.from("missed_logs").insert({ user_id: user.id, log_date: todayStr });
    }

    if (missedUsers.length > 0) {
      // Get admin/manager emails
      const { data: admins } = await supabase.from("users").select("email").in("role", ["admin", "manager"]);

      const tableRows = missedUsers.map((u) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${u.full_name}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;">${u.email}</td></tr>`).join("");

      const html = `
        <div style="font-family:Arial,sans-serif;padding:20px;max-width:600px;">
          <h2 style="color:#dc2626;">Missed Daily Logs — ${todayStr}</h2>
          <p>${missedUsers.length} employee(s) did not submit their daily log today:</p>
          <table style="width:100%;border-collapse:collapse;margin-top:10px;">
            <thead><tr><th style="text-align:left;padding:6px 12px;border-bottom:2px solid #ddd;">Name</th><th style="text-align:left;padding:6px 12px;border-bottom:2px solid #ddd;">Email</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      `;

      for (const admin of (admins || [])) {
        await supabase.functions.invoke("send-email", {
          body: { to: admin.email, subject: `Missed Logs Report — ${todayStr}`, html },
        });
      }
    }

    return new Response(JSON.stringify({ missed: missedUsers.length }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

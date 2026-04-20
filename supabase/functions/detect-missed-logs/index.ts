import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const todayStr = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(JSON.stringify({ skipped: "weekend" }), { headers: { "Content-Type": "application/json" } });
    }

    const { data: users } = await supabase.from("users").select("id, full_name, email").eq("status", "active");
    if (!users) return new Response("No users");

    const { data: todayLogs } = await supabase.from("daily_logs").select("user_id").eq("log_date", todayStr);
    const loggedUserIds = new Set((todayLogs || []).map((l: { user_id: string }) => l.user_id));

    const missedUsers = users.filter((u: { id: string }) => !loggedUserIds.has(u.id));

    // Insert missed_logs entries (detection logic kept, emails removed)
    for (const user of missedUsers) {
      await supabase.from("missed_logs").insert({ user_id: user.id, log_date: todayStr });
    }

    return new Response(JSON.stringify({ missed: missedUsers.length }), { headers: { "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
});

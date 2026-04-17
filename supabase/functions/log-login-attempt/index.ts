import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function loadSetting(client: ReturnType<typeof createClient>, key: string): Promise<string | null> {
  const { data } = await client.from("system_settings").select("value").eq("key", key).maybeSingle();
  return (data as any)?.value ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json();
    const { action, email, success } = body;

    if (!email || typeof email !== "string") {
      return jsonResponse({ error: "Invalid email" }, 400);
    }
    const normalizedEmail = email.toLowerCase().trim();

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "check") {
      // Read lockout window + max attempts from admin settings
      const lockoutMinutesStr = await loadSetting(adminClient, "lockout_window_minutes");
      const maxAttemptsStr = await loadSetting(adminClient, "max_failed_login_attempts");
      const lockoutMinutes = Number(lockoutMinutesStr);
      const maxAttempts = Number(maxAttemptsStr);

      if (!lockoutMinutes || !maxAttempts) {
        // Settings not configured — fail open (allow login attempt) but log
        console.warn("Login lockout settings missing", { lockoutMinutesStr, maxAttemptsStr });
        return jsonResponse({ locked: false });
      }

      const windowAgo = new Date(Date.now() - lockoutMinutes * 60 * 1000).toISOString();
      const { data, error } = await adminClient
        .from("login_attempts")
        .select("id")
        .eq("email", normalizedEmail)
        .eq("success", false)
        .gte("attempted_at", windowAgo);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ locked: (data?.length ?? 0) >= maxAttempts });
    }

    if (action === "record") {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("cf-connecting-ip") ||
        null;
      const { error } = await adminClient.from("login_attempts").insert({
        email: normalizedEmail,
        success: !!success,
        ip_address: ip,
      });
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("log-login-attempt error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

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

// Pattern 4: use ReturnType<typeof createClient> + (client as any) to avoid TS2345
async function loadSetting(client: ReturnType<typeof createClient>, key: string): Promise<string | null> {
  const { data } = await (client as any).from("system_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
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
      return jsonResponse({ ok: false, error: "Invalid email" });
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
        return jsonResponse({ ok: true, locked: false });
      }

      const windowAgo = new Date(Date.now() - lockoutMinutes * 60 * 1000).toISOString();
      const { data, error } = await adminClient
        .from("login_attempts")
        .select("id")
        .eq("email", normalizedEmail)
        .eq("success", false)
        .gte("attempted_at", windowAgo);
      if (error) return jsonResponse({ ok: false, error: error.message });
      return jsonResponse({ ok: true, locked: (data?.length ?? 0) >= maxAttempts });
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
      if (error) return jsonResponse({ ok: false, error: error.message });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: "Unknown action" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("log-login-attempt error:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

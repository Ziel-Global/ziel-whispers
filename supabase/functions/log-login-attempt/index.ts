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
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data, error } = await adminClient
        .from("login_attempts")
        .select("id")
        .eq("email", normalizedEmail)
        .eq("success", false)
        .gte("attempted_at", fifteenMinsAgo);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ locked: (data?.length ?? 0) >= 5 });
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

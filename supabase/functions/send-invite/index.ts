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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { user_email, user_name, inviter_name, app_url } = await req.json();

    if (!user_email || !user_name) {
      return jsonResponse({ ok: false, error: "Missing user_email or user_name" });
    }

    const setPasswordUrl = `${app_url || "https://id-preview--71558b0e-812b-4b7d-9faf-956160583e7f.lovable.app"}/set-password`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:30px;background:#ffffff;">
        <h1 style="font-size:22px;color:#1A1B1E;margin-bottom:20px;">Welcome to Ziel Logs!</h1>
        <p style="color:#555;font-size:14px;line-height:1.6;">
          Hi <strong>${user_name}</strong>,
        </p>
        <p style="color:#555;font-size:14px;line-height:1.6;">
          ${inviter_name || "Your administrator"} has invited you to join <strong>Ziel Logs</strong>.
          Please set your password to get started.
        </p>
        <div style="text-align:center;margin:30px 0;">
          <a href="${setPasswordUrl}" style="background:#D0FF71;color:#000;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;">
            Set Your Password
          </a>
        </div>
        <p style="color:#999;font-size:12px;">This invitation expires in 72 hours. If you didn't expect this, please ignore.</p>
      </div>
    `;

    // Send via send-email function
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: emailResult } = await adminClient.functions.invoke("send-email", {
      body: { to: user_email, subject: "You're invited to Ziel Logs — Set your password", html },
    });

    if (!emailResult?.ok) {
      return jsonResponse({ ok: false, error: emailResult?.error ?? "Failed to send invite email" });
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-invite error:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

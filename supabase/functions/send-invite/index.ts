import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { user_email, user_name, inviter_name, app_url } = await req.json();

    if (!user_email || !user_name) {
      return new Response(JSON.stringify({ error: "Missing user_email or user_name" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const { error } = await adminClient.functions.invoke("send-email", {
      body: { to: user_email, subject: "You're invited to Ziel Logs — Set your password", html },
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

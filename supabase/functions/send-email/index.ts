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

async function sendWithResend(to: string, subject: string, html: string, fromName: string, fromEmail: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { to, subject, html, fromName, fromEmail } = await req.json();
    if (!to || !subject || !html) {
      return jsonResponse({ ok: false, error: "Missing to, subject, or html" });
    }

    const senderName = fromName || "Ziel Logs";
    const senderEmail = fromEmail || "noreply@resend.dev";

    // Pattern 5: typed lastError to avoid TS2322
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await sendWithResend(to, subject, html, senderName, senderEmail);

        // Log success
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await supabase.from("notifications").insert({
          type: "email",
          channel: "email",
          status: "sent",
          metadata: { to, subject, resend_id: result.id },
        });

        return jsonResponse({ ok: true, id: result.id });
      } catch (err) {
        // Pattern 5: narrow to Error before assigning
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < 2) await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    // Log failure
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await supabase.from("notifications").insert({
      type: "email",
      channel: "email",
      status: "failed",
      metadata: { to, subject, error: lastError?.message },
    });

    console.error("send-email: all retries failed:", lastError?.message);
    return jsonResponse({ ok: false, error: lastError?.message ?? "Failed to send email" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-email error:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

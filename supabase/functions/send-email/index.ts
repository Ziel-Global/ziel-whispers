import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function logNotification(supabase: ReturnType<typeof createClient> | null, status: string, metadata: Record<string, unknown>) {
  if (!supabase) return;
  try {
    await supabase.from("notifications").insert({
      type: "email",
      channel: "email",
      status,
      metadata,
    });
  } catch {
    // logging is best-effort
  }
}

async function sendWithResend(to: string, subject: string, html: string, fromName: string, fromEmail: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_DEV_API_KEY");
  if (!RESEND_API_KEY) throw new Error("RESEND_DEV_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html,
      }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) {
      const errorDetail = `Resend API returned ${res.status}: ${JSON.stringify(data)}`;
      console.error(`sendWithResend: ${errorDetail}`);
      throw new Error(errorDetail);
    }
    return data;
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("abort")) {
      throw new Error("Request timed out after 10s");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`send-email [${requestId}]: received ${req.method} request`);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log(`send-email [${requestId}]: body keys:`, Object.keys(body));
    const { to, subject, html, fromName, fromEmail } = body;

    if (!to || !subject || !html) {
      console.error(`send-email [${requestId}]: missing fields`);
      return jsonResponse({ ok: false, error: "Missing to, subject, or html" });
    }

    const senderName = fromName || "Ziel Logs";
    const senderEmail = fromEmail || "noreply@zielglobal.com";

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`send-email [${requestId}]: attempt ${attempt + 1} sending to ${to}`);
        const result = await sendWithResend(to, subject, html, senderName, senderEmail);
        console.log(`send-email [${requestId}]: success, id=${result.id}`);

        const supabase = getSupabase();
        logNotification(supabase, "sent", { to, subject, resend_id: result.id });

        return jsonResponse({ ok: true, id: result.id });
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`send-email [${requestId}]: attempt ${attempt + 1} failed:`, lastError.message);
        if (attempt < 1) await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.error(`send-email [${requestId}]: all retries failed:`, lastError?.message);
    const supabase = getSupabase();
    logNotification(supabase, "failed", { to, subject, error: lastError?.message });

    return jsonResponse({ ok: false, error: lastError?.message ?? "Failed to send email" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`send-email [${requestId}]: fatal error:`, message, stack ?? "");
    return jsonResponse({ ok: false, error: message });
  }
});

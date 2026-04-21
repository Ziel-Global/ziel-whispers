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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Shift reminder emails have been disabled.
    // This function is kept as a stub for the cron job.
    return jsonResponse({ ok: true, sent: 0, message: "Email reminders disabled" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-shift-reminder error:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

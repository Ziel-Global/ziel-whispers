const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Project assignment emails have been disabled.
  return new Response(JSON.stringify({ success: true, message: "Email notifications disabled" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

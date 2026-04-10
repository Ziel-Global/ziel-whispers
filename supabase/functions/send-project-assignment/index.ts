import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { user_id, project_name, role_name, action } = await req.json();
    if (!user_id || !project_name || !action) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: user } = await supabase.from("users").select("email, full_name").eq("id", user_id).single();
    if (!user) throw new Error("User not found");

    const isAdded = action === "added";
    const subject = isAdded
      ? `You've been added to project: ${project_name}`
      : `You've been removed from project: ${project_name}`;

    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;max-width:500px;">
        <h2 style="color:#1A1B1E;">${isAdded ? "New Project Assignment" : "Project Update"}</h2>
        <p>Hi ${user.full_name},</p>
        <p>You have been <strong>${isAdded ? "added to" : "removed from"}</strong> the project <strong>${project_name}</strong>${isAdded && role_name ? ` as <strong>${role_name}</strong>` : ""}.</p>
        ${isAdded ? `<a href="https://id-preview--71558b0e-812b-4b7d-9faf-956160583e7f.lovable.app/projects" style="background:#D0FF71;color:#000;padding:10px 24px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;margin-top:15px;">View Projects</a>` : ""}
      </div>
    `;

    await supabase.functions.invoke("send-email", {
      body: { to: user.email, subject, html },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ ok: false, error: "Missing authorization" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: roleData } = await callerClient.rpc("get_my_role");
    if (roleData !== "admin") {
      return jsonResponse({ ok: false, error: "Only admins can invite users" });
    }

    const body = await req.json();
    const {
      email, full_name, department, designation, employment_type,
      join_date, role, phone, shift_start, shift_end,
      reminder_offset_minutes, password, app_url,
    } = body;

    if (!email || !full_name || !department || !designation || !employment_type || !join_date) {
      return jsonResponse({ ok: false, error: "Missing required fields: email, full_name, department, designation, employment_type, join_date" });
    }

    const userPassword = password && password.length >= 8
      ? password
      : crypto.randomUUID().slice(0, 12) + "A1!";

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Origin: supabaseUrl } },
    });

    // Pull defaults from system_settings — no hardcoded shift/reminder values here.
    const { data: settingsRows } = await adminClient
      .from("system_settings")
      .select("key, value")
      .in("key", ["default_shift_start", "default_shift_end", "reminder_offset_minutes"]);
    const settingsMap: Record<string, string> = {};
    (settingsRows || []).forEach((s: any) => { settingsMap[s.key] = s.value; });
    const fallbackShiftStart = settingsMap["default_shift_start"] || null;
    const fallbackShiftEnd = settingsMap["default_shift_end"] || null;
    const fallbackReminder = Number(settingsMap["reminder_offset_minutes"]) || null;

    if ((!shift_start && !fallbackShiftStart) || (!shift_end && !fallbackShiftEnd) || (!reminder_offset_minutes && !fallbackReminder)) {
      return jsonResponse({ ok: false, error: "Default shift/reminder settings are not configured. Please configure them in Settings before inviting users." });
    }

    // 1. Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
    });

    if (authError) {
      console.error("Auth create error:", authError.message);
      return jsonResponse({ ok: false, error: authError.message });
    }

    const userId = authData.user.id;
    const callerId = (await callerClient.auth.getUser()).data.user?.id;

    // 2. Upsert user row — the handle_new_user trigger may have already created a row
    // with default values, so we always update to ensure the admin-entered values are saved.
    const profileData = {
      id: userId,
      email,
      full_name,
      department,
      designation,
      employment_type,
      join_date,
      role: role || "employee",
      phone: phone || null,
      shift_start: shift_start || fallbackShiftStart,
      shift_end: shift_end || fallbackShiftEnd,
      reminder_offset_minutes: reminder_offset_minutes || fallbackReminder,
      must_change_password: true,
      status: "active",
      created_by: callerId,
    };

    const { error: upsertError } = await adminClient.from("users").upsert(profileData, { onConflict: "id" });

    if (upsertError) {
      console.error("Profile upsert error:", upsertError.message);
      await adminClient.auth.admin.deleteUser(userId);
      return jsonResponse({ ok: false, error: upsertError.message });
    }

    // 3. Audit log
    await adminClient.from("audit_logs").insert({
      actor_id: callerId,
      action: "user.created",
      target_entity: "users",
      target_id: userId,
      metadata: { email, full_name, role: role || "employee" },
    });

    // 4. If the new user is a Client or Client Member, send a branded welcome email with a password setup link
    if (designation === "Client" || designation === "Client Member") {
      await adminClient.from("audit_logs").insert({
        actor_id: callerId,
        action: "debug.email_block_entered",
        target_entity: "users",
        target_id: userId,
        metadata: { email, designation },
      });

      const loginLink = `${app_url || "http://localhost:8080"}/login`;

        const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to Ziel Logs</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#000000;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">

          <!-- Header with dark sidebar colour matching the app -->
          <tr>
            <td style="padding:28px 40px;background:#1c1c1f;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Ziel Logs</h1>
                    <p style="margin:4px 0 0;font-size:12px;color:#a0a0a0;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;">Client Portal Access</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Lime accent strip -->
          <tr>
            <td style="height:4px;background:#d0ff71;"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#000000;">Welcome, ${full_name}!</h2>
              <p style="margin:0 0 20px;font-size:14px;color:#737373;line-height:1.6;">
                You have been invited to the <strong style="color:#000000;">Ziel Logs</strong> client portal.<br/>
                You can now view your projects and track progress in real time.
              </p>

              <table cellpadding="0" cellspacing="0" style="background:#f5f5f5;border-radius:8px;border:1px solid #e5e5e5;width:100%;margin-bottom:16px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e5e5;">
                    <p style="margin:0 0 4px;font-size:12px;color:#737373;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Account email</p>
                    <p style="margin:0;font-size:15px;color:#000000;font-weight:500;">${email}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#737373;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">One-time password</p>
                    <p style="margin:0;font-size:15px;color:#000000;font-weight:500;font-family:monospace;letter-spacing:1px;">${userPassword}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px;font-size:14px;color:#737373;line-height:1.6;">
                This is a <strong style="color:#000000;">one-time password</strong>. Please sign in using the credentials above and create a new password of your choice when prompted.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
                <tr>
                  <td style="border-radius:8px;background:#d0ff71;">
                    <a href="${loginLink}" target="_blank"
                      style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#000000;text-decoration:none;letter-spacing:-0.2px;border-radius:8px;"
                    >
                      Sign In to Your Account →
                    </a>
                  </td>
                </tr>
              </table>


            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e5e5e5;background:#fafafa;">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">
                This invitation was sent by <strong style="color:#737373;">Ziel Admin</strong>. If you did not expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>

        </table>

        <!-- Bottom caption -->
        <p style="margin:16px 0 0;font-size:11px;color:#a3a3a3;">© Ziel Logs · Client Portal</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

        try {
          const res = await adminClient.functions.invoke("send-email", {
            body: {
              to: email,
              subject: "You've been invited to Ziel Logs — Sign in with your one-time password",
              html: emailHtml,
              fromName: "Ziel Admin",
            },
          });
          
          if (res.error) throw res.error;

          await adminClient.from("audit_logs").insert({
            actor_id: callerId,
            action: "debug.invoke_send_email_success",
            target_entity: "users",
            target_id: userId,
            metadata: { email, designation, res: res.data },
          });
        } catch (emailErr: any) {
          const emailErrMsg = emailErr instanceof Error ? emailErr.message : (emailErr?.context?.name || String(emailErr));
          console.error("Failed to send client welcome email:", emailErrMsg, emailErr);
          await adminClient.from("audit_logs").insert({
            actor_id: callerId,
            action: "debug.invoke_send_email_failed",
            target_entity: "users",
            target_id: userId,
            metadata: { email, designation, error: emailErrMsg, full_error: emailErr },
          });
        }
    }

    return jsonResponse({ ok: true, user_id: userId, email });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("invite-user error:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

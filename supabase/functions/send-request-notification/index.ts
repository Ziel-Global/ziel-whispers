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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { type, action, request_id, admin_comment, app_url } = await req.json();

    if (!type || !action || !request_id) {
      return jsonResponse({ ok: false, error: "Missing type, action, or request_id" });
    }

    const adminPanelUrl = app_url || "https://goutpygixoxkgbrfmkey.supabase.co";

    let employeeName: string;
    let employeeEmail: string;
    let requestData: Record<string, unknown>;

    if (type === "leave") {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, leave_types(name), users!leave_requests_user_id_fkey(full_name, email)")
        .eq("id", request_id)
        .single();
      if (error || !data) {
        console.error("send-request-notification: leave request not found", error);
        return jsonResponse({ ok: false, error: "Leave request not found" });
      }

      employeeName = (data as Record<string, unknown>).users?.full_name || "Employee";
      employeeEmail = (data as Record<string, unknown>).users?.email || "";
      requestData = {
        leave_type: getLeaveTypeName(data),
        start_date: (data as Record<string, unknown>).start_date,
        end_date: (data as Record<string, unknown>).end_date,
        days_count: (data as Record<string, unknown>).days_count,
        hours: (data as Record<string, unknown>).hours,
        reason: (data as Record<string, unknown>).reason,
      };
    } else if (type === "wfh") {
      const { data, error } = await supabase
        .from("remote_work_requests")
        .select("*, users!remote_work_requests_user_id_fkey(full_name, email)")
        .eq("id", request_id)
        .single();
      if (error || !data) {
        console.error("send-request-notification: WFH request not found", error);
        return jsonResponse({ ok: false, error: "Work from home request not found" });
      }

      employeeName = (data as Record<string, unknown>).users?.full_name || "Employee";
      employeeEmail = (data as Record<string, unknown>).users?.email || "";
      requestData = {
        start_date: (data as Record<string, unknown>).start_date,
        end_date: (data as Record<string, unknown>).end_date,
        reason: (data as Record<string, unknown>).reason,
      };
    } else {
      return jsonResponse({ ok: false, error: "Invalid type. Must be 'leave' or 'wfh'" });
    }

    if (!employeeEmail) {
      console.error("send-request-notification: employee email not found");
      return jsonResponse({ ok: false, error: "Employee email not found" });
    }

    if (action === "new") {
      const { data: adminEmailSetting } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "admin_email")
        .maybeSingle();

      const { data: admins } = await supabase
        .from("users")
        .select("email")
        .eq("role", "admin")
        .eq("status", "active");

      const adminEmails = new Set<string>();
      if (adminEmailSetting?.value) adminEmails.add(adminEmailSetting.value);
      if (admins) admins.forEach((a) => { if (a.email) adminEmails.add(a.email); });

      if (adminEmails.size === 0) {
        console.error("send-request-notification: no admin email configured");
        return jsonResponse({ ok: false, error: "Admin email not configured" });
      }

      let subject: string;
      let html: string;

      if (type === "leave") {
        subject = `New Leave Request - ${employeeName}`;
        html = buildNewLeaveRequestHtml(employeeName, requestData, adminPanelUrl);
      } else {
        subject = `New Remote Work Request - ${employeeName}`;
        html = buildNewWfhRequestHtml(employeeName, requestData, adminPanelUrl);
      }

      for (const adminEmail of adminEmails) {
        await callSendEmail(supabase, adminEmail, subject, html);
      }
    } else if (action === "approved" || action === "rejected") {
      const statusLabel = action === "approved" ? "Approved" : "Rejected";
      let subject: string;
      let html: string;

      if (type === "leave") {
        subject = action === "approved"
          ? "Your Leave Request Has Been Approved"
          : "Your Leave Request Has Been Rejected";
        html = buildLeaveStatusHtml(employeeName, statusLabel, requestData, admin_comment || "");
      } else {
        subject = action === "approved"
          ? "Your Remote Work Request Has Been Approved"
          : "Your Remote Work Request Has Been Rejected";
        html = buildWfhStatusHtml(employeeName, statusLabel, requestData, admin_comment || "");
      }

      await callSendEmail(supabase, employeeEmail, subject, html);
    } else {
      return jsonResponse({ ok: false, error: "Invalid action. Must be 'new', 'approved', or 'rejected'" });
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-request-notification error:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

async function callSendEmail(
  supabase: ReturnType<typeof createClient>,
  to: string,
  subject: string,
  html: string,
) {
  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { to, subject, html, fromName: "Ziel Logs", fromEmail: "noreply@zielglobal.com" },
      headers: serviceRoleKey ? { Authorization: `Bearer ${serviceRoleKey}` } : undefined,
    });

    if (error) {
      console.error("send-request-notification: send-email invoke error:", error);
      return;
    }

    if (!data?.ok) {
      console.error("send-request-notification: send-email returned error:", data?.error ?? "unknown");
      return;
    }

    console.log("send-request-notification: email sent via send-email, id=", data?.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-request-notification: callSendEmail error:", message);
  }
}

function getLeaveTypeName(r: Record<string, unknown>): string {
  if (!r) return "";
  const hours = r.hours;
  if (hours) return `Hourly Leave — ${hours} hours`;
  const reason = (r.reason as string) || "";
  const leaveTypes = r.leave_types as Record<string, unknown> | null;
  const nameFromReason = reason.split(":")[0]?.split(" - ")[0];
  return nameFromReason || leaveTypes?.name as string || "Annual";
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function wrapperHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
  .container{max-width:560px;margin:0 auto;padding:24px 16px}
  .card{background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
  .header{text-align:center;margin-bottom:24px}
  .logo{font-size:20px;font-weight:700;color:#1A1B1E}
  .divider{height:1px;background:#e4e4e7;margin:20px 0}
  .field{margin-bottom:12px}
  .field-label{font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#71717a;margin-bottom:2px}
  .field-value{font-size:14px;color:#1A1B1E;line-height:1.5}
  .status-badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:600}
  .status-approved{background:#dcfce7;color:#166534}
  .status-rejected{background:#fee2e2;color:#991b1b}
  .footer{text-align:center;margin-top:24px;font-size:12px;color:#a1a1aa}
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <div class="header">
      <div class="logo">Ziel Logs</div>
    </div>
    ${bodyHtml}
    <div class="divider"></div>
    <div class="footer">
      <p>This is an automated notification from Ziel Logs.</p>
    </div>
  </div>
</div>
</body>
</html>`;
}

function buildNewLeaveRequestHtml(employeeName: string, data: Record<string, unknown>, adminPanelUrl: string): string {
  const body = `
    <p style="font-size:15px;color:#1A1B1E;margin-bottom:20px;">
      A new leave request has been submitted.
    </p>
    <div class="field">
      <div class="field-label">Employee</div>
      <div class="field-value">${employeeName}</div>
    </div>
    <div class="field">
      <div class="field-label">Leave Type</div>
      <div class="field-value">${data.leave_type || "—"}</div>
    </div>
    <div class="field">
      <div class="field-label">From</div>
      <div class="field-value">${formatDate(data.start_date as string)}</div>
    </div>
    <div class="field">
      <div class="field-label">To</div>
      <div class="field-value">${formatDate(data.end_date as string)}</div>
    </div>
    <div class="field">
      <div class="field-label">Duration</div>
      <div class="field-value">${data.hours ? `${data.hours} hours` : `${data.days_count} day(s)`}</div>
    </div>
    <div class="field">
      <div class="field-label">Reason</div>
      <div class="field-value">${(data.reason as string) || "—"}</div>
    </div>
    <div style="margin-top:24px;text-align:center">
      <a href="${adminPanelUrl}/leave/requests" style="display:inline-block;background:#D0FF71;color:#000;padding:10px 24px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
        View in Admin Panel
      </a>
    </div>
  `;
  return wrapperHtml(body);
}

function buildNewWfhRequestHtml(employeeName: string, data: Record<string, unknown>, adminPanelUrl: string): string {
  const dateStr = data.start_date === data.end_date
    ? formatDate(data.start_date as string)
    : `${formatDate(data.start_date as string)} — ${formatDate(data.end_date as string)}`;
  const body = `
    <p style="font-size:15px;color:#1A1B1E;margin-bottom:20px;">
      A new remote work request has been submitted.
    </p>
    <div class="field">
      <div class="field-label">Employee</div>
      <div class="field-value">${employeeName}</div>
    </div>
    <div class="field">
      <div class="field-label">Date Range</div>
      <div class="field-value">${dateStr}</div>
    </div>
    <div class="field">
      <div class="field-label">Reason</div>
      <div class="field-value">${(data.reason as string) || "—"}</div>
    </div>
    <div style="margin-top:24px;text-align:center">
      <a href="${adminPanelUrl}/leave/requests" style="display:inline-block;background:#D0FF71;color:#000;padding:10px 24px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
        View in Admin Panel
      </a>
    </div>
  `;
  return wrapperHtml(body);
}

function buildLeaveStatusHtml(employeeName: string, statusLabel: string, data: Record<string, unknown>, adminComment: string): string {
  const isApproved = statusLabel === "Approved";
  const badgeClass = isApproved ? "status-approved" : "status-rejected";
  const body = `
    <p style="font-size:15px;color:#1A1B1E;margin-bottom:20px;">
      Hello <strong>${employeeName}</strong>,
    </p>
    <div style="text-align:center;margin-bottom:20px">
      <span class="status-badge ${badgeClass}">${statusLabel}</span>
    </div>
    <p style="font-size:14px;color:#52525b;line-height:1.6;margin-bottom:20px;">
      Your leave request has been <strong>${statusLabel.toLowerCase()}</strong>.
    </p>
    <div class="field">
      <div class="field-label">Leave Type</div>
      <div class="field-value">${data.leave_type || "—"}</div>
    </div>
    <div class="field">
      <div class="field-label">From</div>
      <div class="field-value">${formatDate(data.start_date as string)}</div>
    </div>
    <div class="field">
      <div class="field-label">To</div>
      <div class="field-value">${formatDate(data.end_date as string)}</div>
    </div>
    <div class="field">
      <div class="field-label">Duration</div>
      <div class="field-value">${data.hours ? `${data.hours} hours` : `${data.days_count} day(s)`}</div>
    </div>
    ${!isApproved && adminComment ? `
    <div class="divider"></div>
    <div class="field">
      <div class="field-label">Reason for Rejection</div>
      <div class="field-value">${adminComment}</div>
    </div>
    ` : ""}
  `;
  return wrapperHtml(body);
}

function buildWfhStatusHtml(employeeName: string, statusLabel: string, data: Record<string, unknown>, adminComment: string): string {
  const isApproved = statusLabel === "Approved";
  const badgeClass = isApproved ? "status-approved" : "status-rejected";
  const dateStr = data.start_date === data.end_date
    ? formatDate(data.start_date as string)
    : `${formatDate(data.start_date as string)} — ${formatDate(data.end_date as string)}`;
  const body = `
    <p style="font-size:15px;color:#1A1B1E;margin-bottom:20px;">
      Hello <strong>${employeeName}</strong>,
    </p>
    <div style="text-align:center;margin-bottom:20px">
      <span class="status-badge ${badgeClass}">${statusLabel}</span>
    </div>
    <p style="font-size:14px;color:#52525b;line-height:1.6;margin-bottom:20px;">
      Your remote work request has been <strong>${statusLabel.toLowerCase()}</strong>.
    </p>
    <div class="field">
      <div class="field-label">Date Range</div>
      <div class="field-value">${dateStr}</div>
    </div>
    <div class="field">
      <div class="field-label">Reason</div>
      <div class="field-value">${(data.reason as string) || "—"}</div>
    </div>
    ${!isApproved && adminComment ? `
    <div class="divider"></div>
    <div class="field">
      <div class="field-label">Reason for Rejection</div>
      <div class="field-value">${adminComment}</div>
    </div>
    ` : ""}
  `;
  return wrapperHtml(body);
}

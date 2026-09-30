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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isClientMember(user: { role?: string | null; designation?: string | null }) {
  const role = (user.role || "").toLowerCase().trim();
  const designation = (user.designation || "").toLowerCase().trim();
  return (
    role === "client" ||
    role === "client member" ||
    designation === "client" ||
    designation === "client member"
  );
}

function buildTaskAssignmentHtml({
  fullName,
  taskTitle,
  projectName,
  assignedBy,
  dueDate,
  priority,
  portalUrl,
}: {
  fullName: string;
  taskTitle: string;
  projectName: string;
  assignedBy: string;
  dueDate?: string | null;
  priority?: string | null;
  portalUrl: string;
}) {
  const dueLabel = dueDate
    ? new Date(dueDate + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const priorityLabel = priority
    ? priority.charAt(0).toUpperCase() + priority.slice(1)
    : "—";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New task assigned</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#000000;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">

          <tr>
            <td style="padding:28px 40px;background:#1c1c1f;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Ziel Logs</h1>
              <p style="margin:4px 0 0;font-size:12px;color:#a0a0a0;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;">Client Portal</p>
            </td>
          </tr>

          <tr>
            <td style="height:4px;background:#d0ff71;"></td>
          </tr>

          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#000000;">Hi ${escapeHtml(fullName)},</h2>
              <p style="margin:0 0 20px;font-size:14px;color:#737373;line-height:1.6;">
                You have been assigned a new task in <strong style="color:#000000;">${escapeHtml(projectName)}</strong>
                by <strong style="color:#000000;">${escapeHtml(assignedBy)}</strong>.
                Open the client portal to review the details and track progress.
              </p>

              <table cellpadding="0" cellspacing="0" style="background:#f0f7ff;border-radius:8px;border:1px solid #cfe0f5;width:100%;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #cfe0f5;">
                    <p style="margin:0 0 4px;font-size:12px;color:#1c6fc9;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Task</p>
                    <p style="margin:0;font-size:15px;color:#000000;font-weight:600;">${escapeHtml(taskTitle)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #cfe0f5;">
                    <p style="margin:0 0 4px;font-size:12px;color:#737373;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Project</p>
                    <p style="margin:0;font-size:14px;color:#000000;">${escapeHtml(projectName)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" valign="top" style="padding-right:8px;">
                          <p style="margin:0 0 4px;font-size:12px;color:#737373;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Due date</p>
                          <p style="margin:0;font-size:14px;color:#000000;">${escapeHtml(dueLabel)}</p>
                        </td>
                        <td width="50%" valign="top" style="padding-left:8px;">
                          <p style="margin:0 0 4px;font-size:12px;color:#737373;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Priority</p>
                          <p style="margin:0;font-size:14px;color:#000000;">${escapeHtml(priorityLabel)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table cellpadding="0" cellspacing="0" style="margin-top:8px;">
                <tr>
                  <td style="border-radius:8px;background:#d0ff71;">
                    <a href="${escapeHtml(portalUrl)}" target="_blank"
                      style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#000000;text-decoration:none;letter-spacing:-0.2px;border-radius:8px;"
                    >
                      View Task in Portal →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:18px 0 0;font-size:12px;color:#a3a3a3;line-height:1.5;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${escapeHtml(portalUrl)}" style="color:#1c6fc9;word-break:break-all;">${escapeHtml(portalUrl)}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e5e5e5;background:#fafafa;">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">
                Ziel Logs — Client Portal task notification.<br/>
                If you did not expect this assignment, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#a3a3a3;">© Ziel Logs · Client Portal</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const {
      assignee_user_id,
      task_title,
      project_name,
      project_id,
      assigned_by_name,
      due_date,
      priority,
      app_url,
    } = body;

    if (!assignee_user_id || !task_title || !project_name) {
      return jsonResponse({
        ok: false,
        error: "Missing assignee_user_id, task_title, or project_name",
      });
    }

    const { data: assignee, error: assigneeError } = await supabase
      .from("users")
      .select("id, email, full_name, role, designation, status")
      .eq("id", assignee_user_id)
      .single();

    if (assigneeError || !assignee) {
      return jsonResponse({ ok: false, error: "Assignee not found" });
    }

    if (!isClientMember(assignee)) {
      return jsonResponse({ ok: true, skipped: true, reason: "Assignee is not a client member" });
    }

    if (!assignee.email) {
      return jsonResponse({ ok: false, error: "Assignee has no login email" });
    }

    const baseUrl = (app_url || "http://localhost:8080").replace(/\/$/, "");
    const projectSlug = String(project_name)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const portalUrl = project_id
      ? `${baseUrl}/projects/${projectSlug || project_id}`
      : `${baseUrl}/projects`;

    const html = buildTaskAssignmentHtml({
      fullName: assignee.full_name || "there",
      taskTitle: task_title,
      projectName: project_name,
      assignedBy: assigned_by_name || "an administrator",
      dueDate: due_date || null,
      priority: priority || null,
      portalUrl,
    });

    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        to: assignee.email,
        subject: `New task assigned: ${task_title}`,
        html,
        fromName: "Ziel Logs",
        fromEmail: "noreply@zielglobal.com",
      },
      headers: { Authorization: `Bearer ${serviceRoleKey}` },
    });

    if (error) {
      console.error("send-task-assignment: send-email invoke error:", error);
      return jsonResponse({ ok: false, error: error.message || "Failed to invoke send-email" });
    }

    if (data?.ok === false) {
      console.error("send-task-assignment: send-email returned error:", data?.error);
      return jsonResponse({ ok: false, error: data?.error || "send-email failed" });
    }

    return jsonResponse({ ok: true, to: assignee.email, id: data?.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-task-assignment fatal:", message);
    return jsonResponse({ ok: false, error: message });
  }
});

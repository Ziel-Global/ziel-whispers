"use client";
import { supabase } from "@/integrations/supabase/client";

type NotificationType = 
  | 'project_update' 
  | 'action_item_created' 
  | 'action_item_completed' 
  | 'action_item_linked' 
  | 'action_item_auto_completed' 
  | 'blocker_created' 
  | 'blocker_resolved' 
  | 'leave_request' 
  | 'remote_work_request'
  | 'task_created'
  | 'task_edited'
  | 'task_deleted'
  | 'task_completed'
  | 'task_returned'
  | 'task_assigned';

export async function createNotification({
  userId,
  type,
  title,
  message,
  projectId,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  projectId?: string;
}) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    channel: "in_app",
    metadata: { title, message, project_id: projectId },
    read: false,
  });
  
  if (error) console.error("createNotification error:", error);
  return error;
}

export async function getProjectMemberIds(projectId: string) {
  const { data, error } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .is("removed_at", null);
  
  if (error) throw error;
  return data?.map(member => member.user_id) || [];
}

export async function getAdminManagerIds(excludeUserId?: string) {
  const { data, error } = await supabase.rpc("get_admin_manager_ids");
  
  if (error) throw error;
  return (data || []).map((r: any) => r.id).filter((id: string) => id !== excludeUserId);
}

export async function createProjectRelatedNotifications({
  createdByUserId,
  projectId,
  type,
  title,
  message,
  requiresClientAction = false,
}: {
  createdByUserId: string;
  projectId: string;
  type: NotificationType;
  title: string;
  message: string;
  requiresClientAction?: boolean;
}) {
  const projectMemberIds = await getProjectMemberIds(projectId);
  const adminManagerIds = await getAdminManagerIds(createdByUserId);
  
  const targetUserIds = new Set(projectMemberIds);
  adminManagerIds.forEach(id => targetUserIds.add(id));
  targetUserIds.delete(createdByUserId);
  
  if (requiresClientAction) {
    const clientMemberIds = await getClientMemberIds(projectId);
    clientMemberIds.forEach(id => targetUserIds.add(id));
  }
  
  const notificationsToInsert = Array.from(targetUserIds).map(userId => ({
    user_id: userId,
    type,
    channel: "in_app",
    metadata: { title, message, project_id: projectId, created_by: createdByUserId },
    read: false,
  }));
  
  if (notificationsToInsert.length > 0) {
    const { error } = await supabase.from("notifications").insert(notificationsToInsert);
    if (error) console.error("createProjectRelatedNotifications error:", error);
    return error;
  }
  return null;
}

export async function getClientMemberIds(projectId: string) {
  const { data, error } = await supabase
    .from("project_members")
    .select("user_id, users!inner(role)")
    .eq("project_id", projectId)
    .is("removed_at", null)
    .in("users.role", ["client", "client member"]);
  
  if (error) throw error;
  return data?.map(member => member.user_id) || [];
}

function isClientMemberUser(user: { role?: string | null; designation?: string | null } | null | undefined) {
  if (!user) return false;
  const role = (user.role || "").toLowerCase().trim();
  const designation = (user.designation || "").toLowerCase().trim();
  return (
    role === "client" ||
    role === "client member" ||
    designation === "client" ||
    designation === "client member"
  );
}

/** In-app notify assignee (on assign); if client member, also email their login address. */
export async function notifyTaskAssigned({
  assigneeUserId,
  taskTitle,
  projectId,
  projectName,
  assignedByName,
  dueDate,
  priority,
  event = "assigned",
  appUrl = typeof window !== "undefined" ? window.location.origin : undefined,
}: {
  assigneeUserId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  assignedByName?: string;
  dueDate?: string | null;
  priority?: string | null;
  /** assigned = new assignment; updated = task edit while still assigned */
  event?: "assigned" | "updated";
  appUrl?: string;
}) {
  // In-app "Task Assigned" only on new assignment; edit already fans out "Task Updated".
  if (event === "assigned") {
    await createNotification({
      userId: assigneeUserId,
      type: "task_assigned",
      title: "Task Assigned",
      message: `You have been assigned to task "${taskTitle}" in project "${projectName}"`,
      projectId,
    });
  }

  const { data: assignee, error: assigneeError } = await supabase
    .from("users")
    .select("id, email, role, designation")
    .eq("id", assigneeUserId)
    .maybeSingle();

  if (assigneeError) {
    console.error("notifyTaskAssigned: failed to load assignee", assigneeError);
    return;
  }

  if (!isClientMemberUser(assignee)) {
    console.warn("notifyTaskAssigned: skipped email (not a client member)", {
      assigneeUserId,
      role: assignee?.role,
      designation: assignee?.designation,
      event,
    });
    return;
  }

  if (!assignee?.email) {
    console.error("notifyTaskAssigned: client member has no login email", { assigneeUserId });
    return;
  }

  try {
    console.info("notifyTaskAssigned: invoking send-task-assignment", {
      assigneeUserId,
      email: assignee.email,
      taskTitle,
      event,
    });
    const { data, error } = await supabase.functions.invoke("send-task-assignment", {
      body: {
        assignee_user_id: assigneeUserId,
        task_title: taskTitle,
        project_name: projectName,
        project_id: projectId,
        assigned_by_name: assignedByName || "an administrator",
        due_date: dueDate || null,
        priority: priority || null,
        app_url: appUrl,
        event,
      },
    });
    if (error) {
      console.error("notifyTaskAssigned email error:", error);
      return;
    }
    if (data?.ok === false) {
      console.error("notifyTaskAssigned email failed:", data?.error);
      return;
    }
    if (data?.skipped) {
      console.warn("notifyTaskAssigned email skipped by edge function:", data);
      return;
    }
    console.info("notifyTaskAssigned email ok:", data);
  } catch (err) {
    console.error("notifyTaskAssigned email exception:", err);
  }
}

"use client";
import { supabase } from "@/integrations/supabase/client";

export type NotificationType = 
  | 'project_update' 
  | 'action_item_created' 
  | 'action_item_completed' 
  | 'action_item_linked' 
  | 'action_item_auto_completed' 
  | 'blocker_created' 
  | 'blocker_resolved' 
  | 'leave_request' 
  | 'leave.approved'
  | 'leave.rejected'
  | 'leave.balance_exhausted'
  | 'remote_work_request'
  | 'remote_work.approved'
  | 'remote_work.rejected'
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

export async function getAdminManagerIds(excludeUserId?: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_admin_manager_ids");
  
  if (error) throw error;
  const rawIds: string[] = (data || []).map((r: any) => r.id).filter((id: string) => id && id !== excludeUserId);
  if (rawIds.length === 0) return [];

  // Filter out non-admin roles if users table roles are readable (defensive fallback before DB migration)
  const { data: usersData } = await supabase
    .from("users")
    .select("id, role")
    .in("id", rawIds);

  if (usersData && usersData.length > 0) {
    const nonAdminIds = new Set(
      usersData.filter(u => u.role && u.role !== "admin").map(u => u.id)
    );
    return rawIds.filter(id => !nonAdminIds.has(id));
  }

  return rawIds;
}

/**
 * Returns active Admin user IDs + Project Manager user IDs who are assigned to `projectId`.
 */
export async function getProjectAdminManagerIds(projectId: string, excludeUserId?: string): Promise<string[]> {
  const { data, error } = await (supabase as any).rpc("get_project_notification_admin_ids", {
    p_project_id: projectId,
  });

  if (!error && Array.isArray(data)) {
    return data.map((r: any) => r.id).filter((id: string) => id && id !== excludeUserId);
  }

  // Fallback if RPC has not yet been deployed to the database
  const [{ data: rawRpcData, error: rpcErr }, projectMemberIds] = await Promise.all([
    supabase.rpc("get_admin_manager_ids"),
    getProjectMemberIds(projectId).catch(() => [] as string[]),
  ]);
  if (rpcErr) throw rpcErr;

  const rawIds: string[] = (rawRpcData || [])
    .map((r: any) => r.id)
    .filter((id: string) => id && id !== excludeUserId);
  if (rawIds.length === 0) return [];

  const memberSet = new Set(projectMemberIds);
  const { data: usersData } = await supabase
    .from("users")
    .select("id, role")
    .in("id", rawIds);

  if (usersData && usersData.length > 0) {
    const roleMap = new Map(usersData.map(u => [u.id, u.role]));
    return rawIds.filter(id => {
      const role = roleMap.get(id);
      if (!role) return true; // If RLS hid the row on an unmigrated DB, keep admin/PM candidate
      if (role === "admin") return true;
      if (role === "project_manager") return memberSet.has(id);
      return false;
    });
  }

  return rawIds;
}

/**
 * Returns active Admin user IDs + HR Manager user IDs for Leave / WFH requests.
 */
export async function getLeaveAdminIds(excludeUserId?: string): Promise<string[]> {
  const { data, error } = await (supabase as any).rpc("get_hr_admin_ids");

  if (!error && Array.isArray(data)) {
    return data.map((r: any) => r.id).filter((id: string) => id && id !== excludeUserId);
  }

  // Fallback if RPC has not yet been deployed to the database
  const { data: rawRpcData, error: rpcErr } = await supabase.rpc("get_admin_manager_ids");
  if (rpcErr) throw rpcErr;

  const rawIds: string[] = (rawRpcData || [])
    .map((r: any) => r.id)
    .filter((id: string) => id && id !== excludeUserId);
  if (rawIds.length === 0) return [];

  const { data: usersData } = await supabase
    .from("users")
    .select("id, role")
    .in("id", rawIds);

  if (usersData && usersData.length > 0) {
    const roleMap = new Map(usersData.map(u => [u.id, u.role]));
    return rawIds.filter(id => {
      const role = roleMap.get(id);
      if (!role) return true;
      return role === "admin" || role === "hr_manager";
    });
  }

  return rawIds;
}

export async function createProjectRelatedNotifications({
  createdByUserId,
  projectId,
  type,
  title,
  message,
  recipientUserIds = [],
  includeAllProjectMembers = false,
  requiresClientAction = false,
}: {
  createdByUserId: string;
  projectId: string;
  type: NotificationType;
  title: string;
  message: string;
  recipientUserIds?: (string | null | undefined)[];
  includeAllProjectMembers?: boolean;
  requiresClientAction?: boolean;
}) {
  const adminAndProjectPmIds = await getProjectAdminManagerIds(projectId, createdByUserId);
  const targetUserIds = new Set<string>(adminAndProjectPmIds);

  for (const id of recipientUserIds) {
    if (id) targetUserIds.add(id);
  }

  if (includeAllProjectMembers) {
    const [projectMemberIds, clientMemberIds] = await Promise.all([
      getProjectMemberIds(projectId),
      getClientMemberIds(projectId).catch(() => [] as string[]),
    ]);
    const clientSet = new Set(clientMemberIds);
    projectMemberIds.forEach(id => {
      if (!clientSet.has(id) || requiresClientAction) {
        targetUserIds.add(id);
      }
    });
    if (requiresClientAction) {
      clientMemberIds.forEach(id => targetUserIds.add(id));
    }
  }
  
  targetUserIds.delete(createdByUserId);
  
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
  assignedByUserId,
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
  assignedByUserId?: string;
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
  if (event === "assigned" && assigneeUserId !== assignedByUserId) {
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

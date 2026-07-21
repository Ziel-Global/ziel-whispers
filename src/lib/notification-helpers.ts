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
  
  let targetUserIds = new Set(projectMemberIds);
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

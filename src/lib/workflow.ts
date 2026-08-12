import { supabase } from "@/integrations/supabase/client";

export const TASK_STATUS_COLORS: Record<string, string> = {
  unlinked: "bg-gray-100 text-gray-800",
  linked: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  complete: "bg-green-100 text-green-800",
  returned: "bg-red-100 text-red-800",
};

export const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
};

export const PROJECT_STATUS_OPTIONS = [
  "active",
  "on_hold",
  "completed",
  "archived",
];

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  on_hold: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
  archived: "bg-muted text-muted-foreground",
};

export function getStatusColor(status: string): string {
  return TASK_STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
}

export function getPriorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] || "bg-gray-100 text-gray-800";
}

export function getCategoryColor(category: string): string {
  switch (category) {
    case "todo":
      return "bg-gray-100 text-gray-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "done":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export type WorkflowStatus = {
  id: string;
  name: string;
  category: string;
  color: string;
  sort_order: number;
  is_initial: boolean;
};

export type WorkflowTransition = {
  id: string;
  from_status_id: string | null;
  to_status_id: string;
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string | null;
};

export async function fetchWorkflowTemplate(projectId: string): Promise<{
  template: WorkflowTemplate | null;
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
}> {
  const { data: project } = await supabase
    .from("projects")
    .select("workflow_template_id")
    .eq("id", projectId)
    .single();

  if (!project?.workflow_template_id) {
    return { template: null, statuses: [], transitions: [] };
  }

  const [templateRes, statusesRes, transitionsRes] = await Promise.all([
    supabase
      .from("workflow_templates")
      .select("id, name, description")
      .eq("id", project.workflow_template_id)
      .single(),
    supabase
      .from("workflow_statuses")
      .select("*")
      .eq("workflow_template_id", project.workflow_template_id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("workflow_transitions")
      .select("*")
      .eq("workflow_template_id", project.workflow_template_id),
  ]);

  return {
    template: templateRes.data,
    statuses: (statusesRes.data || []) as WorkflowStatus[],
    transitions: (transitionsRes.data || []) as WorkflowTransition[],
  };
}

export function getAllowedTransitions(
  statuses: WorkflowStatus[],
  transitions: WorkflowTransition[],
  fromStatusId: string | null,
): WorkflowStatus[] {
  const allowedIds = transitions
    .filter((t) => t.from_status_id === fromStatusId)
    .map((t) => t.to_status_id);
  return statuses.filter((s) => allowedIds.includes(s.id));
}

export function getInitialStatus(
  statuses: WorkflowStatus[],
): WorkflowStatus | undefined {
  return statuses.find((s) => s.is_initial);
}

export async function changeTaskStatus(
  taskId: string,
  newStatusId: string,
  changedByType: "admin" | "system" | "auto" = "system",
) {
  const { error } = await supabase.rpc("change_task_status", {
    p_task_id: taskId,
    p_new_status_id: newStatusId,
    p_changed_by_type: changedByType,
  });
  if (error) throw error;
}

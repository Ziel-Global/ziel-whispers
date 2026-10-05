import { supabase } from "@/integrations/supabase/client";

export const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
};

export const PROJECT_STATUS_OPTIONS = ["active", "on_hold", "completed", "archived"];

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  on_hold: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
  archived: "bg-muted text-muted-foreground",
};

export function isClientRole(profile: { role?: string | null } | null | undefined): boolean {
  const role = profile?.role;
  return role === "client" || role === "client member";
}

/** Client portal lists and navigation — archived projects are hidden. */
export function isProjectVisibleToClientPortal(project: { status?: string | null }): boolean {
  return project.status !== "archived";
}

export function getStatusColor(
  workflowStatuses: WorkflowStatus[],
  statusId: string | null
): string {
  if (!statusId) return "bg-gray-100 text-gray-800";
  return workflowStatuses.find((s) => s.id === statusId)?.color || "bg-gray-100 text-gray-800";
}

export function getPriorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] || "bg-gray-100 text-gray-800";
}

export function getCategoryColor(category: string): string {
  switch (category) {
    case "todo": return "bg-gray-100 text-gray-800";
    case "in_progress": return "bg-blue-100 text-blue-800";
    case "done": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

export type WorkflowStatus = {
  id: string;
  name: string;
  category: string;
  color: string;
  sort_order: number;
  is_initial: boolean;
  /** B2-A: soft-retired statuses remain valid for existing tasks/history but
   *  must not appear as selectable destinations for new transitions. */
  retired: boolean;
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

/**
 * Returns the list of status destinations the current user may transition to.
 *
 * B2-A: retired statuses are excluded from the returned list (they must not
 *       be selectable for new transitions).
 *
 * Historical display helpers (getStatusColor, getStatusDisplay, etc.) do NOT
 * call this function — they operate on the full status list so retired statuses
 * continue to render correctly on existing tasks.
 *
 * @param statuses        - Full status list for the workflow template (all, incl. retired)
 * @param transitions     - All transitions for the workflow template
 * @param fromStatusId    - The task's current status_id
 */
export function getAllowedTransitions(
  statuses: WorkflowStatus[],
  transitions: WorkflowTransition[],
  fromStatusId: string | null
): WorkflowStatus[] {
  const eligibleTransitions = transitions.filter((t) => {
    if (t.from_status_id !== fromStatusId) return false;
    return true;
  });

  const allowedIds = eligibleTransitions.map((t) => t.to_status_id);

  // B2-A: filter out retired destination statuses
  return statuses.filter((s) => allowedIds.includes(s.id) && !s.retired);
}

/**
 * Returns the initial (default) status for new tasks.
 * B2-A: retired statuses are excluded — a retired initial status must not be
 * auto-assigned to new tasks.
 */
export function getInitialStatus(statuses: WorkflowStatus[]): WorkflowStatus | undefined {
  return (
    statuses.find((s) => s.is_initial && !s.retired) ||
    statuses.find((s) => !s.retired)
  );
}

export function getDoneStatusIds(statuses: WorkflowStatus[]): Set<string> {
  return new Set(statuses.filter((s) => s.category === "done").map((s) => s.id));
}

export function getInProgressStatuses(statuses: WorkflowStatus[]): WorkflowStatus[] {
  return statuses.filter((s) => s.category === "in_progress");
}

export function getStatusDisplay(
  workflowStatuses: WorkflowStatus[],
  statusId: string | null
): { name: string; color: string } {
  const s = workflowStatuses.find((ws) => ws.id === statusId);
  return {
    name: s?.name?.replace(/_/g, " ") || "No Status",
    color: s?.color || "bg-gray-100 text-gray-800",
  };
}

const KANBAN_DOT_FALLBACK = ["#B0B0B6", "#4C8DF5", "#E8B93B", "#1FAA59", "#E5687A", "#EB5A1E"];

/** Kanban columns: project workflow statuses except backlog and retired. */
export function getKanbanBoardStatuses(workflowStatuses: WorkflowStatus[]): WorkflowStatus[] {
  return [...(workflowStatuses || [])]
    .filter((s) => s.name?.toLowerCase() !== "backlog" && !s.retired)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/** All non-retired statuses (charts, filters), sorted. */
export function getDisplayWorkflowStatuses(workflowStatuses: WorkflowStatus[]): WorkflowStatus[] {
  return [...(workflowStatuses || [])]
    .filter((s) => !s.retired)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function workflowStatusDotColor(
  status: { color?: string | null },
  colIdx = 0
): string {
  const rawColor = status.color || "";
  const hexMatch = rawColor.match(/#[0-9A-Fa-f]{3,8}/);
  if (hexMatch?.[0]) return hexMatch[0];
  if (rawColor.includes("green")) return "#1FAA59";
  if (rawColor.includes("blue")) return "#4C8DF5";
  if (rawColor.includes("yellow") || rawColor.includes("amber")) return "#E8B93B";
  if (rawColor.includes("red")) return "#E5484D";
  return KANBAN_DOT_FALLBACK[colIdx % KANBAN_DOT_FALLBACK.length];
}

/** Client/admin kanban progress bar percentage from workflow category. */
export function taskKanbanProgressPercent(
  task: { completed_at?: string | null },
  status: WorkflowStatus | undefined
): number {
  if (task.completed_at || status?.category === "done") return 100;
  if (status?.category === "in_progress") return 50;
  return 0;
}

export async function changeTaskStatus(
  taskId: string,
  newStatusId: string,
  changedByType: "admin" | "system" | "auto" = "system"
) {
  const { error } = await supabase.rpc("change_task_status", {
    p_task_id: taskId,
    p_new_status_id: newStatusId,
    p_changed_by_type: changedByType,
  });
  if (error) throw error;
}

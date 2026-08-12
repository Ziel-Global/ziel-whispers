import { supabase } from "@/integrations/supabase/client";
import type { WorkflowStatus } from "@/lib/workflow";

export interface UnfinishedDependency {
  taskId: string;
  title: string;
}

export function isDependencyWarnTarget(
  category: string | undefined | null,
): boolean {
  return category === "done" || category === "in_progress";
}

export async function getUnfinishedDependencies(
  taskId: string,
  workflowStatuses: WorkflowStatus[],
): Promise<UnfinishedDependency[]> {
  const { data } = await supabase
    .from("task_dependencies")
    .select(
      "*, depends_on:tasks!task_dependencies_depends_on_task_id_fkey(id, title, status_id)",
    )
    .eq("task_id", taskId)
    .eq("dependency_type", "finish_to_start");
  if (!data || data.length === 0) return [];
  return data
    .filter((d: any) => {
      const depStatus = workflowStatuses.find(
        (s: any) => s.id === d.depends_on?.status_id,
      );
      return depStatus?.category !== "done";
    })
    .map((d: any) => ({ taskId: d.depends_on.id, title: d.depends_on.title }));
}

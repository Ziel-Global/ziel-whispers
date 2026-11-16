import { AdminKanbanPanel } from "@/components/project/AdminKanbanPanel";

export interface ProjectKanbanTabProps {
  tasks: any[];
  sprints: any[];
  phases?: any[];
  workflowStatuses: any[];
  isAdmin: boolean;
  isClient?: boolean;
  profileId?: string;
  setViewTaskData: (data: any) => void;
  PRIORITY_COLORS: Record<string, string>;
  setAddTaskOpen: (b: boolean) => void;
  kanbanSprintFilter: string;
  setKanbanSprintFilter: (s: string) => void;
  kanbanPriorityFilter: string;
  setKanbanPriorityFilter: (s: string) => void;
}

/** Shared Kanban for admin + employee — same columns (Backlog first). */
export function ProjectKanbanTab({
  tasks,
  sprints,
  phases = [],
  workflowStatuses,
  isAdmin,
  isClient = false,
  profileId,
  setViewTaskData,
  setAddTaskOpen,
}: ProjectKanbanTabProps) {
  const visibleTasks =
    !isAdmin && !isClient
      ? profileId
        ? (tasks || []).filter(
            (t: any) => t.assigned_to === profileId || t.created_by === profileId
          )
        : []
      : tasks;

  return (
    <AdminKanbanPanel
      tasks={visibleTasks}
      sprints={sprints}
      phases={phases}
      workflowStatuses={workflowStatuses}
      isAdmin={isAdmin}
      setViewTaskData={setViewTaskData}
      setAddTaskOpen={setAddTaskOpen}
      showFilters={true}
    />
  );
}

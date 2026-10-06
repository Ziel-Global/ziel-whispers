import { AdminKanbanPanel } from "@/components/project/AdminKanbanPanel";

export interface ProjectKanbanTabProps {
  tasks: any[];
  sprints: any[];
  phases?: any[];
  workflowStatuses: any[];
  isAdmin: boolean;
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
  setViewTaskData,
  setAddTaskOpen,
}: ProjectKanbanTabProps) {
  return (
    <AdminKanbanPanel
      tasks={tasks}
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

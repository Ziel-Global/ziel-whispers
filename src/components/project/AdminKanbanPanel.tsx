import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  AdminWorkFilters,
  DEFAULT_ADMIN_WORK_FILTERS,
  filterAdminWorkTasks,
  type AdminWorkFilterState,
} from "@/components/project/AdminWorkFilters";
import { KanbanTaskCard } from "@/components/project/KanbanTaskCard";

const DOT_FALLBACK = ["#B0B0B6", "#4C8DF5", "#E8B93B", "#1FAA59", "#E5687A", "#EB5A1E"];

type Props = {
  tasks: any[];
  sprints: any[];
  phases: any[];
  workflowStatuses: any[];
  isAdmin: boolean;
  setViewTaskData: (data: any) => void;
  setAddTaskOpen: (b: boolean) => void;
};

export function AdminKanbanPanel({
  tasks,
  sprints,
  phases,
  workflowStatuses,
  isAdmin,
  setViewTaskData,
  setAddTaskOpen,
}: Props) {
  const [filters, setFilters] = useState<AdminWorkFilterState>(DEFAULT_ADMIN_WORK_FILTERS);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    (tasks || []).forEach((t: any) => {
      if (t.assigned_to && t.users?.full_name) map.set(t.assigned_to, t.users.full_name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const filtered = useMemo(
    () => filterAdminWorkTasks(tasks, sprints, filters),
    [tasks, sprints, filters]
  );

  const columns = (workflowStatuses || []).filter(
    (s: any) => s.name?.toLowerCase() !== "backlog" && !s.retired
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
        <div className="text-[18px] font-bold text-[#17171A]">Kanban</div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAddTaskOpen(true)}
            className="inline-flex items-center gap-1.5 bg-[#EB5A1E] text-white font-semibold text-[13px] px-4 py-2.5 rounded-[10px] hover:bg-[#d64f18] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            Add Task
          </button>
        )}
      </div>

      <AdminWorkFilters
        filters={filters}
        onChange={setFilters}
        phases={phases}
        sprints={sprints}
        workflowStatuses={workflowStatuses}
        assigneeOptions={assigneeOptions}
      />

      <div className="overflow-x-auto pb-2">
        <div
          className="grid gap-4 min-w-[1560px]"
          style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, 300px)` }}
        >
          {columns.map((status: any, colIdx: number) => {
            const cards = filtered.filter((t: any) => t.status_id === status.id);
            const rawColor = status.color || "";
            const hexMatch = rawColor.match(/#[0-9A-Fa-f]{3,8}/);
            const dotColor =
              hexMatch?.[0] ||
              (rawColor.includes("green")
                ? "#1FAA59"
                : rawColor.includes("blue")
                  ? "#4C8DF5"
                  : rawColor.includes("yellow") || rawColor.includes("amber")
                    ? "#E8B93B"
                    : rawColor.includes("red")
                      ? "#E5484D"
                      : DOT_FALLBACK[colIdx % DOT_FALLBACK.length]);

            return (
              <div key={status.id} className="bg-[#F9F9F8] rounded-[14px] p-3.5 min-w-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-[7px] text-[13px] font-bold text-[#17171A] whitespace-nowrap">
                    <span
                      className="w-[7px] h-[7px] rounded-full shrink-0"
                      style={{ background: dotColor }}
                    />
                    {status.name.replace(/_/g, " ")}
                  </div>
                  <span className="bg-white border border-black/[0.08] rounded-full text-[11px] font-bold text-[#8B8B92] px-2 py-0.5 shrink-0">
                    {cards.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 max-h-[calc(100vh-360px)] overflow-y-auto">
                  {cards.length === 0 ? (
                    <p className="text-xs text-[#8B8B92] text-center py-8">No tasks</p>
                  ) : (
                    cards.map((t: any) => (
                      <KanbanTaskCard
                        key={t.id}
                        task={t}
                        sprints={sprints}
                        showProgressBar={status.category === "in_progress"}
                        onClick={() => setViewTaskData(t)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

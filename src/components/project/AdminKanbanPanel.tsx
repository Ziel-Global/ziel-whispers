import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import {
  AdminWorkFilters,
  DEFAULT_ADMIN_WORK_FILTERS,
  filterAdminWorkTasks,
  initialsFromName,
  avatarStyleFor,
  type AdminWorkFilterState,
} from "@/components/project/AdminWorkFilters";

const PRIORITY_PILL: Record<string, { bg: string; color: string }> = {
  high: { bg: "#FDECEC", color: "#E5484D" },
  medium: { bg: "#FDF3E3", color: "#A9720B" },
  low: { bg: "#F6F5F3", color: "#6B6B72" },
};

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
                    cards.map((t: any) => {
                      const assignee = t.users?.full_name as string | undefined;
                      const av = assignee ? avatarStyleFor(assignee) : null;
                      const sprint = t.sprint_id
                        ? (sprints || []).find((s: any) => s.id === t.sprint_id)
                        : null;
                      const pri = PRIORITY_PILL[t.priority] || PRIORITY_PILL.medium;
                      const showProgress = status.category === "in_progress";
                      const progress = t.completed_at ? 100 : showProgress ? 50 : 0;

                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setViewTaskData(t)}
                          className="bg-white border border-black/[0.07] rounded-[11px] p-3.5 text-left min-w-0 hover:border-[#EB5A1E]/40 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="text-[13.5px] font-bold text-[#17171A] truncate min-w-0">
                              {t.title}
                            </div>
                            <span
                              className="text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0 capitalize"
                              style={{ background: pri.bg, color: pri.color }}
                            >
                              {t.priority}
                            </span>
                          </div>
                          {sprint && (
                            <div className="mb-2.5">
                              <span className="bg-[#E6E9FF] text-[#4C57D9] text-[10.5px] font-bold px-2 py-0.5 rounded-xl">
                                {sprint.name}
                              </span>
                            </div>
                          )}
                          {t.description && (
                            <div className="text-xs text-[#8B8B92] leading-relaxed mb-2.5 line-clamp-3">
                              {t.description}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mb-2">
                            {assignee && av ? (
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0"
                                style={{ background: av.bg, color: av.color }}
                              >
                                {initialsFromName(assignee)}
                              </div>
                            ) : null}
                            <div className="text-xs text-[#4B4B52] truncate">
                              {assignee || "Unassigned"}
                            </div>
                          </div>
                          {showProgress && (
                            <>
                              <div className="flex items-center justify-between text-[11.5px] text-[#8B8B92] mb-1">
                                <span>Progress</span>
                                <span className="font-bold text-[#17171A]">{progress}%</span>
                              </div>
                              <div className="h-[5px] rounded bg-[#F3E9E3] overflow-hidden mb-2.5">
                                <div
                                  className="h-full rounded bg-[#1FAA59]"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </>
                          )}
                          <div className="flex items-center justify-between pt-[9px] border-t border-black/[0.06] text-[11.5px] text-[#8B8B92]">
                            <span>
                              {t.estimated_hours != null ? `${t.estimated_hours}h` : "—"}
                            </span>
                            <span>
                              Due{" "}
                              {t.due_date
                                ? format(new Date(t.due_date + "T00:00:00"), "MMM d")
                                : "—"}
                            </span>
                          </div>
                        </button>
                      );
                    })
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

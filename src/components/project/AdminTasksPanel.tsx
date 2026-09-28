import { useMemo, useState } from "react";
import { format } from "date-fns";
import { BarChart2, Circle, Flag, Info, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { truncateWords } from "@/lib/utils";
import { getStatusDisplay } from "@/lib/workflow";
import {
  AdminWorkFilters,
  DEFAULT_ADMIN_WORK_FILTERS,
  filterAdminWorkTasks,
  initialsFromName,
  avatarStyleFor,
  PRIORITY_TEXT,
  type AdminWorkFilterState,
} from "@/components/project/AdminWorkFilters";

type Props = {
  tasks: any[];
  sprints: any[];
  phases: any[];
  workflowStatuses: any[];
  setBulkTaskOpen: (b: boolean) => void;
  setAddTaskOpen: (b: boolean) => void;
  profile: any;
  selectedTaskIds: Set<string>;
  setSelectedTaskIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setBulkTaskDeleteOpen: (b: boolean) => void;
  criticalTaskIds: Set<string>;
  openEditTask: (t: any) => void;
  setDeleteTaskConfirmId: (id: string | null) => void;
  setViewTaskData: (data: any) => void;
  doneStatusIds: Set<string>;
};

export function AdminTasksPanel({
  tasks,
  sprints,
  phases,
  workflowStatuses,
  setBulkTaskOpen,
  setAddTaskOpen,
  profile,
  selectedTaskIds,
  setSelectedTaskIds,
  setBulkTaskDeleteOpen,
  criticalTaskIds,
  openEditTask,
  setDeleteTaskConfirmId,
  setViewTaskData,
  doneStatusIds,
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

  const filteredTasks = useMemo(
    () => filterAdminWorkTasks(tasks, sprints, filters),
    [tasks, sprints, filters]
  );

  const taskProgress = (t: any) => {
    if (t.completed_at || (t.status_id && doneStatusIds.has(t.status_id))) return 100;
    const st = (workflowStatuses || []).find((s: any) => s.id === t.status_id);
    if (st?.category === "in_progress") return 50;
    return 0;
  };

  const statusColorHex = (t: any) => {
    const st = (workflowStatuses || []).find((s: any) => s.id === t.status_id);
    if (st?.category === "done") return "#1B8A46";
    if (st?.category === "in_progress") return "#4C8DF5";
    return "#8B8B92";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
        <div className="text-[18px] font-bold text-[#17171A]">Tasks</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBulkTaskOpen(true)}
            className="inline-flex items-center gap-1.5 bg-white border border-black/[0.08] text-[#4B4B52] font-semibold text-[13px] px-4 py-2.5 rounded-[10px] hover:bg-[#F6F5F3] transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            Bulk Add
          </button>
          <button
            type="button"
            onClick={() => setAddTaskOpen(true)}
            className="inline-flex items-center gap-1.5 bg-[#EB5A1E] text-white font-semibold text-[13px] px-4 py-2.5 rounded-[10px] hover:bg-[#d64f18] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            Add Task
          </button>
        </div>
      </div>

      <AdminWorkFilters
        filters={filters}
        onChange={setFilters}
        phases={phases}
        sprints={sprints}
        workflowStatuses={workflowStatuses}
        assigneeOptions={assigneeOptions}
      />

      {selectedTaskIds.size > 0 && (
        <div className="flex items-center gap-3 bg-[#F6F5F3] rounded-[10px] px-4 py-2 mb-3">
          <span className="text-sm font-medium text-[#17171A]">{selectedTaskIds.size} selected</span>
          <button
            type="button"
            onClick={() => setBulkTaskDeleteOpen(true)}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#E5484D]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedTaskIds(new Set())}
            className="text-[13px] font-medium text-[#8B8B92]"
          >
            Clear
          </button>
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <p className="text-[13px] text-[#8B8B92] py-8 text-center">No tasks match these filters.</p>
      ) : (
        <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              <div
                className="grid gap-2.5 px-[22px] py-[13px] text-[11px] font-bold text-[#B0B0B6] tracking-[0.05em] border-b border-black/[0.06] bg-white sticky top-0 z-[1]"
                style={{
                  gridTemplateColumns: "28px 1.8fr .8fr .7fr .8fr 1.1fr .6fr .6fr .5fr .9fr",
                }}
              >
                <div>
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTaskIds(new Set(filteredTasks.map((t: any) => t.id)));
                      else setSelectedTaskIds(new Set());
                    }}
                  />
                </div>
                <div>TASK</div>
                <div className="text-center">ASSIGNED TO</div>
                <div>PRIORITY</div>
                <div>STATUS</div>
                <div>PROGRESS</div>
                <div>EST. HOURS</div>
                <div>DUE DATE</div>
                <div>FLAGGED</div>
                <div className="text-right">ACTIONS</div>
              </div>
              <div className="max-h-[min(520px,calc(100vh-360px))] overflow-y-auto overscroll-contain">
                {filteredTasks.map((t: any) => {
                  const assignee = (t as any).users?.full_name as string | undefined;
                  const av = assignee ? avatarStyleFor(assignee) : null;
                  const sprint = t.sprint_id
                    ? (sprints || []).find((s: any) => s.id === t.sprint_id)
                    : null;
                  const pct = taskProgress(t);
                  const pColor = PRIORITY_TEXT[t.priority] || "#6B6B72";
                  const sColor = statusColorHex(t);
                  const statusName = getStatusDisplay(workflowStatuses || [], t.status_id).name;

                  return (
                    <div
                      key={t.id}
                      className="grid gap-2.5 items-center px-[22px] py-[13px] border-b border-black/[0.05] last:border-b-0"
                      style={{
                        gridTemplateColumns: "28px 1.8fr .8fr .7fr .8fr 1.1fr .6fr .6fr .5fr .9fr",
                      }}
                    >
                <div>
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selectedTaskIds.has(t.id)}
                    onChange={(e) => {
                      const next = new Set(selectedTaskIds);
                      if (e.target.checked) next.add(t.id);
                      else next.delete(t.id);
                      setSelectedTaskIds(next);
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-[7px] min-w-0">
                    <span className="font-bold text-[13.5px] text-[#17171A] truncate">{t.title}</span>
                    {sprint && (
                      <span className="bg-[#E6E9FF] text-[#4C57D9] text-[10.5px] font-bold px-2 py-0.5 rounded-xl whitespace-nowrap shrink-0">
                        {sprint.name}
                      </span>
                    )}
                    {criticalTaskIds.has(t.id) && (
                      <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-xl whitespace-nowrap shrink-0">
                        Critical
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#8B8B92] truncate max-w-[260px]">
                    {truncateWords(t.description, 8) || "—"}
                  </div>
                </div>
                <div className="flex justify-center">
                  {assignee && av ? (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px]"
                      style={{ background: av.bg, color: av.color }}
                      title={assignee}
                    >
                      {initialsFromName(assignee)}
                    </div>
                  ) : (
                    <span className="text-[#B0B0B6] text-[13px]">—</span>
                  )}
                </div>
                <div
                  className="flex items-center gap-1.5 text-[12.5px] font-semibold capitalize"
                  style={{ color: pColor }}
                >
                  <BarChart2 className="h-[13px] w-[13px] shrink-0" strokeWidth={2} />
                  {t.priority || "—"}
                </div>
                <div
                  className="flex items-center gap-1.5 text-[12.5px] font-semibold capitalize"
                  style={{ color: sColor }}
                >
                  <Circle className="h-[13px] w-[13px] shrink-0" strokeWidth={2} />
                  {statusName}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded bg-[#F3E9E3] overflow-hidden max-w-[70px]">
                    <div className="h-full rounded bg-[#1FAA59]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-[#4B4B52] font-semibold shrink-0">{pct}%</span>
                </div>
                <div className="text-[13px] text-[#4B4B52]">
                  {t.estimated_hours != null ? `${t.estimated_hours}h` : "—"}
                </div>
                <div className="text-[13px] text-[#4B4B52]">
                  {t.due_date ? format(new Date(t.due_date + "T00:00:00"), "MMM d") : "—"}
                </div>
                <div className="text-[13px] text-[#B0B0B6]">
                  {t.is_flagged ? <Flag className="h-3.5 w-3.5 text-[#E5484D]" /> : "—"}
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setViewTaskData(t)}
                    className="w-[26px] h-[26px] rounded-[7px] bg-[#FDECE3] flex items-center justify-center"
                    title="View"
                  >
                    <Info className="h-3 w-3 text-[#EB5A1E]" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditTask(t)}
                    className="w-[26px] h-[26px] rounded-[7px] bg-[#FDECE3] flex items-center justify-center"
                    title="Edit"
                  >
                    <Pencil className="h-3 w-3 text-[#EB5A1E]" strokeWidth={2} />
                  </button>
                  {profile?.role === "admin" && (
                    <button
                      type="button"
                      onClick={() => setDeleteTaskConfirmId(t.id)}
                      className="w-[26px] h-[26px] rounded-[7px] bg-[#FDECEC] flex items-center justify-center"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3 text-[#E5484D]" strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

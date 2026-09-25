import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Flag,
  Info,
  List,
  Columns3,
  Search,
} from "lucide-react";
import { editButtonClass } from "@/components/ui/data-row";
import { truncateWords } from "@/lib/utils";
import { getStatusDisplay } from "@/lib/workflow";
import {
  bucketTaskState,
  TASK_STATE_BUCKETS,
  TASK_STATE_KANBAN_DOT,
  PRIORITY_PILL_CLASS,
  STATUS_PILL_CLASS,
  type TaskStateBucket,
} from "@/lib/clientTaskBuckets";
import { AdminTasksPanel } from "@/components/project/AdminTasksPanel";

export interface ProjectTasksTabProps {
  tasks: any[];
  sprints: any[];
  phases: any[];
  isAdmin: boolean;
  viewTaskData: any;
  setViewTaskData: (data: any) => void;
  PRIORITY_COLORS: Record<string, string>;
  taskStatusFilter: string;
  setTaskStatusFilter: (s: string) => void;
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
  isClient: boolean;
  doneStatusIds: Set<string>;
  statusColor: (id: string | null) => string;
}

function initials(name: string) {
  const parts = (name || "").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function ClientTasksPanel({
  tasks,
  sprints,
  workflowStatuses,
  setViewTaskData,
}: {
  tasks: any[];
  sprints: any[];
  workflowStatuses: any[];
  setViewTaskData: (data: any) => void;
}) {
  const [taskView, setTaskView] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");
  const [sprintFilter, setSprintFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStateBucket>("all");

  const sprintName = (sprintId: string | null | undefined) => {
    if (!sprintId) return null;
    return (sprints || []).find((s: any) => s.id === sprintId)?.name || null;
  };

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tasks || []).filter((t: any) => {
      const st = (workflowStatuses || []).find((s: any) => s.id === t.status_id);
      const bucket = bucketTaskState(st);
      if (statusFilter !== "all" && bucket !== statusFilter) return false;

      if (sprintFilter === "unassigned") {
        if (t.sprint_id) return false;
      } else if (sprintFilter !== "all") {
        if (t.sprint_id !== sprintFilter) return false;
      }

      if (q) {
        const assignee = ((t as any).users?.full_name || "").toLowerCase();
        const sprint = (sprintName(t.sprint_id) || "").toLowerCase();
        const title = (t.title || "").toLowerCase();
        if (!title.includes(q) && !assignee.includes(q) && !sprint.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, workflowStatuses, search, sprintFilter, statusFilter, sprints]);

  const sprintLabel =
    sprintFilter === "all"
      ? "All sprints"
      : sprintFilter === "unassigned"
        ? "Unassigned"
        : sprintName(sprintFilter) || "Sprint";

  const statusBadgeLabel = statusFilter === "all" ? "All statuses" : statusFilter;

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("");

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-3.5 flex-wrap">
        <h2 className="client-section-title mb-0">Tasks</h2>
        <div className="flex items-center border border-[#DEDEE1] rounded-[9px] p-0.5 bg-white">
          <button
            type="button"
            onClick={() => setTaskView("list")}
            className={`h-7 px-2.5 rounded-[7px] text-[9.8px] font-semibold inline-flex items-center gap-1.5 ${
              taskView === "list" ? "bg-[#17171A] text-white" : "bg-transparent text-[#7B7B82]"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
          <button
            type="button"
            onClick={() => setTaskView("kanban")}
            className={`h-7 px-2.5 rounded-[7px] text-[9.8px] font-semibold inline-flex items-center gap-1.5 ${
              taskView === "kanban" ? "bg-[#17171A] text-white" : "bg-transparent text-[#7B7B82]"
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Kanban
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-nowrap">
        <div className="h-[34px] flex-1 min-w-0 border border-[#DEDEE1] rounded-[9px] flex items-center gap-2 px-2.5 bg-white">
          <Search className="h-3.5 w-3.5 text-[#8B8B92] shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="border-0 outline-none w-full min-w-0 text-[10.5px] bg-transparent text-[#313136] placeholder:text-[#A0A0A6]"
          />
        </div>
        <Select value={sprintFilter} onValueChange={setSprintFilter}>
          <SelectTrigger className="h-[30px] w-[145px] shrink-0 rounded-lg border-[#DCDCE0] bg-white text-[10.5px] text-[#313136]">
            <SelectValue placeholder="All Sprints" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sprints</SelectItem>
            {(sprints || []).map((s: any) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as "all" | TaskStateBucket)}
        >
          <SelectTrigger className="h-[30px] w-[145px] shrink-0 rounded-lg border-[#DCDCE0] bg-white text-[10.5px] text-[#313136]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Unlinked">Unlinked</SelectItem>
            <SelectItem value="Development">Development</SelectItem>
            <SelectItem value="Returned">Returned</SelectItem>
            <SelectItem value="Complete">Complete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3 text-[9px] text-[#8B8B92]">
        <span>
          <strong className="text-[#4B4B52] font-semibold">{filteredTasks.length}</strong> visible task
          {filteredTasks.length === 1 ? "" : "s"}
        </span>
        <span>•</span>
        <span>{sprintLabel}</span>
        <span>•</span>
        <span>{taskView === "kanban" ? "Board view" : "List view"}</span>
      </div>

      {taskView === "list" ? (
        <div className="client-table-card flex flex-col max-h-[min(560px,calc(100vh-280px))] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3.5 py-3 border-b border-[#E9E9EC] shrink-0 bg-[#FCFCFD]">
            <div>
              <div className="text-[10.5px] font-semibold text-[#17171A]">Task list</div>
              <div className="text-[8.5px] text-[#8F8F96] mt-0.5">
                {filteredTasks.length} visible task{filteredTasks.length === 1 ? "" : "s"} · {sprintLabel}
              </div>
            </div>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[8.5px] font-semibold bg-[#F2F2F4] text-[#5D5D64]">
              {statusBadgeLabel}
            </span>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="px-5 py-[38px] text-center text-[9.5px] text-[#96969D]">
              No tasks match the current filters.
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {/* Mobile / tablet: stacked cards — no horizontal scroll */}
              <div className="lg:hidden divide-y divide-[#EFEFF1]">
                {filteredTasks.map((t: any) => {
                  const st = (workflowStatuses || []).find((s: any) => s.id === t.status_id);
                  const bucket = bucketTaskState(st);
                  const sprint = sprintName(t.sprint_id);
                  const assignee = (t as any).users?.full_name;
                  return (
                    <div key={t.id} className="p-3.5 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#F3F3F5] text-[#66666D] flex items-center justify-center flex-none mt-0.5">
                          <List className="h-[13px] w-[13px]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10.5px] font-semibold text-[#202024] leading-[1.45] break-words">
                            {t.title}
                          </div>
                          <div className="text-[8.3px] text-[#96969D] mt-0.5">
                            {sprint || "Not linked to a sprint"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewTaskData(t)}
                          className="w-[30px] h-[30px] rounded-lg border border-[#E2E2E6] bg-white text-[#56565D] inline-flex items-center justify-center hover:border-[#BFC0C6] hover:bg-[#F7F7F8] flex-none"
                          title="View task details"
                          aria-label="View task details"
                        >
                          <Info className="h-[13px] w-[13px]" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pl-9">
                        <div>
                          <div className="text-[8px] uppercase tracking-[0.05em] text-[#A0A0A6] mb-0.5">Assignee</div>
                          <div className="text-[9.5px] text-[#4C4C53]">
                            {assignee || <span className="text-[#A0A0A6]">Unassigned</span>}
                          </div>
                        </div>
                        <div>
                          <div className="text-[8px] uppercase tracking-[0.05em] text-[#A0A0A6] mb-0.5">Priority</div>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[8.5px] font-semibold capitalize ${
                              PRIORITY_PILL_CLASS[t.priority] || "bg-[#F0F0F2] text-[#55555B]"
                            }`}
                          >
                            {t.priority || "—"}
                          </span>
                        </div>
                        <div>
                          <div className="text-[8px] uppercase tracking-[0.05em] text-[#A0A0A6] mb-0.5">Status</div>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[8.5px] font-semibold ${STATUS_PILL_CLASS[bucket]}`}
                          >
                            {bucket}
                          </span>
                        </div>
                        <div>
                          <div className="text-[8px] uppercase tracking-[0.05em] text-[#A0A0A6] mb-0.5">Estimate</div>
                          <div className="text-[9.5px] text-[#4C4C53]">
                            {t.estimated_hours != null ? (
                              `${t.estimated_hours}h`
                            ) : (
                              <span className="text-[#A0A0A6]">Not estimated</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-[8px] uppercase tracking-[0.05em] text-[#A0A0A6] mb-0.5">Due date</div>
                          <div className="text-[9.5px] text-[#4C4C53]">
                            {t.due_date ? (
                              format(new Date(t.due_date + "T00:00:00"), "MMM d")
                            ) : (
                              <span className="text-[#A0A0A6]">No due date</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-[8px] uppercase tracking-[0.05em] text-[#A0A0A6] mb-0.5">Signal</div>
                          {t.is_flagged ? (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[8.5px] font-semibold bg-[#FDE9E9] text-[#B93F3F]">
                              Flagged
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[8.5px] font-semibold bg-[#F2F2F4] text-[#5D5D64]">
                              Normal
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden lg:block">
                <table className="w-full border-collapse table-fixed">
                  <thead className="sticky top-0 z-[1]">
                    <tr className="bg-[#F8F8FA] border-b border-[#E2E2E5]">
                      <th className="w-[28%] px-3 py-[11px] text-left text-[8px] font-bold uppercase tracking-[0.065em] text-[#777780]">
                        Task
                      </th>
                      <th className="w-[14%] px-3 py-[11px] text-left text-[8px] font-bold uppercase tracking-[0.065em] text-[#777780]">
                        Assignee
                      </th>
                      <th className="w-[10%] px-3 py-[11px] text-left text-[8px] font-bold uppercase tracking-[0.065em] text-[#777780]">
                        Priority
                      </th>
                      <th className="w-[12%] px-3 py-[11px] text-left text-[8px] font-bold uppercase tracking-[0.065em] text-[#777780]">
                        Status
                      </th>
                      <th className="w-[9%] px-3 py-[11px] text-left text-[8px] font-bold uppercase tracking-[0.065em] text-[#777780]">
                        Estimate
                      </th>
                      <th className="w-[9%] px-3 py-[11px] text-left text-[8px] font-bold uppercase tracking-[0.065em] text-[#777780]">
                        Due date
                      </th>
                      <th className="w-[10%] px-3 py-[11px] text-left text-[8px] font-bold uppercase tracking-[0.065em] text-[#777780]">
                        Signal
                      </th>
                      <th className="w-[8%] px-3 py-[11px] text-center text-[8px] font-bold uppercase tracking-[0.065em] text-[#777780]">
                        View
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((t: any) => {
                      const st = (workflowStatuses || []).find((s: any) => s.id === t.status_id);
                      const bucket = bucketTaskState(st);
                      const sprint = sprintName(t.sprint_id);
                      const assignee = (t as any).users?.full_name;
                      return (
                        <tr key={t.id} className="border-b border-[#EFEFF1] last:border-0 hover:bg-[#FAFAFB]">
                          <td className="px-3 py-[13px] align-middle">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-[#F3F3F5] text-[#66666D] flex items-center justify-center flex-none mt-0.5">
                                <List className="h-[13px] w-[13px]" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-[10.5px] font-semibold text-[#202024] leading-[1.45] break-words whitespace-normal">
                                  {t.title}
                                </div>
                                <div className="text-[8.3px] text-[#96969D] mt-0.5 truncate">
                                  {sprint || "Not linked to a sprint"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-[13px] align-middle text-[9.5px] text-[#4C4C53]">
                            {assignee ? (
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-[#EEF1F5] text-[#5E6470] text-[7px] font-bold flex items-center justify-center flex-none">
                                  {initials(assignee)}
                                </span>
                                <span className="truncate">{assignee}</span>
                              </div>
                            ) : (
                              <span className="text-[#A0A0A6]">Unassigned</span>
                            )}
                          </td>
                          <td className="px-3 py-[13px] align-middle">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[8.5px] font-semibold capitalize ${
                                PRIORITY_PILL_CLASS[t.priority] || "bg-[#F0F0F2] text-[#55555B]"
                              }`}
                            >
                              {t.priority || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-[13px] align-middle">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[8.5px] font-semibold ${STATUS_PILL_CLASS[bucket]}`}
                            >
                              {bucket}
                            </span>
                          </td>
                          <td className="px-3 py-[13px] align-middle text-[9.5px] text-[#4C4C53]">
                            {t.estimated_hours != null ? (
                              `${t.estimated_hours}h`
                            ) : (
                              <span className="text-[#A0A0A6]">Not estimated</span>
                            )}
                          </td>
                          <td className="px-3 py-[13px] align-middle text-[9.5px] text-[#4C4C53]">
                            {t.due_date ? (
                              format(new Date(t.due_date + "T00:00:00"), "MMM d")
                            ) : (
                              <span className="text-[#A0A0A6]">No due date</span>
                            )}
                          </td>
                          <td className="px-3 py-[13px] align-middle">
                            {t.is_flagged ? (
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[8.5px] font-semibold bg-[#FDE9E9] text-[#B93F3F]">
                                Flagged
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[8.5px] font-semibold bg-[#F2F2F4] text-[#5D5D64]">
                                Normal
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-[13px] align-middle text-center">
                            <button
                              type="button"
                              onClick={() => setViewTaskData(t)}
                              className="w-[30px] h-[30px] rounded-lg border border-[#E2E2E6] bg-white text-[#56565D] inline-flex items-center justify-center hover:border-[#BFC0C6] hover:bg-[#F7F7F8] mx-auto"
                              title="View task details"
                              aria-label="View task details"
                            >
                              <Info className="h-[13px] w-[13px]" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="h-[min(560px,calc(100vh-280px))] max-h-[min(560px,calc(100vh-280px))] overflow-hidden">
          <div className="grid grid-cols-4 gap-3.5 h-full min-h-0">
            {TASK_STATE_BUCKETS.map((col) => {
              const colTasks = filteredTasks.filter((t: any) => {
                const st = (workflowStatuses || []).find((s: any) => s.id === t.status_id);
                return bucketTaskState(st) === col;
              });
              return (
                <div
                  key={col}
                  className="bg-gradient-to-b from-[#FAFAFB] to-[#F6F6F7] border border-[#E9E9EC] rounded-[15px] p-3 flex flex-col h-full min-h-0 min-w-0"
                >
                  <div className="flex items-center justify-between mb-2.5 px-0.5 flex-none">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#17171A]">
                      <span
                        className="w-[7px] h-[7px] rounded-full flex-none"
                        style={{ background: TASK_STATE_KANBAN_DOT[col] }}
                      />
                      {col}
                    </div>
                    <span className="bg-white border border-[#E3E3E6] rounded-full px-1.5 py-0.5 text-[8.5px] text-[#77777E] font-semibold">
                      {colTasks.length}
                    </span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-2.5">
                    {colTasks.length === 0 ? (
                      <div className="h-[90px] border border-dashed border-[#DCDCE1] rounded-[9px] flex items-center justify-center text-center text-[9px] text-[#A1A1A7] px-3">
                        No tasks in this column
                      </div>
                    ) : (
                      colTasks.map((t: any) => {
                        const sprint = sprintName(t.sprint_id);
                        const assignee = (t as any).users?.full_name;
                        return (
                          <div
                            key={t.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setViewTaskData(t)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") setViewTaskData(t);
                            }}
                            className="bg-white border border-[#E4E4E7] rounded-[13px] p-3 cursor-pointer shadow-[0_5px_16px_rgba(20,20,24,0.035)] hover:border-[#E3C8BC] hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(20,20,24,0.075)] transition-all"
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1 text-[10.7px] font-semibold leading-[1.45] text-[#17171A] mb-2">
                                {t.title}
                              </div>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[8.5px] font-semibold capitalize flex-none ${
                                  PRIORITY_PILL_CLASS[t.priority] || "bg-[#F0F0F2] text-[#55555B]"
                                }`}
                              >
                                {t.priority || "—"}
                              </span>
                            </div>
                            {sprint && (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-[#DDEBFF] text-[#3873C9] text-[8px] font-semibold mt-1">
                                {sprint}
                              </span>
                            )}
                            <div className="flex items-center justify-between gap-2 mt-2 text-[8.5px] text-[#8B8B92]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {assignee ? (
                                  <>
                                    <span className="w-5 h-5 rounded-full bg-[#EEF1F5] text-[#5E6470] text-[7px] font-bold flex items-center justify-center flex-none">
                                      {initials(assignee)}
                                    </span>
                                    <span className="truncate">{assignee}</span>
                                  </>
                                ) : (
                                  <span>Unassigned</span>
                                )}
                              </div>
                              <span className="flex-none">
                                {t.due_date
                                  ? format(new Date(t.due_date + "T00:00:00"), "MMM d")
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectTasksTab({
  tasks,
  sprints,
  phases,
  isAdmin,
  viewTaskData,
  setViewTaskData,
  PRIORITY_COLORS,
  taskStatusFilter,
  setTaskStatusFilter,
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
  isClient,
  doneStatusIds,
  statusColor,
}: ProjectTasksTabProps) {
  return (
    <>
      {isAdmin ? (
        <AdminTasksPanel
          tasks={tasks}
          sprints={sprints}
          phases={phases}
          workflowStatuses={workflowStatuses}
          setBulkTaskOpen={setBulkTaskOpen}
          setAddTaskOpen={setAddTaskOpen}
          profile={profile}
          selectedTaskIds={selectedTaskIds}
          setSelectedTaskIds={setSelectedTaskIds}
          setBulkTaskDeleteOpen={setBulkTaskDeleteOpen}
          criticalTaskIds={criticalTaskIds}
          openEditTask={openEditTask}
          setDeleteTaskConfirmId={setDeleteTaskConfirmId}
          setViewTaskData={setViewTaskData}
          doneStatusIds={doneStatusIds}
        />
      ) : isClient ? (
        <ClientTasksPanel
          tasks={tasks}
          sprints={sprints}
          workflowStatuses={workflowStatuses}
          setViewTaskData={setViewTaskData}
        />
      ) : (
        <>
          <h2 className="text-lg font-semibold">My Tasks</h2>
          {(() => {
            const myTasks = (tasks || []).filter(
              (t: any) => t.assigned_to === profile?.id || t.created_by === profile?.id
            );
            if (myTasks.length === 0)
              return <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>;
            return (
              <TooltipProvider>
                <table className="w-full">
                  <thead>
                    <tr className="hidden md:table-row border-b border-[#e5e7eb] text-[11px] uppercase tracking-[0.05em] text-[#9ca3af] font-medium">
                      <th className="px-4 py-2 text-left">TASK</th>
                      <th className="px-4 py-2 text-left">STATUS</th>
                      <th className="px-4 py-2 text-left">EST. HOURS</th>
                      <th className="px-4 py-2 text-left">PRIORITY</th>
                      <th className="px-4 py-2 text-left">DUE DATE</th>
                      <th className="px-4 py-2 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myTasks.map((t: any) => (
                      <tr
                        key={t.id}
                        className="bg-white hover:bg-[#f1f5f9] border-b border-[#f3f4f6] transition-colors"
                      >
                        <td className="px-4 py-3 break-words">
                          <div className="flex items-center gap-2">
                            <div
                              className={
                                "font-semibold text-[15px] text-[#111827] break-words" +
                                (t.status_id && doneStatusIds.has(t.status_id)
                                  ? " line-through text-muted-foreground"
                                  : "")
                              }
                            >
                              {t.title}
                              {criticalTaskIds.has(t.id) && (
                                <Badge className="bg-purple-100 text-purple-800 text-[10px] ml-1.5">
                                  Critical Path
                                </Badge>
                              )}
                              {t.sprint_id &&
                                (() => {
                                  const s = sprints.find((sp: any) => sp.id === t.sprint_id);
                                  return s ? (
                                    <Badge className="bg-blue-100 text-blue-800 text-[10px] ml-1.5">
                                      {s.name}
                                    </Badge>
                                  ) : null;
                                })()}
                              {t.is_flagged && (
                                <Flag className="h-3.5 w-3.5 text-red-500 inline-block ml-1.5" />
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 break-words">
                          <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">
                            STATUS
                          </div>
                          <Badge className={statusColor(t.status_id) || ""}>
                            {getStatusDisplay(workflowStatuses || [], t.status_id).name}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 break-words">
                          <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">
                            EST. HOURS
                          </div>
                          <span className="text-[13px] text-[#374151]">
                            {t.estimated_hours ? `${t.estimated_hours}h` : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 break-words">
                          <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">
                            PRIORITY
                          </div>
                          <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                        </td>
                        <td className="px-4 py-3 break-words">
                          <div className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium md:hidden">
                            DUE DATE
                          </div>
                          <span className="text-[13px] text-[#374151]">
                            {t.due_date ? format(new Date(t.due_date + "T00:00:00"), "MMM d") : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 break-words text-right">
                          <button
                            onClick={() => setViewTaskData(t)}
                            className={editButtonClass}
                            title="View Details"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TooltipProvider>
            );
          })()}
        </>
      )}
    </>
  );
}

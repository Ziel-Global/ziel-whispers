import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ChevronRight,
  Flag,
  Info,
  List,
  Columns3,
  Search,
} from "lucide-react";
import { editButtonClass } from "@/components/ui/data-row";
import { cn, truncateWords } from "@/lib/utils";
import {
  getDisplayWorkflowStatuses,
  getStatusColor,
  getStatusDisplay,
} from "@/lib/workflow";
import { PRIORITY_PILL_CLASS } from "@/lib/clientTaskBuckets";
import { AdminTasksPanel } from "@/components/project/AdminTasksPanel";
import { AdminKanbanPanel } from "@/components/project/AdminKanbanPanel";

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
  setParentTaskOpen?: (b: boolean) => void;
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
  phases,
  workflowStatuses,
  setViewTaskData,
}: {
  tasks: any[];
  sprints: any[];
  phases: any[];
  workflowStatuses: any[];
  setViewTaskData: (data: any) => void;
}) {
  const [taskView, setTaskView] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");
  const [sprintFilter, setSprintFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());

  const displayStatuses = useMemo(
    () => getDisplayWorkflowStatuses(workflowStatuses || []),
    [workflowStatuses]
  );

  const sprintName = (sprintId: string | null | undefined) => {
    if (!sprintId) return null;
    return (sprints || []).find((s: any) => s.id === sprintId)?.name || null;
  };

  const matchesFilters = (t: any) => {
    if (statusFilter !== "all" && t.status_id !== statusFilter) return false;

    if (sprintFilter === "unassigned") {
      if (t.sprint_id) return false;
    } else if (sprintFilter !== "all") {
      if (t.sprint_id !== sprintFilter) return false;
    }

    const q = search.trim().toLowerCase();
    if (q) {
      const assignee = ((t as any).users?.full_name || "").toLowerCase();
      const sprint = (sprintName(t.sprint_id) || "").toLowerCase();
      const title = (t.title || "").toLowerCase();
      if (!title.includes(q) && !assignee.includes(q) && !sprint.includes(q)) return false;
    }
    return true;
  };

  const childrenByParent = useMemo(() => {
    const map = new Map<string, any[]>();
    (tasks || []).forEach((t: any) => {
      if (!t.parent_id) return;
      const list = map.get(t.parent_id) || [];
      list.push(t);
      map.set(t.parent_id, list);
    });
    return map;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return (tasks || []).filter(matchesFilters);
  }, [tasks, workflowStatuses, search, sprintFilter, statusFilter, sprints]);

  const filteredIds = useMemo(() => new Set(filteredTasks.map((t: any) => t.id)), [filteredTasks]);

  const topLevelRows = useMemo(() => {
    return (tasks || []).filter((t: any) => {
      if (t.parent_id) return false;
      if (filteredIds.has(t.id)) return true;
      const kids = childrenByParent.get(t.id) || [];
      return kids.some((c) => filteredIds.has(c.id));
    });
  }, [tasks, filteredIds, childrenByParent]);

  // Auto-expand parents when search/filter matches a visible subtask
  useEffect(() => {
    const hasActiveFilter =
      search.trim() !== "" || sprintFilter !== "all" || statusFilter !== "all";
    if (!hasActiveFilter) return;
    setExpandedParentIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      childrenByParent.forEach((kids, parentId) => {
        if (kids.some((c) => filteredIds.has(c.id)) && !next.has(parentId)) {
          next.add(parentId);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [search, sprintFilter, statusFilter, filteredIds, childrenByParent]);

  const listRows = useMemo(() => {
    const rows: { task: any; kind: "parent" | "subtask" | "standalone"; childCount: number }[] = [];
    for (const parent of topLevelRows) {
      const allKids = childrenByParent.get(parent.id) || [];
      const matchingKids = allKids.filter((c) => filteredIds.has(c.id));
      const kidsToShow = matchingKids.length > 0 ? matchingKids : allKids;
      if (allKids.length === 0) {
        rows.push({ task: parent, kind: "standalone", childCount: 0 });
        continue;
      }
      rows.push({ task: parent, kind: "parent", childCount: allKids.length });
      if (!expandedParentIds.has(parent.id)) continue;
      for (const child of kidsToShow) {
        rows.push({ task: child, kind: "subtask", childCount: 0 });
      }
    }
    return rows;
  }, [topLevelRows, childrenByParent, expandedParentIds, filteredIds]);

  const toggleExpand = (parentId: string) => {
    setExpandedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const sprintLabel =
    sprintFilter === "all"
      ? "All sprints"
      : sprintFilter === "unassigned"
        ? "Unassigned"
        : sprintName(sprintFilter) || "Sprint";

  const statusBadgeLabel =
    statusFilter === "all"
      ? "All statuses"
      : getStatusDisplay(workflowStatuses || [], statusFilter).name;

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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-[30px] w-[145px] shrink-0 rounded-lg border-[#DCDCE0] bg-white text-[10.5px] text-[#313136]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {displayStatuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3 text-[9px] text-[#8B8B92]">
        <span>
          <strong className="text-[#4B4B52] font-semibold">{listRows.length}</strong> visible task
          {listRows.length === 1 ? "" : "s"}
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
                {listRows.length} visible task{listRows.length === 1 ? "" : "s"} · {sprintLabel}
              </div>
            </div>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[8.5px] font-semibold bg-[#F2F2F4] text-[#5D5D64]">
              {statusBadgeLabel}
            </span>
          </div>

          {listRows.length === 0 ? (
            <div className="px-5 py-[38px] text-center text-[9.5px] text-[#96969D]">
              No tasks match the current filters.
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {/* Mobile / tablet: stacked cards — no horizontal scroll */}
              <div className="lg:hidden divide-y divide-[#EFEFF1]">
                {listRows.map(({ task: t, kind, childCount }) => {
                  const statusDisplay = getStatusDisplay(workflowStatuses || [], t.status_id);
                  const sprint = sprintName(t.sprint_id);
                  const assignee = (t as any).users?.full_name;
                  const expanded = expandedParentIds.has(t.id);
                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "p-3.5 space-y-3",
                        kind === "parent" && "bg-primary/10",
                        kind === "subtask" && "bg-muted pl-8"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {kind === "parent" ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand(t.id)}
                            className="w-7 h-7 rounded-lg bg-white border border-[#E2E2E6] text-[#66666D] flex items-center justify-center flex-none mt-0.5"
                            aria-expanded={expanded}
                            aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
                          >
                            <ChevronRight
                              className={cn(
                                "h-[13px] w-[13px] transition-transform duration-150",
                                expanded && "rotate-90"
                              )}
                            />
                          </button>
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-[#F3F3F5] text-[#66666D] flex items-center justify-center flex-none mt-0.5">
                            <List className="h-[13px] w-[13px]" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[10.5px] font-semibold text-[#202024] leading-[1.45] break-words">
                            {t.title}
                            {kind === "parent" ? (
                              <>
                                <span className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold bg-primary/20 text-primary">
                                  Parent
                                </span>
                                <span className="ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold bg-[#F0F0F2] text-[#55555B] border border-[#E2E2E6]">
                                  {childCount} {childCount === 1 ? "subtask" : "subtasks"}
                                </span>
                              </>
                            ) : null}
                            {kind === "subtask" ? (
                              <span className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold bg-[#F0F0F2] text-[#55555B]">
                                Sub
                              </span>
                            ) : null}
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
                            {kind === "parent" ? (
                              <span className="text-[#A0A0A6]">—</span>
                            ) : assignee ? (
                              assignee
                            ) : (
                              <span className="text-[#A0A0A6]">Unassigned</span>
                            )}
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
                          <Badge className={`text-[8.5px] font-semibold ${getStatusColor(workflowStatuses || [], t.status_id)}`}>
                            {statusDisplay.name}
                          </Badge>
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
                    {listRows.map(({ task: t, kind, childCount }) => {
                      const statusDisplay = getStatusDisplay(workflowStatuses || [], t.status_id);
                      const sprint = sprintName(t.sprint_id);
                      const assignee = (t as any).users?.full_name;
                      const expanded = expandedParentIds.has(t.id);
                      return (
                        <tr
                          key={t.id}
                          className={cn(
                            "border-b border-[#EFEFF1] last:border-0 hover:bg-[#FAFAFB]",
                            kind === "parent" && "bg-primary/10 hover:bg-primary/15",
                            kind === "subtask" && "bg-muted/80"
                          )}
                        >
                          <td className="px-3 py-[13px] align-middle">
                            <div
                              className={cn(
                                "flex items-start gap-2.5 min-w-0",
                                kind === "subtask" && "pl-6"
                              )}
                            >
                              {kind === "parent" ? (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(t.id)}
                                  className="w-7 h-7 rounded-lg bg-white border border-[#E2E2E6] text-[#66666D] flex items-center justify-center flex-none mt-0.5"
                                  aria-expanded={expanded}
                                  aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
                                >
                                  <ChevronRight
                                    className={cn(
                                      "h-[13px] w-[13px] transition-transform duration-150",
                                      expanded && "rotate-90"
                                    )}
                                  />
                                </button>
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-[#F3F3F5] text-[#66666D] flex items-center justify-center flex-none mt-0.5">
                                  <List className="h-[13px] w-[13px]" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-[10.5px] font-semibold text-[#202024] leading-[1.45] break-words whitespace-normal">
                                  {t.title}
                                  {kind === "parent" ? (
                                    <>
                                      <span className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold bg-primary/20 text-primary">
                                        Parent
                                      </span>
                                      <span className="ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold bg-[#F0F0F2] text-[#55555B] border border-[#E2E2E6]">
                                        {childCount} {childCount === 1 ? "subtask" : "subtasks"}
                                      </span>
                                    </>
                                  ) : null}
                                  {kind === "subtask" ? (
                                    <span className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold bg-[#F0F0F2] text-[#55555B]">
                                      Sub
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-[8.3px] text-[#96969D] mt-0.5 truncate">
                                  {sprint || "Not linked to a sprint"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-[13px] align-middle text-[9.5px] text-[#4C4C53]">
                            {kind === "parent" ? (
                              <span className="text-[#A0A0A6]">—</span>
                            ) : assignee ? (
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
                            <Badge className={`text-[8.5px] font-semibold ${getStatusColor(workflowStatuses || [], t.status_id)}`}>
                              {statusDisplay.name}
                            </Badge>
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
        <AdminKanbanPanel
          tasks={filteredTasks}
          sprints={sprints}
          phases={phases}
          workflowStatuses={workflowStatuses}
          isAdmin={false}
          setViewTaskData={setViewTaskData}
          showFilters={false}
          title="Kanban"
        />
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
  setParentTaskOpen,
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
          setParentTaskOpen={setParentTaskOpen}
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
          phases={phases}
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
                              {t.parent_id && (
                                <Badge variant="outline" className="text-[10px] ml-1.5">
                                  Subtask
                                </Badge>
                              )}
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

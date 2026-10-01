import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { BarChart2, ChevronRight, Circle, Flag, Info, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { cn, truncateWords } from "@/lib/utils";
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
  setParentTaskOpen?: (b: boolean) => void;
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

const GRID_COLS = "28px 1.8fr .8fr .7fr .8fr 1.1fr .6fr .6fr .5fr .9fr";

function filtersAreActive(filters: AdminWorkFilterState) {
  return (
    filters.search.trim() !== DEFAULT_ADMIN_WORK_FILTERS.search ||
    filters.phaseId !== DEFAULT_ADMIN_WORK_FILTERS.phaseId ||
    filters.sprintId !== DEFAULT_ADMIN_WORK_FILTERS.sprintId ||
    filters.assigneeId !== DEFAULT_ADMIN_WORK_FILTERS.assigneeId ||
    filters.statusId !== DEFAULT_ADMIN_WORK_FILTERS.statusId ||
    filters.due !== DEFAULT_ADMIN_WORK_FILTERS.due
  );
}

export function AdminTasksPanel({
  tasks,
  sprints,
  phases,
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
  setViewTaskData,
  doneStatusIds,
}: Props) {
  const [filters, setFilters] = useState<AdminWorkFilterState>(DEFAULT_ADMIN_WORK_FILTERS);
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());

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

  const filteredIds = useMemo(() => new Set(filteredTasks.map((t: any) => t.id)), [filteredTasks]);

  /** Top-level rows: parent_id null, and parent or any child matches filters */
  const topLevelRows = useMemo(() => {
    return (tasks || []).filter((t: any) => {
      if (t.parent_id) return false;
      if (filteredIds.has(t.id)) return true;
      const kids = childrenByParent.get(t.id) || [];
      return kids.some((c) => filteredIds.has(c.id));
    });
  }, [tasks, filteredIds, childrenByParent]);

  // Auto-expand parents when an active filter matches a subtask
  useEffect(() => {
    if (!filtersAreActive(filters)) return;
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
  }, [filters, filteredIds, childrenByParent]);

  const visibleIds = useMemo(() => {
    const ids: string[] = [];
    for (const parent of topLevelRows) {
      ids.push(parent.id);
      const allKids = childrenByParent.get(parent.id) || [];
      if (allKids.length === 0 || !expandedParentIds.has(parent.id)) continue;
      const matchingKids = allKids.filter((c) => filteredIds.has(c.id));
      const kidsToShow = matchingKids.length > 0 ? matchingKids : allKids;
      for (const child of kidsToShow) ids.push(child.id);
    }
    return ids;
  }, [topLevelRows, childrenByParent, expandedParentIds, filteredIds]);

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

  const toggleExpand = (parentId: string) => {
    setExpandedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const toggleTaskSelected = (taskId: string, checked: boolean, includeChildren = false) => {
    const next = new Set(selectedTaskIds);
    const ids = [taskId];
    if (includeChildren) {
      for (const child of childrenByParent.get(taskId) || []) ids.push(child.id);
    }
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    setSelectedTaskIds(next);
  };

  const renderRow = (opts: {
    t: any;
    kind: "parent" | "subtask" | "standalone";
    childCount?: number;
    isLastSubtask?: boolean;
    expanded?: boolean;
    showBottomDivider?: boolean;
  }) => {
    const {
      t,
      kind,
      childCount = 0,
      isLastSubtask = false,
      expanded = false,
      showBottomDivider = true,
    } = opts;
    const assignee = (t as any).users?.full_name as string | undefined;
    const av = assignee ? avatarStyleFor(assignee) : null;
    const sprint = t.sprint_id ? (sprints || []).find((s: any) => s.id === t.sprint_id) : null;
    const pct = taskProgress(t);
    const pColor = PRIORITY_TEXT[t.priority] || "#6B6B72";
    const sColor = statusColorHex(t);
    const statusName = getStatusDisplay(workflowStatuses || [], t.status_id).name;
    const isParent = kind === "parent";
    const isSubtask = kind === "subtask";

    return (
      <div
        key={t.id}
        role={undefined}
        tabIndex={undefined}
        onClick={
          isParent
            ? (e) => {
                const target = e.target as HTMLElement;
                if (target.closest("button, input, a, [data-no-toggle]")) return;
                toggleExpand(t.id);
              }
            : undefined
        }
        onKeyDown={undefined}
        className={cn(
          "relative grid gap-2.5 items-center py-[13px] pr-[22px]",
          isParent && "bg-primary/10 cursor-pointer pl-[22px]",
          isSubtask && "bg-muted pl-[22px]",
          kind === "standalone" && "px-[22px] border-b border-border/60 last:border-b-0",
          (isParent || isSubtask) && showBottomDivider && "border-b border-border/50"
        )}
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        {/* Continuous group accent bar */}
        {(isParent || isSubtask) && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary pointer-events-none" aria-hidden />
        )}

        {/* Tree connectors for subtasks — end under the chevron/checkbox column */}
        {isSubtask && (
          <>
            <div
              className={cn(
                "absolute w-px bg-border pointer-events-none",
                isLastSubtask ? "top-0 h-1/2" : "top-0 bottom-0"
              )}
              style={{ left: 42 }}
              aria-hidden
            />
            <div
              className="absolute h-px w-[14px] bg-border pointer-events-none"
              style={{ left: 42, top: "50%" }}
              aria-hidden
            />
          </>
        )}

        {isSubtask ? (
          <div aria-hidden />
        ) : (
          <div data-no-toggle onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              className="rounded"
              checked={selectedTaskIds.has(t.id)}
              onChange={(e) => toggleTaskSelected(t.id, e.target.checked, isParent)}
            />
          </div>
        )}

        <div className="min-w-0 relative">
          <div className="flex items-center gap-[7px] min-w-0">
            {isParent ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(t.id);
                }}
                className="w-4 h-4 shrink-0 inline-flex items-center justify-center rounded bg-white border border-black/[0.08] text-muted-foreground hover:bg-white"
                aria-expanded={expanded}
                aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
              >
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform duration-150",
                    expanded && "rotate-90"
                  )}
                />
              </button>
            ) : isSubtask ? (
              <div
                data-no-toggle
                className="w-4 h-4 shrink-0 inline-flex items-center justify-center translate-y-[7px]"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  className="rounded"
                  checked={selectedTaskIds.has(t.id)}
                  onChange={(e) => toggleTaskSelected(t.id, e.target.checked)}
                />
              </div>
            ) : (
              <span className="w-4 shrink-0" aria-hidden />
            )}
            <span
              className={cn(
                "text-[14px] text-foreground truncate",
                isParent ? "font-medium" : "font-normal"
              )}
            >
              {t.title}
            </span>
            {isParent && (
              <>
                <span className="text-[11px] leading-none px-[7px] py-px rounded-[6px] whitespace-nowrap shrink-0 bg-primary/20 text-primary">
                  Parent
                </span>
                <span className="text-[11px] leading-none px-[7px] py-px rounded-[6px] whitespace-nowrap shrink-0 bg-muted text-muted-foreground border border-border">
                  {childCount} {childCount === 1 ? "subtask" : "subtasks"}
                </span>
              </>
            )}
            {isSubtask && (
              <span className="text-[11px] leading-none px-[7px] py-px rounded-[6px] whitespace-nowrap shrink-0 bg-muted text-muted-foreground border border-border">
                Sub
              </span>
            )}
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
          <div className="text-xs text-muted-foreground truncate max-w-[260px] ml-4">
            {truncateWords(t.description, 8) || "—"}
          </div>
        </div>

        <div className="flex justify-center">
          {isParent ? (
            <span className="text-muted-foreground text-[13px]">—</span>
          ) : assignee && av ? (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px]"
              style={{ background: av.bg, color: av.color }}
              title={assignee}
            >
              {initialsFromName(assignee)}
            </div>
          ) : (
            <span className="text-muted-foreground text-[13px]">—</span>
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
        <div className="text-[13px] text-muted-foreground">
          {t.is_flagged ? <Flag className="h-3.5 w-3.5 text-[#E5484D]" /> : "—"}
        </div>
        <div
          className="flex items-center justify-end gap-1.5"
          data-no-toggle
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setViewTaskData(t)}
            className={cn(
              "w-[26px] h-[26px] rounded-[7px] flex items-center justify-center",
              isParent ? "bg-white border border-black/[0.08]" : "bg-[#FDECE3]"
            )}
            title="View"
          >
            <Info className="h-3 w-3 text-[#EB5A1E]" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => openEditTask(t)}
            className={cn(
              "w-[26px] h-[26px] rounded-[7px] flex items-center justify-center",
              isParent ? "bg-white border border-black/[0.08]" : "bg-[#FDECE3]"
            )}
            title="Edit"
          >
            <Pencil className="h-3 w-3 text-[#EB5A1E]" strokeWidth={2} />
          </button>
          {profile?.role === "admin" && (
            <button
              type="button"
              onClick={() => setDeleteTaskConfirmId(t.id)}
              className={cn(
                "w-[26px] h-[26px] rounded-[7px] flex items-center justify-center",
                isParent ? "bg-white border border-black/[0.08]" : "bg-[#FDECEC]"
              )}
              title="Delete"
            >
              <Trash2 className="h-3 w-3 text-[#E5484D]" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    );
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
            onClick={() => setParentTaskOpen?.(true)}
            className="inline-flex items-center gap-1.5 bg-white border border-black/[0.08] text-[#4B4B52] font-semibold text-[13px] px-4 py-2.5 rounded-[10px] hover:bg-[#F6F5F3] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Parent Task
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

      {topLevelRows.length === 0 ? (
        <p className="text-[13px] text-[#8B8B92] py-8 text-center">No tasks match these filters.</p>
      ) : (
        <div className="bg-card border border-border rounded-[14px] overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              <div
                className="grid gap-2.5 px-[22px] py-[13px] text-[11px] font-bold text-muted-foreground tracking-[0.05em] border-b border-border bg-card sticky top-0 z-[1]"
                style={{ gridTemplateColumns: GRID_COLS }}
              >
                <div>
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={visibleIds.length > 0 && visibleIds.every((id) => selectedTaskIds.has(id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTaskIds(new Set(visibleIds));
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
              <div className="max-h-[calc(6*4rem)] overflow-y-auto overscroll-contain">
                {topLevelRows.map((parent) => {
                  const allKids = childrenByParent.get(parent.id) || [];
                  const hasChildren = allKids.length > 0;
                  const expanded = expandedParentIds.has(parent.id);
                  const matchingKids = allKids.filter((c) => filteredIds.has(c.id));
                  const kidsToShow =
                    matchingKids.length > 0 ? matchingKids : allKids;

                  if (!hasChildren) {
                    return renderRow({ t: parent, kind: "standalone" });
                  }

                  return (
                    <div
                      key={parent.id}
                      className="border-b-[1.5px] border-border last:border-b-0"
                    >
                      {renderRow({
                        t: parent,
                        kind: "parent",
                        childCount: allKids.length,
                        expanded,
                        showBottomDivider: expanded,
                      })}
                      {expanded &&
                        kidsToShow.map((child, idx) =>
                          renderRow({
                            t: child,
                            kind: "subtask",
                            isLastSubtask: idx === kidsToShow.length - 1,
                            showBottomDivider: idx < kidsToShow.length - 1,
                          })
                        )}
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

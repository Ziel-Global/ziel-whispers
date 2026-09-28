import React from "react";
import { format } from "date-fns";
import { Calendar, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DataRow,
  RowPrimary,
  RowSecondary,
  RowDataItem,
  RowBadgeItem,
  TableHeader,
} from "@/components/ui/data-row";
import { Badge } from "@/components/ui/badge";

export interface ProjectSprintsTabProps {
  tasks: any[];
  sprints: any[];
  phases: any[];
  isAdmin: boolean;
  setAddSprintOpen: (b: boolean) => void;
  sprintTaskCount: Record<string, number>;
  sprintProgress: Record<string, number>;
  openEditSprint: (sprint: any) => void;
  deleteSprint: (id: string) => void;
  openSprintTasks: (sprint: any) => void;
}

const SPRINT_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  planned: { bg: "#F6F5F3", color: "#6B6B72", label: "planned" },
  active: { bg: "#FDECE3", color: "#EB5A1E", label: "active" },
  completed: { bg: "#DFF6E4", color: "#1B8A46", label: "done" },
  done: { bg: "#DFF6E4", color: "#1B8A46", label: "done" },
};

function statusStyle(status?: string) {
  return SPRINT_STATUS[status || ""] || SPRINT_STATUS.planned;
}

function SprintCard({
  sprint,
  taskCount,
  progress,
  onOpen,
  onEdit,
  onDelete,
  showActions,
}: {
  sprint: any;
  taskCount: number;
  progress: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showActions: boolean;
}) {
  const st = statusStyle(sprint.status);
  const pct = Math.round(progress || 0);
  const dateLabel =
    sprint.start_date && sprint.end_date
      ? `${format(new Date(sprint.start_date + "T00:00:00"), "MMM d")} – ${format(new Date(sprint.end_date + "T00:00:00"), "MMM d")}`
      : "Dates TBD";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] text-left min-w-0 hover:border-[#EB5A1E]/35 transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="text-[15px] font-bold text-[#17171A] truncate min-w-0">{sprint.name}</div>
        <span
          className="text-[11px] font-bold px-[9px] py-[3px] rounded-full whitespace-nowrap shrink-0 capitalize"
          style={{ background: st.bg, color: st.color }}
        >
          {st.label}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[12.5px] text-[#8B8B92] mb-3.5">
        <Calendar className="h-[13px] w-[13px] shrink-0" strokeWidth={1.8} />
        {dateLabel}
      </div>
      <div className="h-1.5 rounded bg-[#F3E9E3] overflow-hidden mb-2">
        <div
          className="h-full rounded bg-[#EB5A1E] transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-[#4B4B52] font-semibold">
          {taskCount} task{taskCount === 1 ? "" : "s"}
        </div>
        {showActions && (
          <div className="flex items-center gap-1.5">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onEdit();
                }
              }}
              className="w-[26px] h-[26px] rounded-lg bg-[#FDECE3] flex items-center justify-center"
              title="Edit Sprint"
            >
              <Pencil className="h-3 w-3 text-[#EB5A1E]" strokeWidth={2} />
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onDelete();
                }
              }}
              className="w-[26px] h-[26px] rounded-lg bg-[#FDECEC] flex items-center justify-center"
              title="Delete Sprint"
            >
              <Trash2 className="h-3 w-3 text-[#E5484D]" strokeWidth={2} />
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

export function ProjectSprintsTab({
  sprints,
  phases,
  isAdmin,
  setAddSprintOpen,
  sprintTaskCount,
  sprintProgress,
  openEditSprint,
  deleteSprint,
  openSprintTasks,
}: ProjectSprintsTabProps) {
  if (isAdmin) {
    const phaseGroups = (phases || []).filter((p: any) =>
      sprints.some((s: any) => s.phase_id === p.id)
    );
    const unassigned = sprints.filter((s: any) => !s.phase_id);

    return (
      <div>
        <div className="flex items-center justify-between mb-[18px] flex-wrap gap-2.5">
          <div className="text-[18px] font-bold text-[#17171A]">Sprints</div>
          <button
            type="button"
            onClick={() => setAddSprintOpen(true)}
            className="inline-flex items-center gap-[7px] bg-[#EB5A1E] text-white font-semibold text-[13px] px-4 py-[9px] rounded-[10px] hover:bg-[#d64f18] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            Add Sprint
          </button>
        </div>

        {sprints.length === 0 ? (
          <p className="text-[13px] text-[#8B8B92] py-8 text-center">No sprints yet.</p>
        ) : (
          <div className="space-y-[26px]">
            {phaseGroups.map((phase: any) => {
              const phaseSprints = sprints.filter((s: any) => s.phase_id === phase.id);
              return (
                <div key={phase.id}>
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <div className="text-[14.5px] font-bold text-[#17171A]">{phase.title}</div>
                    <span className="bg-[#F6F5F3] text-[#4B4B52] text-[11px] font-bold px-[9px] py-[3px] rounded-full">
                      {phaseSprints.length} sprint{phaseSprints.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                    {phaseSprints.map((s: any) => (
                      <SprintCard
                        key={s.id}
                        sprint={s}
                        taskCount={sprintTaskCount[s.id] || 0}
                        progress={sprintProgress[s.id] || 0}
                        onOpen={() => openSprintTasks(s)}
                        onEdit={() => openEditSprint(s)}
                        onDelete={() => deleteSprint(s.id)}
                        showActions
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {unassigned.length > 0 && (
              <div>
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="text-[14.5px] font-bold text-[#17171A]">Unassigned</div>
                  <span className="bg-[#F6F5F3] text-[#4B4B52] text-[11px] font-bold px-[9px] py-[3px] rounded-full">
                    {unassigned.length} sprint{unassigned.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                  {unassigned.map((s: any) => (
                    <SprintCard
                      key={s.id}
                      sprint={s}
                      taskCount={sprintTaskCount[s.id] || 0}
                      progress={sprintProgress[s.id] || 0}
                      onOpen={() => openSprintTasks(s)}
                      onEdit={() => openEditSprint(s)}
                      onDelete={() => deleteSprint(s.id)}
                      showActions
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Sprints</h3>
      </div>
      {sprints.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sprints yet.</p>
      ) : (
        <div>
          <TableHeader gridCols="1fr 112px 96px 96px 80px 80px">
            <span>SPRINT</span>
            <span>DATES</span>
            <span>STATUS</span>
            <span>TASKS</span>
            <span>PROGRESS</span>
          </TableHeader>
          {sprints.map((s: any) => (
            <DataRow key={s.id} onClick={() => openSprintTasks(s)} gridCols="1fr 112px 96px 96px 80px 80px">
              <div>
                <RowPrimary className="whitespace-normal break-words">{s.name}</RowPrimary>
                <RowSecondary>{sprintTaskCount[s.id] || 0} tasks</RowSecondary>
              </div>
              <RowDataItem label="DATES">
                {format(new Date(s.start_date + "T00:00:00"), "MMM d")} –{" "}
                {format(new Date(s.end_date + "T00:00:00"), "MMM d")}
              </RowDataItem>
              <RowBadgeItem label="STATUS">
                <Badge
                  className={
                    s.status === "active"
                      ? "bg-green-100 text-green-800"
                      : s.status === "completed"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                  }
                >
                  {s.status}
                </Badge>
              </RowBadgeItem>
              <RowDataItem label="TASKS">{sprintTaskCount[s.id] || 0}</RowDataItem>
              <RowDataItem label="PROGRESS">
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${sprintProgress[s.id]}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[#6b7280]">{sprintProgress[s.id]}%</span>
                </div>
              </RowDataItem>
            </DataRow>
          ))}
        </div>
      )}
    </>
  );
}

import { addDays, format, isBefore, isSameDay, startOfDay } from "date-fns";
import {
  Check,
  ChevronRight,
  ListChecks,
} from "lucide-react";
import { buildProjectActivityFeed } from "@/lib/projectActivityFeed";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { healthPill } from "@/lib/adminProjectNav";
import { computeBurndownData } from "@/lib/projectBurndown";

type Props = {
  project: any;
  latestHealth: any;
  workflowTemplate: any;
  workflowStatuses?: any[];
  tasks: any[];
  sprints: any[];
  phases: any[];
  logs: any[];
  resourceMembers: any[];
  openBlockers: { description?: string | null; status?: string }[];
  actionItems: any[];
  statusUpdates: any[];
  statusUpdatesLoading?: boolean;
  progressPct: number;
  onNavigateTab: (tab: string) => void;
  burndownScope: string;
  setBurndownScope: (s: string) => void;
  newStatusUpdate: string;
  setNewStatusUpdate: (s: string) => void;
  newStatusUpdateVisible: boolean;
  setNewStatusUpdateVisible: (v: boolean) => void;
  addStatusUpdate: () => void;
};

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

const AVATAR_PALETTE = [
  { bg: "#FDECE3", color: "#EB5A1E" },
  { bg: "#E6E9FF", color: "#4C57D9" },
  { bg: "#DFF6E4", color: "#1B8A46" },
  { bg: "#FDF3E3", color: "#A9720B" },
  { bg: "#F5E8FF", color: "#7B4DB8" },
  { bg: "#EAF3FF", color: "#1C6FC9" },
];

const PRIORITY_DOT: Record<string, string> = {
  high: "#E5484D",
  medium: "#E8B93B",
  low: "#1FAA59",
};

export function AdminProjectOverview({
  project,
  latestHealth,
  workflowTemplate,
  workflowStatuses = [],
  tasks,
  sprints,
  phases,
  logs,
  resourceMembers,
  openBlockers,
  actionItems,
  statusUpdates,
  statusUpdatesLoading = false,
  progressPct,
  onNavigateTab,
  burndownScope,
  setBurndownScope,
  newStatusUpdate,
  setNewStatusUpdate,
  newStatusUpdateVisible,
  setNewStatusUpdateVisible,
  addStatusUpdate,
}: Props) {
  const list = tasks || [];
  const today = startOfDay(new Date());
  const doneIds = new Set(
    (workflowStatuses || []).filter((s: any) => s.category === "done").map((s: any) => s.id)
  );
  const isDone = (t: any) => !!t.completed_at || (t.status_id && doneIds.has(t.status_id));
  const openTasks = list.filter((t) => !isDone(t));
  const overdueTasks = openTasks.filter(
    (t) => t.due_date && isBefore(startOfDay(new Date(t.due_date)), today)
  );
  const blockedCount = openBlockers.length;
  const unassignedActions = (actionItems || []).filter(
    (a: any) => !a.assigned_to && a.status !== "completed" && a.status !== "resolved"
  ).length;

  const health = healthPill(latestHealth?.health_status);
  const dueLabel = project.end_date ? format(new Date(project.end_date), "MMM d") : "—";
  const dueSub = project.end_date
    ? `${format(new Date(project.end_date), "yyyy")} · ${
        isBefore(startOfDay(new Date(project.end_date)), today) ? "past due" : "on schedule"
      }`
    : "No end date set";

  const attentionItems = [
    {
      label: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`,
      sub: "Past their due date",
      warn: overdueTasks.length > 0,
      tab: "tasks",
    },
    {
      label: `${blockedCount} open blocker${blockedCount === 1 ? "" : "s"}`,
      sub: blockedCount > 0 ? openBlockers[0]?.description || "Needs resolution" : "None active",
      warn: blockedCount > 0,
      tab: "kanban",
    },
    {
      label: `${unassignedActions} unassigned action item${unassignedActions === 1 ? "" : "s"}`,
      sub: "Need an owner",
      warn: unassignedActions > 0,
      tab: "action-items",
    },
    {
      label: `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}`,
      sub: `of ${list.length} total`,
      warn: false,
      tab: "tasks",
    },
  ].filter((a) => a.warn || a.tab === "tasks");

  const workloadRows = (resourceMembers || []).slice(0, 6).map((m: any, i: number) => {
    const name = m.users?.full_name || "Unknown";
    const hrs = Math.round(Number(m._hoursSpent || 0) * 10) / 10;
    const palette = AVATAR_PALETTE[i % AVATAR_PALETTE.length];
    return { name, hrs, initials: initials(name), ...palette };
  });
  const maxHrs = Math.max(1, ...workloadRows.map((w) => w.hrs), 1);

  const activeSprint =
    (sprints || []).find((s: any) => s.status === "active") ||
    (sprints || []).find((s: any) => s.status === "planned") ||
    (sprints || [])[0];
  const sprintTasks = activeSprint
    ? list.filter((t: any) => t.sprint_id === activeSprint.id)
    : [];
  const sprintDone = sprintTasks.filter(isDone).length;
  const sprintPct =
    sprintTasks.length > 0 ? Math.round((sprintDone / sprintTasks.length) * 100) : 0;
  const sprintStatusStyle =
    activeSprint?.status === "active"
      ? { bg: "#FDECE3", color: "#EB5A1E" }
      : activeSprint?.status === "completed"
        ? { bg: "#DFF6E4", color: "#1B8A46" }
        : { bg: "#F6F5F3", color: "#6B6B72" };

  const upcoming = openTasks
    .filter((t: any) => t.due_date)
    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5);

  const recentlyCompleted = list
    .filter(isDone)
    .sort((a: any, b: any) => {
      const da = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const db = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return db - da;
    })
    .slice(0, 5);

  const burndown = computeBurndownData({
    burndownScope,
    phases,
    tasks,
    sprints,
    logs,
    project,
  });

  // 8-day window: today - 3 … today + 4
  const calendarDays = Array.from({ length: 8 }, (_, i) => addDays(today, i - 3));
  const todayCol = 3;
  const calendarTasks = list
    .filter((t: any) => t.due_date)
    .map((t: any) => {
      const due = startOfDay(new Date(t.due_date));
      const col = calendarDays.findIndex((d) => isSameDay(d, due));
      return col >= 0 ? { task: t, col, isToday: isSameDay(due, today) } : null;
    })
    .filter(Boolean) as { task: any; col: number; isToday: boolean }[];

  const colStacks: Record<number, typeof calendarTasks> = {};
  calendarTasks.forEach((ct) => {
    if (!colStacks[ct.col]) colStacks[ct.col] = [];
    colStacks[ct.col].push(ct);
  });
  const maxStack = Math.max(1, ...Object.values(colStacks).map((s) => s.length), 1);

  const activityFeed = buildProjectActivityFeed({
    tasks: list,
    workflowStatuses,
    openBlockers,
    statusUpdates,
    sprints,
    resourceMembers,
    limit: 5,
  });

  const healthBody = latestHealth
    ? `${health.label}. ${latestHealth.tasks_complete ?? 0}/${latestHealth.tasks_total ?? 0} tasks complete, ${
        latestHealth.tasks_overdue ?? 0
      } overdue, ${latestHealth.open_blockers ?? 0} open blockers. Planned ${Number(
        latestHealth.planned_hours || 0
      ).toFixed(1)}h · logged ${Number(latestHealth.logged_hours || 0).toFixed(1)}h.`
    : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
          <div className="text-[12px] text-[#8B8B92] font-semibold whitespace-nowrap">Progress</div>
          <div className="text-2xl font-bold mt-2 text-[#17171A]">{progressPct}%</div>
          <div className="h-[5px] rounded-[3px] bg-[#F3E9E3] mt-2.5 overflow-hidden">
            <div
              className="h-full rounded-[3px] bg-[#EB5A1E]"
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
          <div className="text-[12px] text-[#8B8B92] font-semibold whitespace-nowrap">Due Date</div>
          <div className="text-[22px] font-bold mt-2 text-[#17171A] whitespace-nowrap">{dueLabel}</div>
          <div className="text-[11.5px] text-[#8B8B92] mt-2.5 whitespace-nowrap">{dueSub}</div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab("tasks")}
          className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0 text-left hover:border-[#EB5A1E]/40 transition-colors"
        >
          <div className="text-[12px] text-[#8B8B92] font-semibold whitespace-nowrap">Open Tasks</div>
          <div className="text-2xl font-bold mt-2 text-[#17171A]">{openTasks.length}</div>
          <div className="text-[11.5px] text-[#8B8B92] mt-2.5 whitespace-nowrap">
            of {list.length} shown
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab("tasks")}
          className="bg-white border border-[#FDCBB0] rounded-[14px] p-[18px] min-w-0 text-left hover:border-[#EB5A1E] transition-colors"
        >
          <div className="text-[12px] text-[#EB5A1E] font-bold whitespace-nowrap">Overdue Tasks</div>
          <div className="text-2xl font-bold mt-2 text-[#EB5A1E]">{overdueTasks.length}</div>
          <div className="text-[11.5px] text-[#C7860F] mt-2.5 whitespace-nowrap">needs attention</div>
        </button>

        <div className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
          <div className="text-[12px] text-[#8B8B92] font-semibold whitespace-nowrap">Health</div>
          <div
            className="inline-flex items-center gap-1.5 mt-[9px] text-[12.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ background: health.bg, color: health.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: health.color }} />
            {health.label}
          </div>
        </div>
      </div>

      <div className="bg-white border border-black/[0.08] rounded-[14px] p-[22px]">
        <div className="text-[15px] font-bold text-[#17171A] mb-1">Attention Required</div>
        <div className="text-[12.5px] text-[#8B8B92] mb-4">
          Items that need a decision or follow-up
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {attentionItems.length === 0 ? (
            <div className="text-[13px] text-[#8B8B92] col-span-full py-2">All clear for now.</div>
          ) : (
            attentionItems.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => onNavigateTab(a.tab)}
                className="flex items-center gap-3 px-3.5 py-3 rounded-[11px] bg-[#F9F9F8] text-left min-w-0 hover:bg-[#F3F3F2] transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: a.warn ? "#E5484D" : "#1FAA59" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-[#17171A] truncate">{a.label}</div>
                  <div className="text-[11.5px] text-[#8B8B92] truncate">{a.sub}</div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-[#B0B0B6] shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-[18px]">
        <div className="bg-white border border-black/[0.08] rounded-[14px] p-[22px] min-w-0">
          <div className="text-[15px] font-bold text-[#17171A] mb-4">Work Distribution</div>
          {workloadRows.length === 0 ? (
            <div className="text-[13px] text-[#8B8B92]">No team hours logged yet.</div>
          ) : (
            <div className="flex flex-col">
              {workloadRows.map((w) => (
                <div
                  key={w.name}
                  className="flex items-center gap-2.5 min-w-0 pb-[11px] mb-[11px] border-b border-black/[0.06] last:border-0 last:mb-0 last:pb-0"
                >
                  <div
                    className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-bold text-[10.5px] shrink-0"
                    style={{ background: w.bg, color: w.color }}
                  >
                    {w.initials}
                  </div>
                  <div className="text-[12.5px] text-[#4B4B52] w-[120px] truncate shrink-0">
                    {w.name}
                  </div>
                  <div className="flex-1 h-2 rounded bg-[#F3E9E3] overflow-hidden min-w-0">
                    <div
                      className="h-full rounded bg-[#EB5A1E]"
                      style={{ width: `${Math.round((w.hrs / maxHrs) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-[#4B4B52] font-bold shrink-0 w-[30px] text-right">
                    {w.hrs}h
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-black/[0.08] rounded-[14px] p-[22px] min-w-0">
          <div className="flex items-center justify-between mb-3.5">
            <div className="text-[15px] font-bold text-[#17171A]">Current Sprint</div>
            {activeSprint && (
              <span
                className="text-[11px] font-bold px-[9px] py-[3px] rounded-full capitalize"
                style={{ background: sprintStatusStyle.bg, color: sprintStatusStyle.color }}
              >
                {activeSprint.status || "planned"}
              </span>
            )}
          </div>
          {activeSprint ? (
            <>
              <div className="text-base font-bold text-[#17171A] mb-1.5">{activeSprint.name}</div>
              <div className="text-[12.5px] text-[#8B8B92] mb-3.5">
                {activeSprint.start_date && activeSprint.end_date
                  ? `${format(new Date(activeSprint.start_date), "MMM d")} – ${format(new Date(activeSprint.end_date), "MMM d")}`
                  : "Dates TBD"}{" "}
                · {sprintTasks.length} tasks
              </div>
              <div className="h-2 rounded bg-[#F3E9E3] overflow-hidden mb-2.5">
                <div className="h-full rounded bg-[#EB5A1E]" style={{ width: `${sprintPct}%` }} />
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("sprints")}
                className="text-xs text-[#4B4B52] font-semibold hover:text-[#EB5A1E] transition-colors"
              >
                View all sprints →
              </button>
            </>
          ) : (
            <div className="text-[13px] text-[#8B8B92]">
              No sprints yet.{" "}
              <button
                type="button"
                onClick={() => onNavigateTab("sprints")}
                className="font-semibold text-[#EB5A1E]"
              >
                Create one →
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px]">
        <div className="bg-white border border-black/[0.08] rounded-[14px] p-[22px] min-w-0">
          <div className="text-[15px] font-bold text-[#17171A] mb-3.5">Upcoming Deadlines</div>
          {upcoming.length === 0 ? (
            <div className="text-[13px] text-[#8B8B92]">No upcoming due dates.</div>
          ) : (
            <div className="flex flex-col">
              {upcoming.map((t: any) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2.5 min-w-0 pb-2.5 mb-2.5 border-b border-black/[0.06] last:border-0 last:mb-0 last:pb-0"
                >
                  <span
                    className="w-[7px] h-[7px] rounded-full shrink-0"
                    style={{ background: PRIORITY_DOT[t.priority] || "#B0B0B6" }}
                  />
                  <div className="text-[13px] text-[#17171A] flex-1 min-w-0 truncate">{t.title}</div>
                  <div className="text-xs text-[#8B8B92] shrink-0">
                    {format(new Date(t.due_date), "MMM d")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-black/[0.08] rounded-[14px] p-[22px] min-w-0">
          <div className="text-[15px] font-bold text-[#17171A] mb-3.5">Recently Completed</div>
          {recentlyCompleted.length === 0 ? (
            <div className="text-[13px] text-[#8B8B92]">No completed tasks yet.</div>
          ) : (
            <div className="flex flex-col">
              {recentlyCompleted.map((t: any) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2.5 min-w-0 pb-2.5 mb-2.5 border-b border-black/[0.06] last:border-0 last:mb-0 last:pb-0"
                >
                  <Check className="h-[15px] w-[15px] text-[#1FAA59] shrink-0" strokeWidth={2.2} />
                  <div className="text-[13px] text-[#17171A] flex-1 min-w-0 truncate">{t.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workflow card */}
      <div className="bg-white border border-black/[0.08] rounded-[14px] p-6">
        {project.description && (
          <p className="text-sm text-[#4B4B52] leading-relaxed mb-[22px] m-0">{project.description}</p>
        )}
        <div className="flex flex-wrap gap-x-7 gap-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[9px] bg-[#FDECE3] text-[#EB5A1E] flex items-center justify-center shrink-0">
              <ListChecks className="h-4 w-4" strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-[11px] text-[#8B8B92]">Workflow</div>
              <div className="text-[13.5px] font-bold text-[#17171A] whitespace-nowrap">
                {workflowTemplate?.name || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Burndown */}
      <div className="bg-white border border-black/[0.08] rounded-[14px] p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
          <div className="text-[15px] font-bold text-[#17171A]">Burndown</div>
          <div className="flex items-center gap-2 text-[13px] text-[#4B4B52]">
            Scope:
            <Select value={burndownScope} onValueChange={setBurndownScope}>
              <SelectTrigger className="h-auto w-auto min-w-[120px] border border-black/10 rounded-[9px] px-3 py-[7px] font-semibold text-[13px] gap-1.5 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project">Project</SelectItem>
                {(phases || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title || p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {"error" in burndown ? (
          <p className="text-[13px] text-[#8B8B92] py-8 text-center">{burndown.error}</p>
        ) : (
          <>
            <div className="flex items-center gap-[26px] text-[12.5px] text-[#4B4B52] mb-[18px] flex-wrap">
              <span>
                Total estimated: <b>{Number(burndown.totalEst).toFixed(1)}h</b>
              </span>
              <span>
                Logged: <b>{Number(burndown.logged).toFixed(1)}h</b>
              </span>
              <span>
                Remaining: <b>{Number(burndown.remaining).toFixed(1)}h</b>
              </span>
              {burndown.unestimated.length > 0 && (
                <span className="text-[#C7860F] font-bold">
                  Unestimated: {burndown.unestimated.length} task
                  {burndown.unestimated.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={burndown.burndownData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminBurndownFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EB5A1E" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#EB5A1E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#8B8B92" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#8B8B92" }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 9, border: "1px solid rgba(0,0,0,.08)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="none"
                    fill="url(#adminBurndownFill)"
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    stroke="#C6C6CC"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Total estimated"
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#EB5A1E"
                    strokeWidth={3}
                    strokeLinecap="round"
                    connectNulls={false}
                    dot={{ r: 5, fill: "#EB5A1E", stroke: "#fff", strokeWidth: 2 }}
                    name="Remaining"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-[18px] mt-2.5 text-xs text-[#8B8B92]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-[2.5px] rounded-sm bg-[#EB5A1E] inline-block" />
                Remaining
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-[2.5px] rounded-sm bg-[#C6C6CC] inline-block" />
                Total estimated
              </span>
            </div>
          </>
        )}
      </div>

      {/* Task Calendar */}
      <div className="bg-white border border-black/[0.08] rounded-[14px] p-6">
        <div className="text-[15px] font-bold text-[#17171A] mb-4">Task Calendar</div>
        {calendarTasks.length === 0 ? (
          <p className="text-[13px] text-[#8B8B92] py-6 text-center">
            No tasks with due dates in this window.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="relative min-w-[1120px] min-h-[260px]"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 140px)",
                gridAutoRows: "min-content",
                rowGap: 14,
              }}
            >
              {calendarDays.map((d, i) => (
                <div
                  key={d.toISOString()}
                  className="min-w-0 border-l border-black/[0.06] pl-2.5"
                  style={{ gridColumn: i + 1, gridRow: 1 }}
                >
                  <div className="text-[12.5px] font-bold text-[#4B4B52] whitespace-nowrap">
                    {format(d, "d MMM")}
                  </div>
                </div>
              ))}
              {/* Today marker */}
              <div
                className="absolute top-[26px] bottom-0 w-0.5 bg-[#17171A] pointer-events-none"
                style={{ left: `calc(${todayCol}/8*100% + 4px)` }}
              />
              {Object.entries(colStacks).flatMap(([colStr, stack]) =>
                stack.slice(0, 4).map((ct, rowIdx) => (
                  <div
                    key={ct.task.id}
                    className="inline-flex items-center gap-1.5 max-w-[128px] box-border px-2.5 py-[7px] rounded-[14px] text-xs whitespace-nowrap overflow-hidden text-ellipsis mt-1.5 self-start justify-self-start"
                    style={{
                      gridColumn: Number(colStr) + 1,
                      gridRow: rowIdx + 2,
                      background: ct.isToday ? "#17171A" : "#F6F5F3",
                      color: ct.isToday ? "#fff" : "#17171A",
                    }}
                    title={ct.task.title}
                  >
                    <span className="font-bold shrink-0">
                      {format(new Date(ct.task.due_date), "d MMM")}
                    </span>
                    <span className="truncate">{ct.task.title}</span>
                  </div>
                ))
              )}
            </div>
            {maxStack > 4 && (
              <p className="text-[11.5px] text-[#8B8B92] mt-2">
                Showing up to 4 tasks per day. Open Tasks for the full list.
              </p>
            )}
          </div>
        )}
      </div>

      {/* HEALTH DETAIL */}
      <div className="bg-white border border-black/[0.08] rounded-[14px] p-6">
        <div className="text-[12.5px] text-[#8B8B92] font-semibold mb-2">HEALTH DETAIL</div>
        {healthBody ? (
          <>
            <div className="text-[13.5px] text-[#4B4B52] leading-relaxed mb-1.5">{healthBody}</div>
            <div className="text-xs text-[#B0B0B6]">
              Last updated{" "}
              {latestHealth.snapshot_date
                ? format(new Date(latestHealth.snapshot_date), "MMM d, yyyy")
                : "—"}
            </div>
          </>
        ) : (
          <div className="text-[13.5px] text-[#4B4B52]">Health data not yet available.</div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white border border-black/[0.08] rounded-[14px] p-6">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="text-[15px] font-bold text-[#17171A]">Recent Activity</div>
          <button
            type="button"
            onClick={() => onNavigateTab("status-updates")}
            className="text-[12.5px] font-semibold text-[#EB5A1E] hover:underline"
          >
            View all →
          </button>
        </div>
        {activityFeed.length === 0 ? (
          <div className="text-[13px] text-[#8B8B92]">No recent activity.</div>
        ) : (
          <div className="flex flex-col">
            {activityFeed.map((m) => (
              <div
                key={m.key}
                className="flex items-center gap-3 pb-3 mb-3 border-b border-black/[0.06] last:border-0 last:mb-0 last:pb-0"
              >
                <div
                  className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0"
                  style={{ background: m.iconBg, color: m.iconColor }}
                >
                  <m.Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[#17171A] truncate">{m.text}</div>
                  {m.time && (
                    <div className="text-[11.5px] text-[#B0B0B6] mt-0.5">{m.time}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Updates */}
      <div className="bg-white border border-black/[0.08] rounded-[14px] p-6">
        <div className="text-[15px] font-bold text-[#17171A] mb-4">Status Updates</div>
        <div className="flex flex-col gap-4 max-h-[280px] overflow-y-auto mb-4">
          {statusUpdatesLoading ? (
            <p className="text-[13px] text-[#8B8B92]">Loading…</p>
          ) : (statusUpdates || []).length === 0 ? (
            <p className="text-[13px] text-[#8B8B92]">No status updates yet.</p>
          ) : (
            (statusUpdates || []).map((u: any) => (
              <div
                key={u.id}
                className="flex gap-2.5 pb-3.5 border-b border-black/[0.05] last:border-0"
              >
                <div className="w-[26px] h-[26px] rounded-full bg-[#DFF6E4] text-[#1FAA59] flex items-center justify-center font-bold text-[11px] shrink-0">
                  {initials(u.author?.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="font-bold text-[#17171A]">
                      {u.author?.full_name || (u.author_type === "ai" ? "AI" : "Unknown")}
                    </span>
                    <span className="text-[#B0B0B6] text-xs">
                      {u.created_at ? format(new Date(u.created_at), "MMM d, h:mm a") : ""}
                    </span>
                  </div>
                  <div className="text-[13.5px] text-[#4B4B52] mt-[3px] whitespace-pre-wrap break-words">
                    {u.summary}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div>
          <Textarea
            value={newStatusUpdate}
            onChange={(e) => setNewStatusUpdate(e.target.value)}
            placeholder="Post a status update..."
            className="min-h-[70px] rounded-[10px] border-black/10 text-[13.5px] resize-y px-3 py-3 shadow-none focus-visible:ring-[#EB5A1E]/30"
          />
          <div className="flex items-center justify-between mt-2.5 gap-3 flex-wrap">
            <label className="inline-flex items-center gap-[7px] text-[13px] text-[#4B4B52] cursor-pointer">
              <Checkbox
                checked={newStatusUpdateVisible}
                onCheckedChange={(v) => setNewStatusUpdateVisible(v === true)}
                className="h-[15px] w-[15px] border-[#C6C6CC] data-[state=checked]:bg-[#EB5A1E] data-[state=checked]:border-[#EB5A1E]"
              />
              Visible to client
            </label>
            <button
              type="button"
              onClick={addStatusUpdate}
              disabled={!newStatusUpdate.trim()}
              className="bg-[#EB5A1E] text-white font-semibold text-[13px] px-[22px] py-2.5 rounded-[10px] disabled:opacity-50 hover:bg-[#d64f18] transition-colors"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

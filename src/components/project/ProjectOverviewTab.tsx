import React from 'react';
import { format } from "date-fns";
import { ExternalLink, Eye, EyeOff, ListChecks, AlertTriangle, Users, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from "recharts";

import {
  bucketTaskState,
  TASK_STATE_COLORS,
  type TaskStateBucket,
} from "@/lib/clientTaskBuckets";
import { AdminProjectOverview } from "@/components/project/AdminProjectOverview";
import { computeBurndownData } from "@/lib/projectBurndown";

export interface ProjectOverviewTabProps {
  project: any;
  latestHealth: any;
  workflowTemplate: any;
  workflowStatuses?: any[];
  isAdmin: boolean;
  isClient: boolean;
  STATUS_OPTIONS: string[];
  changeStatus: (s: string) => void;
  statusNote: string;
  setStatusNote: (s: string) => void;
  saveStatusNote: () => void;
  portalMessages: any[];
  burndownScope: string;
  setBurndownScope: (s: string) => void;
  phases: any[];
  tasks: any[];
  sprints: any[];
  logs: any[];
  statusUpdatesLoading: boolean;
  statusUpdates: any[];
  getAvatarUrl: (name: string) => string;
  newStatusUpdate: string;
  setNewStatusUpdate: (s: string) => void;
  newStatusUpdateVisible: boolean;
  setNewStatusUpdateVisible: (v: boolean) => void;
  addStatusUpdate: () => void;
  blockerCount?: number;
  resourceCount?: number;
  progressPct?: number;
  inDevelopmentCount?: number;
  openBlockers?: { description?: string | null; client_visible?: boolean | null; status?: string }[];
  resourceMembers?: any[];
  actionItems?: any[];
  onNavigateTab?: (tab: string) => void;
}

function ClientDeliveryBurndown({
  tasks,
  sprints,
  logs,
  project,
  phases,
}: {
  tasks: any[];
  sprints: any[];
  logs: any[];
  project: any;
  phases: any[];
}) {
  const result = computeBurndownData({
    burndownScope: "project",
    phases,
    tasks,
    sprints,
    logs,
    project,
  });

  return (
    <div className="border border-[#E7E7EA] rounded-[14px] bg-white p-[18px] min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div>
          <div className="text-[12px] font-bold tracking-[-0.15px] text-[#17171A]">Delivery burndown</div>
          <div className="text-[8.7px] text-[#96969D] mt-0.5">
            Remaining effort against the ideal delivery trajectory
          </div>
        </div>
        <span className="text-[8px] font-semibold px-[7px] py-1 rounded-full bg-[#FFF1EA] text-[#C95627] whitespace-nowrap">
          Project scope
        </span>
      </div>
      {"error" in result ? (
        <p className="text-xs text-[#8B8B92] py-10 text-center">{result.error}</p>
      ) : (
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={result.burndownData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="clientBurnArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#EB5A1E" stopOpacity={0.18} />
                  <stop offset="1" stopColor="#EB5A1E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: "#8B8B92" }}
                axisLine={{ stroke: "#D8D8DC" }}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 9, fill: "#A0A0A7" }} axisLine={false} tickLine={false} width={32} />
              <RechartsTooltip contentStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#EB5A1E"
                strokeWidth={3}
                fill="url(#clientBurnArea)"
                connectNulls
                name="Remaining"
                dot={{ r: 4, fill: "#fff", stroke: "#EB5A1E", strokeWidth: 2.5 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="ideal"
                stroke="#BFC3CA"
                strokeWidth={1.5}
                strokeDasharray="6 6"
                dot={false}
                name="Ideal"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ClientTaskStateDistribution({
  tasks,
  workflowStatuses,
}: {
  tasks: any[];
  workflowStatuses: any[];
}) {
  const counts: Record<TaskStateBucket, number> = {
    Unlinked: 0,
    Development: 0,
    Complete: 0,
    Returned: 0,
  };
  (tasks || []).forEach((t: any) => {
    const st = (workflowStatuses || []).find((s: any) => s.id === t.status_id);
    counts[bucketTaskState(st)]++;
  });
  const total = (tasks || []).length;
  const denom = total || 1;
  const p1 = (counts.Unlinked / denom) * 100;
  const p2 = p1 + (counts.Development / denom) * 100;
  const p3 = p2 + (counts.Complete / denom) * 100;
  const legend: TaskStateBucket[] = ["Unlinked", "Development", "Complete", "Returned"];

  return (
    <div className="border border-[#E7E7EA] rounded-[14px] bg-white p-[18px] min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div>
          <div className="text-[12px] font-bold tracking-[-0.15px] text-[#17171A]">Task state distribution</div>
          <div className="text-[8.7px] text-[#96969D] mt-0.5">Current workflow position across visible tasks</div>
        </div>
        <span className="text-[8px] font-semibold px-[7px] py-1 rounded-full bg-[#FFF1EA] text-[#C95627] whitespace-nowrap">
          {total} tasks
        </span>
      </div>
      <div className="flex items-center justify-center gap-[26px] min-h-[240px] flex-wrap">
        <div
          className="relative w-[150px] h-[150px] rounded-full flex-none"
          style={{
            background:
              total === 0
                ? "#EFEFF2"
                : `conic-gradient(${TASK_STATE_COLORS.Unlinked} 0 ${p1}%, ${TASK_STATE_COLORS.Development} ${p1}% ${p2}%, ${TASK_STATE_COLORS.Complete} ${p2}% ${p3}%, ${TASK_STATE_COLORS.Returned} ${p3}% 100%)`,
          }}
        >
          <div className="absolute inset-[23px] rounded-full bg-white shadow-[inset_0_0_0_1px_#F0F0F2]" />
          <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center">
            <b className="text-[23px] tracking-[-0.7px] text-[#17171A] font-bold leading-none">{total}</b>
            <span className="text-[8px] text-[#8B8B92] mt-0.5">total tasks</span>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 min-w-[130px]">
          {legend.map((label) => (
            <div key={label} className="flex items-center gap-2 text-[9px] text-[#77777E]">
              <i
                className="w-[7px] h-[7px] rounded-full flex-none not-italic"
                style={{ background: TASK_STATE_COLORS[label] }}
              />
              {label}
              <b className="ml-auto text-[9px] text-[#333338] font-semibold">{counts[label]}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VizCardShell({
  title,
  sub,
  badge,
  children,
}: {
  title: string;
  sub: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[#E7E7EA] rounded-[14px] bg-white p-[18px] min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div>
          <div className="text-[12px] font-bold tracking-[-0.15px] text-[#17171A]">{title}</div>
          <div className="text-[8.7px] text-[#96969D] mt-0.5">{sub}</div>
        </div>
        {badge != null && (
          <span className="text-[8px] font-semibold px-[7px] py-1 rounded-full bg-[#FFF1EA] text-[#C95627] whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function BarRows({ rows }: { rows: [string, number][] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-[#8B8B92] py-6 text-center">No data</p>;
  }
  const max = Math.max(...rows.map(([, n]) => n), 1);
  return (
    <div className="flex flex-col gap-4 py-1">
      {rows.map(([label, n]) => (
        <div key={label} className="grid grid-cols-[125px_1fr_34px] gap-2.5 items-center">
          <div className="text-[9px] text-[#696970] whitespace-nowrap overflow-hidden text-ellipsis" title={label}>
            {label}
          </div>
          <div className="h-2 bg-[#F0F0F2] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(6, (n / max) * 100)}%`,
                background: "linear-gradient(90deg,#FFA06F,#EB5A1E)",
              }}
            />
          </div>
          <div className="text-right text-[8.5px] font-semibold text-[#58585F]">{n}</div>
        </div>
      ))}
    </div>
  );
}

function ClientSprintComposition({ tasks, sprints }: { tasks: any[]; sprints: any[] }) {
  const sprintName = (id: string | null) => {
    if (!id) return "Unassigned";
    return (sprints || []).find((s: any) => s.id === id)?.name || "Unassigned";
  };
  const counts = new Map<string, number>();
  (tasks || []).forEach((t: any) => {
    const label = sprintName(t.sprint_id);
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  // Prefer named sprints in their list order, then Unassigned last
  const rows: [string, number][] = [];
  (sprints || []).forEach((s: any) => {
    const n = counts.get(s.name);
    if (n != null) {
      rows.push([s.name, n]);
      counts.delete(s.name);
    }
  });
  const unassigned = counts.get("Unassigned") || 0;
  counts.delete("Unassigned");
  counts.forEach((n, label) => rows.push([label, n]));
  if (unassigned > 0 || rows.length === 0) {
    rows.push(["Unassigned", unassigned]);
  }

  return (
    <VizCardShell
      title="Sprint composition"
      sub="Visible task load by sprint allocation"
      badge="Allocation"
    >
      <BarRows rows={rows} />
    </VizCardShell>
  );
}

function ClientUpcomingDueDates({ tasks }: { tasks: any[] }) {
  const byDay = new Map<string, { label: string; count: number; sortKey: number }>();
  (tasks || []).forEach((t: any) => {
    if (!t.due_date) return;
    const d = new Date(t.due_date);
    if (Number.isNaN(d.getTime())) return;
    const key = format(d, "yyyy-MM-dd");
    const existing = byDay.get(key);
    if (existing) existing.count += 1;
    else byDay.set(key, { label: format(d, "MMM d"), count: 1, sortKey: d.getTime() });
  });
  const rows: [string, number][] = Array.from(byDay.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 6)
    .map((x) => [x.label, x.count]);

  return (
    <VizCardShell title="Upcoming due dates" sub="Tasks currently due on each visible date" badge="Milestones">
      {rows.length === 0 ? (
        <p className="text-xs text-[#8B8B92] py-6 text-center">No upcoming due dates</p>
      ) : (
        <BarRows rows={rows} />
      )}
    </VizCardShell>
  );
}

function ClientEstimateCoverage({ tasks }: { tasks: any[] }) {
  const list = tasks || [];
  const estimated = list.filter((t: any) => t.estimated_hours != null);
  const unestimated = list.length - estimated.length;
  const totalEst = estimated.reduce((s: number, t: any) => s + Number(t.estimated_hours), 0);
  const flagged = list.filter((t: any) => t.is_flagged).length;
  const cells = [
    { value: `${totalEst}h`, label: "Total estimated effort" },
    { value: String(estimated.length), label: "Estimated tasks" },
    { value: String(unestimated), label: "Unestimated tasks" },
    { value: String(flagged), label: flagged === 1 ? "Flagged task" : "Flagged tasks" },
  ];

  return (
    <VizCardShell title="Estimate coverage" sub="Effort-estimation coverage across the task inventory">
      <div className="grid grid-cols-2 gap-2.5">
        {cells.map((c) => (
          <div key={c.label} className="border border-[#EEEEF0] rounded-xl p-[13px] bg-[#FCFCFD]">
            <b className="text-[18px] tracking-[-0.4px] text-[#17171A] block font-bold">{c.value}</b>
            <span className="text-[8px] text-[#929299]">{c.label}</span>
          </div>
        ))}
      </div>
    </VizCardShell>
  );
}

function ClientDeliverySignals({
  tasks,
  workflowStatuses,
  openBlockers,
}: {
  tasks: any[];
  workflowStatuses: any[];
  openBlockers: { description?: string | null; client_visible?: boolean | null }[];
}) {
  const list = tasks || [];
  const total = list.length;
  const estimatedCount = list.filter((t: any) => t.estimated_hours != null).length;
  const returnedCount = list.filter((t: any) => {
    const st = (workflowStatuses || []).find((s: any) => s.id === t.status_id);
    return bucketTaskState(st) === "Returned";
  }).length;

  const clientFacing = openBlockers.filter(
    (b) => b.client_visible === true || b.client_visible == null
  );
  const blockerCount = clientFacing.length;
  const blockerSubtitle =
    blockerCount > 0
      ? clientFacing[0]?.description || "Requires project attention"
      : "No active blockers";
  const coveragePct = total > 0 ? Math.round((estimatedCount / total) * 100) : 0;

  const signals = [
    {
      icon: AlertTriangle,
      title: "Active blocker",
      subtitle: blockerSubtitle,
      value: String(blockerCount),
    },
    {
      icon: ListChecks,
      title: "Returned work",
      subtitle: "Tasks currently returned for further action",
      value: String(returnedCount),
    },
    {
      icon: TrendingUp,
      title: "Estimate coverage",
      subtitle: `${estimatedCount} of ${total} tasks carry estimates`,
      value: `${coveragePct}%`,
    },
  ];

  return (
    <VizCardShell title="Delivery signals" sub="Client-facing indicators requiring attention">
      <div className="flex flex-col gap-2.5">
        {signals.map((s) => (
          <div
            key={s.title}
            className="flex items-center gap-2.5 border border-[#EEEEF0] rounded-[11px] px-[11px] py-2.5 bg-[#FCFCFD]"
          >
            <div className="w-7 h-7 rounded-[9px] bg-[#FFF1EA] text-[#EB5A1E] flex items-center justify-center flex-none">
              <s.icon className="h-3.5 w-3.5 text-[#EB5A1E]" />
            </div>
            <div className="min-w-0 flex-1">
              <b className="text-[9.5px] text-[#17171A] block font-semibold">{s.title}</b>
              <span className="text-[8px] text-[#96969D] block mt-px truncate">{s.subtitle}</span>
            </div>
            <div className="text-[9px] font-bold text-[#17171A]">{s.value}</div>
          </div>
        ))}
      </div>
    </VizCardShell>
  );
}

function BurndownSection({
  burndownScope,
  setBurndownScope,
  phases,
  tasks,
  sprints,
  logs,
  project,
}: {
  burndownScope: string;
  setBurndownScope: (s: string) => void;
  phases: any[];
  tasks: any[];
  sprints: any[];
  logs: any[];
  project: any;
}) {
  const result = computeBurndownData({ burndownScope, phases, tasks, sprints, logs, project });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Burndown</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Scope:</label>
          <Select value={burndownScope} onValueChange={setBurndownScope}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project">Project</SelectItem>
              {phases.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {"error" in result ? (
        <p className="text-xs text-muted-foreground py-4">{result.error}</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2 flex-wrap">
            <span>
              Total estimated: <strong>{result.totalEst}h</strong>
            </span>
            <span>
              Logged: <strong>{result.logged.toFixed(1)}h</strong>
            </span>
            <span>
              Remaining: <strong>{result.remaining.toFixed(1)}h</strong>
            </span>
            {result.unestimated.length > 0 && (
              <span className="text-yellow-600">
                Unestimated:{" "}
                <strong>
                  {result.unestimated.length} task{result.unestimated.length > 1 ? "s" : ""}
                </strong>
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={result.burndownData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <RechartsTooltip contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ideal" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} name="Ideal" />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
                name="Actual"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function ProjectOverviewTab({
  project,
  latestHealth,
  workflowTemplate,
  workflowStatuses = [],
  isAdmin,
  isClient,
  STATUS_OPTIONS,
  changeStatus,
  statusNote,
  setStatusNote,
  saveStatusNote,
  portalMessages,
  burndownScope,
  setBurndownScope,
  phases,
  tasks,
  sprints,
  logs,
  statusUpdatesLoading,
  statusUpdates,
  getAvatarUrl,
  newStatusUpdate,
  setNewStatusUpdate,
  newStatusUpdateVisible,
  setNewStatusUpdateVisible,
  addStatusUpdate,
  blockerCount = 0,
  resourceCount = 0,
  progressPct: progressPctProp,
  inDevelopmentCount = 0,
  openBlockers = [],
  resourceMembers = [],
  actionItems = [],
  onNavigateTab,
}: ProjectOverviewTabProps) {
  const taskCount = (tasks || []).length;
  const doneCount = (tasks || []).filter((t: any) => t.completed_at).length;
  const progressPct = progressPctProp ?? (taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0);
  const assignedCount = (tasks || []).filter((t: any) => !!t.assigned_to).length;

  if (isAdmin && !isClient && onNavigateTab) {
    return (
      <AdminProjectOverview
        project={project}
        latestHealth={latestHealth}
        workflowTemplate={workflowTemplate}
        workflowStatuses={workflowStatuses}
        tasks={tasks}
        sprints={sprints}
        phases={phases}
        logs={logs}
        resourceMembers={resourceMembers}
        openBlockers={openBlockers}
        actionItems={actionItems}
        statusUpdates={statusUpdates}
        statusUpdatesLoading={statusUpdatesLoading}
        progressPct={progressPct}
        onNavigateTab={onNavigateTab}
        burndownScope={burndownScope}
        setBurndownScope={setBurndownScope}
        newStatusUpdate={newStatusUpdate}
        setNewStatusUpdate={setNewStatusUpdate}
        newStatusUpdateVisible={newStatusUpdateVisible}
        setNewStatusUpdateVisible={setNewStatusUpdateVisible}
        addStatusUpdate={addStatusUpdate}
      />
    );
  }

  if (isClient) {
    return (
      <div className="space-y-5">
        {project.description && (
          <p className="text-[13px] text-[#5D5D64] leading-relaxed max-w-3xl m-0">{project.description}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border border-[#E7E7EA] rounded-[15px] overflow-hidden bg-white">
          {[
            { label: "Client", value: (project.clients as any)?.name || "—" },
            { label: "Start date", value: format(new Date(project.start_date), "MMM d, yyyy") },
            { label: "End date", value: project.end_date ? format(new Date(project.end_date), "MMM d, yyyy") : "—" },
            {
              label: "Status",
              value: project.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
            },
            { label: "Workflow", value: workflowTemplate?.name || "—" },
            { label: "Visibility", value: "Client portal" },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white px-3.5 py-[13px] border-[#E7E7EA] border-l border-t max-md:[&:nth-child(2n+1)]:border-l-0 max-md:[&:nth-child(-n+2)]:border-t-0 md:max-lg:[&:nth-child(3n+1)]:border-l-0 md:max-lg:[&:nth-child(-n+3)]:border-t-0 lg:border-l lg:border-t lg:[&:nth-child(6n+1)]:border-l-0 lg:[&:nth-child(-n+6)]:border-t-0"
            >
              <span className="block text-[10px] text-[#8B8B92] mb-1">{item.label}</span>
              <span className="block text-[10.5px] font-semibold text-[#17171A]">{item.value}</span>
            </div>
          ))}
        </div>

        {(project as any).document_link && (
          <Button variant="outline" size="sm" className="rounded-button" asChild>
            <a href={(project as any).document_link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Open Document
            </a>
          </Button>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {(
            [
              {
                label: "Delivery progress",
                value: `${progressPct}%`,
                caption: "Weighted from current task states",
                icon: TrendingUp,
                trend: "Live",
              },
              {
                label: "Open task inventory",
                value: String(taskCount),
                caption: `${inDevelopmentCount} currently in development`,
                icon: ListChecks,
              },
              {
                label: "Client-visible blockers",
                value: String(blockerCount),
                caption: blockerCount ? "Requires project attention" : "No active blockers",
                icon: AlertTriangle,
              },
              {
                label: "Project resources",
                value: String(resourceCount),
                caption: `${assignedCount} tasks currently assigned`,
                icon: Users,
              },
            ] as const
          ).map((m) => (
            <div
              key={m.label}
              className="relative min-h-[118px] border border-[#E6E6E9] rounded-2xl p-[17px] overflow-hidden shadow-[0_9px_28px_rgba(20,20,24,0.035)] bg-[radial-gradient(circle_at_90%_10%,rgba(235,90,30,0.06),transparent_38%),linear-gradient(180deg,#fff,#FCFCFD)]"
            >
              <div className="w-8 h-8 rounded-[10px] bg-[#FFF0E9] text-[#EB5A1E] flex items-center justify-center mb-3">
                <m.icon className="h-[15px] w-[15px] text-[#EB5A1E]" />
              </div>
              <div className="text-[9px] text-[#8B8B92] font-semibold">{m.label}</div>
              <div className="flex items-end gap-1.5 mt-0.5">
                <div className="text-[23px] font-bold tracking-[-0.8px] text-[#17171A] leading-none">{m.value}</div>
                {"trend" in m && m.trend && (
                  <span className="mb-0.5 text-[8px] font-semibold rounded-full px-1.5 py-0.5 bg-[#E8F7EC] text-[#1A8B49]">
                    {m.trend}
                  </span>
                )}
              </div>
              <div className="text-[8.5px] text-[#97979D] mt-1">{m.caption}</div>
            </div>
          ))}
        </div>

        {portalMessages.length > 0 && (
          <div className="space-y-3">
            <h3 className="client-section-title">Messages</h3>
            {portalMessages.map((m: any) => (
              <div key={m.id} className="p-4 bg-[#FFF4EE] border border-[#F5D5C4] rounded-[11px]">
                <h4 className="text-sm font-semibold text-[#17171A]">{m.title}</h4>
                {m.body && <p className="text-sm text-[#5D5D64] mt-1 whitespace-pre-wrap">{m.body}</p>}
                {m.cta_label && m.cta_url && (
                  <a href={m.cta_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-[#EB5A1E] hover:underline mt-2">
                    {m.cta_label} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {project.status === "on_hold" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-[11px] p-3 text-sm text-yellow-800">This project is currently on hold.</div>
        )}

        <div className="grid gap-4 grid-cols-1 min-[1150px]:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
          <ClientDeliveryBurndown
            tasks={tasks}
            sprints={sprints}
            logs={logs}
            project={project}
            phases={phases}
          />
          <ClientTaskStateDistribution tasks={tasks} workflowStatuses={workflowStatuses} />
        </div>

        <div className="grid gap-4 grid-cols-1 min-[1150px]:grid-cols-2">
          <ClientSprintComposition tasks={tasks} sprints={sprints} />
          <ClientUpcomingDueDates tasks={tasks} />
        </div>

        <div className="grid gap-4 grid-cols-1 min-[1150px]:grid-cols-2">
          <ClientEstimateCoverage tasks={tasks} />
          <ClientDeliverySignals
            tasks={tasks}
            workflowStatuses={workflowStatuses}
            openBlockers={openBlockers}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <Card className="p-6 space-y-4">
        {project.description && <p className="text-muted-foreground">{project.description}</p>}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
          <div><span className="text-muted-foreground block">Client</span><span className="font-medium">{(project.clients as any)?.name}</span></div>
          <div><span className="text-muted-foreground block">Start Date</span><span className="font-medium">{format(new Date(project.start_date), "MMM d, yyyy")}</span></div>
          <div><span className="text-muted-foreground block">End Date</span><span className="font-medium">{project.end_date ? format(new Date(project.end_date), "MMM d, yyyy") : "—"}</span></div>
          <div><span className="text-muted-foreground block">Status</span><span className="font-medium">{project.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</span></div>
          <div>
            <span className="text-muted-foreground block">Health</span>
            {latestHealth ? (
              <Badge className={
                latestHealth.health_status === "on_track" ? "bg-green-100 text-green-800" :
                latestHealth.health_status === "at_risk" ? "bg-yellow-100 text-yellow-800" :
                "bg-red-100 text-red-800"
              }>
                {latestHealth.health_status.replace(/_/g, " ")}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <div><span className="text-muted-foreground block">Workflow</span><span className="font-medium">{workflowTemplate?.name || "—"}</span></div>
        </div>
        {(project as any).document_link && (
          <div className="pt-2">
            <span className="text-sm text-muted-foreground block mb-1">Document / Drive Link</span>
            <Button variant="outline" size="sm" className="rounded-button" asChild>
              <a
                href={(project as any).document_link}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open Document
              </a>
            </Button>
          </div>
        )}
        {isAdmin && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <span className="text-sm font-medium block mb-1">Change Status</span>
                <Select value={project.status} onValueChange={changeStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <span className="text-sm font-medium block mb-1">Status Note</span>
              <div className="flex gap-2">
                <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={2} className="flex-1" />
                <Button variant="outline" size="sm" onClick={saveStatusNote}>Save</Button>
              </div>
            </div>
          </div>
        )}
        {!isAdmin && project.status === "on_hold" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">This project is currently on hold.</div>
        )}

        {portalMessages.length > 0 && (
          <div className="pt-4 border-t space-y-3">
            <h3 className="text-sm font-semibold">Messages</h3>
            {portalMessages.map((m: any) => (
              <div key={m.id} className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <h4 className="text-sm font-semibold">{m.title}</h4>
                {m.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{m.body}</p>}
                {m.cta_label && m.cta_url && (
                  <a href={m.cta_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline mt-2">
                    {m.cta_label} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        <>
            <Separator className="my-6" />
            <BurndownSection
              burndownScope={burndownScope}
              setBurndownScope={setBurndownScope}
              phases={phases}
              tasks={tasks}
              sprints={sprints}
              logs={logs}
              project={project}
            />
          </>

        {!isClient && (
          <>
            <Separator className="my-6" />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Status Updates</h3>
              {statusUpdatesLoading ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : statusUpdates.length === 0 ? (
                <p className="text-xs text-muted-foreground">No status updates yet.</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {statusUpdates.map((u: any) => (
                    <div key={u.id} className="flex gap-2 bg-muted/30 rounded-md p-3">
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarImage src={getAvatarUrl(u.author?.full_name)} />
                        <AvatarFallback className="text-[10px]">{u.author?.full_name?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{u.author?.full_name || (u.author_type === "ai" ? "AI" : "Unknown")}</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(u.created_at), "MMM d, h:mm a")}</span>
                          {u.visible_to_client ? (
                            <Eye className="h-3 w-3 text-muted-foreground" title="Visible to client" />
                          ) : (
                            <EyeOff className="h-3 w-3 text-muted-foreground" title="Internal only" />
                          )}
                        </div>
                        <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{u.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-start">
                <Textarea
                  value={newStatusUpdate}
                  onChange={(e) => setNewStatusUpdate(e.target.value)}
                  placeholder="Post a status update..."
                  rows={2}
                  className="text-sm resize-none flex-1"
                />
                <div className="flex flex-col gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Checkbox id="status-update-visible" checked={newStatusUpdateVisible} onCheckedChange={(v) => setNewStatusUpdateVisible(v === true)} />
                    <label htmlFor="status-update-visible" className="text-[10px] cursor-pointer text-muted-foreground">Visible to client</label>
                  </div>
                  <Button type="button" size="sm" onClick={addStatusUpdate} disabled={!newStatusUpdate.trim()} className="shrink-0">Post</Button>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

import React from 'react';
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, Cell, PieChart, Pie } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { LineChart, Line } from "recharts";

export interface ProjectStatsTabProps {
  project: any;
  burndownScope: string;
  setBurndownScope: (s: string) => void;
  sprints: any[];
  tasks: any[];
  logs: any[];
  phases: any[];
  workflowStatuses: any[];
  projectBlockers: any[];
  latestHealth: any;
  hoursByMember: any[];
  categoryBreakdown: any[];
  weeklyLogs: any[];
  healthTrend: any[];
  isAdmin: boolean;
  CHART_COLORS: string[];
  PRIORITY_COLORS: Record<string, string>;
}

export function ProjectStatsTab({
  project,
  burndownScope,
  setBurndownScope,
  sprints,
  tasks,
  logs,
  phases,
  workflowStatuses,
  projectBlockers,
  latestHealth,
  hoursByMember,
  categoryBreakdown,
  weeklyLogs,
  healthTrend,
  isAdmin,
  CHART_COLORS,
  PRIORITY_COLORS,
}: ProjectStatsTabProps) {
  return (
    <>
      
          {/* Health Summary */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Project Health</h3>
            {latestHealth ? (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">Status</span>
                  <Badge className={
                    latestHealth.health_status === "on_track" ? "bg-green-100 text-green-800 mt-1" :
                    latestHealth.health_status === "at_risk" ? "bg-yellow-100 text-yellow-800 mt-1" :
                    "bg-red-100 text-red-800 mt-1"
                  }>
                    {latestHealth.health_status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground block text-xs">Planned</span><span className="font-medium mt-1 block">{Number(latestHealth.planned_hours || 0).toFixed(1)}h</span></div>
                <div><span className="text-muted-foreground block text-xs">Logged</span><span className="font-medium mt-1 block">{Number(latestHealth.logged_hours || 0).toFixed(1)}h</span></div>
                <div><span className="text-muted-foreground block text-xs">Tasks</span><span className="font-medium mt-1 block">{latestHealth.tasks_complete}/{latestHealth.tasks_total}</span></div>
                <div><span className="text-muted-foreground block text-xs">Overdue</span><span className="font-medium mt-1 block">{latestHealth.tasks_overdue}</span></div>
                <div><span className="text-muted-foreground block text-xs">Blockers</span><span className="font-medium mt-1 block">{latestHealth.open_blockers}</span></div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Health data not yet available. Run the health compute job.</p>
            )}
          </Card>

          {/* Burndown (stats version) */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Burndown</h3>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Scope:</label>
                <Select value={burndownScope} onValueChange={setBurndownScope}>
                  <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">Project</SelectItem>
                    {phases.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(() => {
              const scopeTasks = burndownScope === "project"
                ? (tasks || [])
                : (tasks || []).filter((t: any) => {
                    const taskSprint = (sprints || []).find((s: any) => s.id === t.sprint_id);
                    return taskSprint?.phase_id === burndownScope;
                  })
              const estimated = scopeTasks.filter((t: any) => t.estimated_hours != null);
              const unestimated = scopeTasks.filter((t: any) => t.estimated_hours == null);
              const totalEst = estimated.reduce((s: number, t: any) => s + Number(t.estimated_hours), 0);
              const logged = scopeTasks.reduce((s: number, t: any) => {
                const taskLogs = (logs || []).filter((l: any) => l.task_id === t.id);
                return s + taskLogs.reduce((sum: number, l: any) => sum + Number(l.hours), 0);
              }, 0);
              const scopePhase = burndownScope !== "project" ? phases.find((p: any) => p.id === burndownScope) : null;
              const endDate = scopePhase?.due_date || project?.end_date;
              const startDate = project?.start_date;
              if (estimated.length === 0 || !endDate || !startDate) {
                return <p className="text-xs text-muted-foreground">Burndown requires estimated tasks and project dates.</p>;
              }
              const daysTotal = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
              const daysElapsed = Math.max(0, Math.round((Date.now() - new Date(startDate).getTime()) / 86400000));
              const idealPerDay = totalEst / daysTotal;
              const remaining = Math.max(0, totalEst - logged);
              const idealRemaining = Math.max(0, totalEst - idealPerDay * Math.min(daysElapsed, daysTotal));
              const bd = [
                { name: "Start", ideal: totalEst, actual: totalEst },
                { name: "Now", ideal: idealRemaining, actual: remaining },
                { name: "Due", ideal: 0, actual: null },
              ];
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Total: <strong>{totalEst}h</strong></span>
                    <span>Remaining: <strong>{remaining.toFixed(1)}h</strong></span>
                    {unestimated.length > 0 && <span className="text-yellow-600">{unestimated.length} unestimated</span>}
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={bd}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="ideal" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} name="Ideal" />
                      <Line type="monotone" dataKey="actual" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} connectNulls name="Actual" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </Card>

          {/* Hours by Team Member */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Hours by Team Member</h3>
            {hoursByMember.length === 0 ? (
              <p className="text-xs text-muted-foreground">No logged hours yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hoursByMember}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="hours" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Hours by Category */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Hours by Category</h3>
            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">No logged hours yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryBreakdown.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Weekly Hours Trend */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Weekly Hours Trend</h3>
            {weeklyLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No logged hours yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeklyLogs}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="hours" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} name="Hours" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Admin-only reporting sections */}
          {isAdmin && (
            <>
              {/* Overdue Tasks */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Overdue Tasks</h3>
                {(() => {
                  const overdue = (tasks || []).filter((t: any) => {
                    if (!t.due_date) return false;
                    const ws = workflowStatuses?.find((s: any) => s.id === t.status_id);
                    return new Date(t.due_date) < new Date() && ws?.category !== "done";
                  });
                  if (overdue.length === 0) return <p className="text-xs text-muted-foreground">No overdue tasks.</p>;
                  return (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {overdue.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between bg-red-50 rounded-md p-2.5">
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{t.title}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              Due {format(new Date(t.due_date + "T00:00:00"), "MMM d")}
                              {t.estimated_hours && ` · ${t.estimated_hours}h est.`}
                            </span>
                          </div>
                          <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Card>

              {/* Blocker Stats */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Blocker Summary</h3>
                {projectBlockers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No blockers reported.</p>
                ) : (() => {
                  const openBlockers = projectBlockers.filter((b: any) => b.status === "open");
                  const resolvedBlockers = projectBlockers.filter((b: any) => b.status === "resolved");
                  const avgResolutionDays = resolvedBlockers.length > 0
                    ? resolvedBlockers.reduce((sum: number, b: any) => {
                        if (!b.resolved_at || !b.raised_at) return sum;
                        return sum + (new Date(b.resolved_at).getTime() - new Date(b.raised_at).getTime()) / 86400000;
                      }, 0) / resolvedBlockers.length
                    : null;
                  const blockersByMonth = Object.entries(
                    projectBlockers.reduce((acc: Record<string, number>, b: any) => {
                      const month = format(new Date(b.raised_at), "MMM yyyy");
                      acc[month] = (acc[month] || 0) + 1;
                      return acc;
                    }, {})
                  ).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-6 text-sm">
                        <div><span className="text-muted-foreground text-xs block">Open</span><span className="font-medium">{openBlockers.length}</span></div>
                        <div><span className="text-muted-foreground text-xs block">Resolved</span><span className="font-medium">{resolvedBlockers.length}</span></div>
                        <div><span className="text-muted-foreground text-xs block">Avg resolution</span><span className="font-medium">{avgResolutionDays !== null ? `${avgResolutionDays.toFixed(1)}d` : "—"}</span></div>
                      </div>
                      {blockersByMonth.length > 1 && (
                        <ResponsiveContainer width="100%" height={150}>
                          <BarChart data={blockersByMonth}>
                            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip contentStyle={{ fontSize: 12 }} />
                            <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  );
                })()}
              </Card>

              {/* Health Trend */}
              {healthTrend.length > 1 && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Health Trend</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {healthTrend.map((s: any) => (
                      <Badge key={s.snapshot_date} className={
                        s.health_status === "on_track" ? "bg-green-100 text-green-800" :
                        s.health_status === "at_risk" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }>
                        {format(new Date(s.snapshot_date + "T00:00:00"), "MMM d")}
                      </Badge>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={healthTrend.map((s: any) => ({
                      date: format(new Date(s.snapshot_date + "T00:00:00"), "MMM d"),
                      score: s.health_status === "on_track" ? 3 : s.health_status === "at_risk" ? 2 : 1,
                    }))}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 4]} ticks={[1, 2, 3]} tickFormatter={(v) => v === 3 ? "On Track" : v === 2 ? "At Risk" : "Delayed"} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name="Health" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </>
          )}
        
    </>
  );
}
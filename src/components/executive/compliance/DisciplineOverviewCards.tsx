import React from "react";
import { AnalyticsChartCard } from "@/components/analytics/AnalyticsChartCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ShieldCheck, LogOut, CheckSquare, AlertTriangle } from "lucide-react";

interface DisciplineOverviewCardsProps {
  autoClockOuts: number;
  standupAdherence: number;
  lateLogs: number;
  missedLogs: number;
  onTimeLogs: number;
  wfhCount: number;
  officeCount: number;
}

const WFH_COLORS = ["#3b82f6", "#8b5cf6"];

export function DisciplineOverviewCards({
  autoClockOuts,
  standupAdherence,
  lateLogs,
  missedLogs,
  onTimeLogs,
  wfhCount,
  officeCount,
}: DisciplineOverviewCardsProps) {
  const logData = [
    { name: "On-Time", count: onTimeLogs },
    { name: "Late Submission", count: lateLogs },
    { name: "Missed", count: missedLogs },
  ];

  const workModeData = [
    { name: "In Office / Onsite", value: officeCount },
    { name: "Remote / WFH", value: wfhCount },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Auto Clock-Outs</span>
            <div className="p-1 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/40">
              <LogOut className="h-4 w-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{autoClockOuts}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Sessions auto-closed at midnight</p>
          </div>
          <div className="pt-2 border-t text-[11px] flex justify-between items-center text-muted-foreground">
            <span>Target: 0 unacknowledged</span>
            <Badge variant="outline" className="text-[9.5px]">Policy Monitored</Badge>
          </div>
        </Card>

        <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Standup Adherence</span>
            <div className="p-1 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
              <CheckSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{standupAdherence}%</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Daily updates submitted on time</p>
          </div>
          <div className="pt-2 border-t text-[11px] flex justify-between items-center text-muted-foreground">
            <span>Target: &gt; 90%</span>
            <Badge variant="outline" className="text-[9.5px] bg-emerald-50 text-emerald-700 border-emerald-200">
              {standupAdherence >= 90 ? "Target Met" : "Warning"}
            </Badge>
          </div>
        </Card>

        <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Late Log Submissions</span>
            <div className="p-1 rounded-md bg-rose-50 text-rose-600 dark:bg-rose-950/40">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{lateLogs}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Submitted after shift cutoff</p>
          </div>
          <div className="pt-2 border-t text-[11px] flex justify-between items-center text-muted-foreground">
            <span>Target: &lt; 5% total</span>
            <Badge variant="outline" className="text-[9.5px]">Audited</Badge>
          </div>
        </Card>

        <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Security Audit Status</span>
            <div className="p-1 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/40">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-600">Secure</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Zero brute-force clusters detected</p>
          </div>
          <div className="pt-2 border-t text-[11px] flex justify-between items-center text-muted-foreground">
            <span>Lockout window active</span>
            <Badge variant="outline" className="text-[9.5px] bg-emerald-50 text-emerald-700 border-emerald-200">Protected</Badge>
          </div>
        </Card>
      </div>

      {/* 2 Charts: Log Submission Timing & WFH vs Office Policy Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Log Breakdown */}
        <AnalyticsChartCard
          question="How consistently do team members submit logs on time vs late?"
          title="Daily Log Punctuality & Compliance"
          subtitle="Distribution of log submissions against the daily deadline"
          formula="Count of logs grouped by submission timeliness flag"
          target="> 95% On-Time"
          targetMet={lateLogs + missedLogs === 0}
          tableContent={
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 font-medium">Status</th>
                  <th className="py-1.5 font-medium text-right">Logs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {logData.map((d, i) => (
                  <tr key={i}>
                    <td className="py-1.5 font-semibold">{d.name}</td>
                    <td className="py-1.5 text-right font-mono">{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={logData} margin={{ top: 15, right: 15, bottom: 5, left: -15 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsChartCard>

        {/* WFH Usage vs Office Mix */}
        <AnalyticsChartCard
          question="Is remote work being utilized in balance with office policy?"
          title="Work Location Usage (Onsite vs. Remote)"
          subtitle="Cumulative ratio of onsite attendance vs. approved remote/WFH days"
          formula="Count(onsite) vs Count(remote) from attendance table"
          target="Policy Compliant"
          targetMet={true}
          tableContent={
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 font-medium">Mode</th>
                  <th className="py-1.5 font-medium text-right">Attendance Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                <tr>
                  <td className="py-1.5 font-semibold text-blue-600">In Office / Onsite</td>
                  <td className="py-1.5 text-right font-mono">{officeCount}</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-semibold text-purple-600">Remote / WFH</td>
                  <td className="py-1.5 text-right font-mono">{wfhCount}</td>
                </tr>
              </tbody>
            </table>
          }
        >
          <div className="h-52 w-full flex items-center justify-center">
            {workModeData.length === 0 ? (
              <span className="text-xs text-muted-foreground">No attendance records found</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={workModeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {workModeData.map((_, index) => (
                      <Cell key={`cell-wm-${index}`} fill={WFH_COLORS[index % WFH_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </AnalyticsChartCard>
      </div>
    </div>
  );
}


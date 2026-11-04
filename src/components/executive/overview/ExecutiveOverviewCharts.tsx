import React from "react";
import { AnalyticsChartCard } from "@/components/analytics/AnalyticsChartCard";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

interface ExecutiveOverviewChartsProps {
  clientHours: { name: string; hours: number }[];
  categoryHours: { name: string; hours: number }[];
  portfolioHealth: { healthy: number; delayed: number };
  attendanceSplit: { onsite: number; remote: number };
  onDrilldown?: (title: string) => void;
}

const HEALTH_COLORS = ["#10b981", "#ef4444"];
const WORK_MODE_COLORS = ["#3b82f6", "#8b5cf6"];

export function ExecutiveOverviewCharts({
  clientHours,
  categoryHours,
  portfolioHealth,
  attendanceSplit,
  onDrilldown,
}: ExecutiveOverviewChartsProps) {
  const totalProjects = portfolioHealth.healthy + portfolioHealth.delayed;
  const portfolioData = [
    { name: "On Track", value: portfolioHealth.healthy },
    { name: "At Risk / Delayed", value: portfolioHealth.delayed },
  ].filter((d) => d.value > 0);

  const totalAttendance = attendanceSplit.onsite + attendanceSplit.remote;
  const workModeData = [
    { name: "Onsite / Office", value: attendanceSplit.onsite },
    { name: "Remote / WFH", value: attendanceSplit.remote },
  ].filter((d) => d.value > 0);

  return (
    <>
      {/* 1. Portfolio Health Donut */}
      <AnalyticsChartCard
        question="How many active projects are on track vs delayed?"
        title="Project Portfolio Health"
        subtitle="Active projects evaluated against baseline schedule targets"
        formula="(Healthy Projects / Total Active Projects) × 100"
        target="Target: < 15% delayed"
        targetMet={portfolioHealth.delayed === 0}
        onDrilldown={() => onDrilldown?.("Project Portfolio Health")}
        tableContent={
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium text-right">Projects</th>
                <th className="py-2 font-medium text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              <tr>
                <td className="py-2 font-semibold text-emerald-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> On Track
                </td>
                <td className="py-2 text-right font-medium">{portfolioHealth.healthy}</td>
                <td className="py-2 text-right text-muted-foreground">
                  {totalProjects > 0 ? Math.round((portfolioHealth.healthy / totalProjects) * 100) : 0}%
                </td>
              </tr>
              <tr>
                <td className="py-2 font-semibold text-rose-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> At Risk / Delayed
                </td>
                <td className="py-2 text-right font-medium">{portfolioHealth.delayed}</td>
                <td className="py-2 text-right text-muted-foreground">
                  {totalProjects > 0 ? Math.round((portfolioHealth.delayed / totalProjects) * 100) : 0}%
                </td>
              </tr>
            </tbody>
          </table>
        }
      >
        <div className="h-52 w-full flex items-center justify-center">
          {portfolioData.length === 0 ? (
            <span className="text-xs text-muted-foreground">No active projects found</span>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={portfolioData}
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {portfolioData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={HEALTH_COLORS[index % HEALTH_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  iconSize={9}
                  wrapperStyle={{ fontSize: "12px", paddingTop: "6px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </AnalyticsChartCard>

      {/* 2. Today's Workforce Work Mode Distribution */}
      <AnalyticsChartCard
        question="Where is our workforce located today?"
        title="Today's Work Mode Mix"
        subtitle="Breakdown of clocked-in employees by reporting location"
        formula="Count(onsite) vs Count(remote) from today's attendance"
        target="Balanced Hybrid"
        targetMet={true}
        onDrilldown={() => onDrilldown?.("Work Mode Breakdown")}
        tableContent={
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">Mode</th>
                <th className="py-2 font-medium text-right">Employees</th>
                <th className="py-2 font-medium text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              <tr>
                <td className="py-2 font-semibold text-blue-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Onsite / Office
                </td>
                <td className="py-2 text-right font-medium">{attendanceSplit.onsite}</td>
                <td className="py-2 text-right text-muted-foreground">
                  {totalAttendance > 0 ? Math.round((attendanceSplit.onsite / totalAttendance) * 100) : 0}%
                </td>
              </tr>
              <tr>
                <td className="py-2 font-semibold text-purple-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Remote / WFH
                </td>
                <td className="py-2 text-right font-medium">{attendanceSplit.remote}</td>
                <td className="py-2 text-right text-muted-foreground">
                  {totalAttendance > 0 ? Math.round((attendanceSplit.remote / totalAttendance) * 100) : 0}%
                </td>
              </tr>
            </tbody>
          </table>
        }
      >
        <div className="h-52 w-full flex items-center justify-center">
          {workModeData.length === 0 ? (
            <span className="text-xs text-muted-foreground">No employees clocked in today</span>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={workModeData}
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {workModeData.map((_, index) => (
                    <Cell key={`cell-wm-${index}`} fill={WORK_MODE_COLORS[index % WORK_MODE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  iconSize={9}
                  wrapperStyle={{ fontSize: "12px", paddingTop: "6px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </AnalyticsChartCard>

      {/* 3. Hours by Client / Account */}
      <AnalyticsChartCard
        question="Which clients or internal streams consume the most hours?"
        title="Logged Hours by Client"
        subtitle="Total hours billed or allocated during selected range"
        formula="Sum(daily_logs.hours) grouped by client"
        target="Diversified Concentration"
        targetMet={true}
        onDrilldown={() => onDrilldown?.("Client Hours Distribution")}
        tableContent={
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium">Client / Stream</th>
                <th className="py-2 font-medium text-right">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {clientHours.slice(0, 5).map((c, i) => (
                <tr key={i}>
                  <td className="py-2 font-semibold truncate max-w-[200px]">{c.name}</td>
                  <td className="py-2 text-right font-medium">{c.hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <div className="h-52 w-full">
          {clientHours.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No logs recorded in this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={clientHours.slice(0, 5)}
                layout="vertical"
                margin={{ left: 10, right: 20, top: 15, bottom: 5 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={140}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(val: string) => (val.length > 18 ? val.substring(0, 18) + "…" : val)}
                />
                <RechartsTooltip />
                <Bar dataKey="hours" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </AnalyticsChartCard>
    </>
  );
}

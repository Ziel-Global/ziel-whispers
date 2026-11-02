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
  const portfolioData = [
    { name: "On Track", value: portfolioHealth.healthy },
    { name: "At Risk / Delayed", value: portfolioHealth.delayed },
  ].filter((d) => d.value > 0);

  const workModeData = [
    { name: "Onsite / Office", value: attendanceSplit.onsite },
    { name: "Remote / WFH", value: attendanceSplit.remote },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* 1. Portfolio Health Donut */}
      <AnalyticsChartCard
        question="How many active projects are on track vs delayed?"
        title="Project Portfolio Health"
        subtitle="Active projects evaluated against baseline end dates"
        formula="(Healthy Projects / Total Active Projects) × 100"
        target="Target: < 15% delayed"
        targetMet={portfolioHealth.delayed === 0}
        onDrilldown={() => onDrilldown?.("Project Portfolio Health")}
        tableContent={
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 font-medium">Status</th>
                <th className="py-1.5 font-medium text-right">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              <tr>
                <td className="py-1.5 font-semibold text-emerald-600">On Track</td>
                <td className="py-1.5 text-right">{portfolioHealth.healthy}</td>
              </tr>
              <tr>
                <td className="py-1.5 font-semibold text-rose-600">At Risk / Delayed</td>
                <td className="py-1.5 text-right">{portfolioHealth.delayed}</td>
              </tr>
            </tbody>
          </table>
        }
      >
        <div className="h-44 w-full flex items-center justify-center">
          {portfolioData.length === 0 ? (
            <span className="text-xs text-muted-foreground">No active projects</span>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={portfolioData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {portfolioData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={HEALTH_COLORS[index % HEALTH_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </AnalyticsChartCard>

      {/* 2. Today's Workforce Work Mode Distribution */}
      <AnalyticsChartCard
        question="Where is our workforce located today?"
        title="Today's Work Mode Mix"
        subtitle="Breakdown of clocked-in employees by work location"
        formula="Count(onsite) vs Count(remote) from today's attendance"
        target="Balanced Hybrid"
        targetMet={true}
        onDrilldown={() => onDrilldown?.("Work Mode Breakdown")}
        tableContent={
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 font-medium">Mode</th>
                <th className="py-1.5 font-medium text-right">Employees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              <tr>
                <td className="py-1.5 font-semibold text-blue-600">Onsite / Office</td>
                <td className="py-1.5 text-right">{attendanceSplit.onsite}</td>
              </tr>
              <tr>
                <td className="py-1.5 font-semibold text-purple-600">Remote / WFH</td>
                <td className="py-1.5 text-right">{attendanceSplit.remote}</td>
              </tr>
            </tbody>
          </table>
        }
      >
        <div className="h-44 w-full flex items-center justify-center">
          {workModeData.length === 0 ? (
            <span className="text-xs text-muted-foreground">No employees clocked in yet today</span>
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
                    <Cell key={`cell-wm-${index}`} fill={WORK_MODE_COLORS[index % WORK_MODE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
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
        formula="Sum(daily_logs.total_hours) grouped by client"
        target="Diversified Concentration"
        targetMet={true}
        onDrilldown={() => onDrilldown?.("Client Hours Distribution")}
        tableContent={
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 font-medium">Client</th>
                <th className="py-1.5 font-medium text-right">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {clientHours.slice(0, 5).map((c, i) => (
                <tr key={i}>
                  <td className="py-1.5 font-semibold truncate max-w-[120px]">{c.name}</td>
                  <td className="py-1.5 text-right">{c.hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <div className="h-44 w-full">
          {clientHours.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No logs recorded in this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientHours.slice(0, 5)} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Bar dataKey="hours" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </AnalyticsChartCard>
    </div>
  );
}


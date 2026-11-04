import React from "react";
import { AnalyticsChartCard } from "@/components/analytics/AnalyticsChartCard";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from "recharts";

interface ThroughputAndWipChartsProps {
  weeklyThroughput: { week: string; features: number; bugs: number; chores: number; other: number }[];
  wipByStatus: { status: string; count: number; limit: number }[];
}

export function ThroughputAndWipCharts({ weeklyThroughput, wipByStatus }: ThroughputAndWipChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Throughput Trend (Features, Bugs, Chores) */}
      <AnalyticsChartCard
        question="What volume and types of work are teams delivering week-over-week?"
        title="Weekly Delivery Throughput"
        subtitle="Completed work items stacked by item category"
        formula="Count of completed tasks per 7-day period"
        target="Steady or increasing pace"
        targetMet={true}
        tableContent={
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 font-medium">Week</th>
                <th className="py-1.5 font-medium text-right">Features</th>
                <th className="py-1.5 font-medium text-right">Bugs</th>
                <th className="py-1.5 font-medium text-right">Chores</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {weeklyThroughput.map((w, i) => (
                <tr key={i}>
                  <td className="py-1.5 font-semibold">{w.week}</td>
                  <td className="py-1.5 text-right text-emerald-600">{w.features}</td>
                  <td className="py-1.5 text-right text-rose-600">{w.bugs}</td>
                  <td className="py-1.5 text-right text-blue-600">{w.chores}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <div className="h-56 w-full">
          {weeklyThroughput.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No completed tasks found in recent period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyThroughput} margin={{ top: 15, right: 15, bottom: 5, left: -15 }}>
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RechartsTooltip />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Bar dataKey="features" name="Features" stackId="a" fill="#10b981" />
                <Bar dataKey="bugs" name="Bugs / Fixes" stackId="a" fill="#ef4444" />
                <Bar dataKey="chores" name="Chores / Tasks" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </AnalyticsChartCard>

      {/* 2. Work In Progress (WIP) vs Limits */}
      <AnalyticsChartCard
        question="Where are tasks clustering across the workflow?"
        title="Work In Progress (WIP) by Stage"
        subtitle="Active inventory across workflow stages against suggested WIP guidelines"
        formula="Count of incomplete tasks in each status"
        target="Within WIP limits"
        targetMet={wipByStatus.every((w) => w.count <= w.limit)}
        tableContent={
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 font-medium">Stage</th>
                <th className="py-1.5 font-medium text-right">Active Tasks</th>
                <th className="py-1.5 font-medium text-right">WIP Limit</th>
                <th className="py-1.5 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {wipByStatus.map((w, i) => (
                <tr key={i}>
                  <td className="py-1.5 font-semibold">{w.status}</td>
                  <td className="py-1.5 text-right font-bold">{w.count}</td>
                  <td className="py-1.5 text-right text-muted-foreground">{w.limit}</td>
                  <td className="py-1.5 text-center">
                    <span className={w.count > w.limit ? "text-rose-600 font-bold" : "text-emerald-600"}>
                      {w.count > w.limit ? "Over Limit" : "Healthy"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wipByStatus} margin={{ top: 15, right: 15, bottom: 5, left: -15 }}>
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <RechartsTooltip />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
              <Bar dataKey="count" name="Active Tasks" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AnalyticsChartCard>
    </div>
  );
}


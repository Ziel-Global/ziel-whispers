import React from "react";
import { ProjectPortfolioItem } from "@/hooks/useProjectAndDeliveryData";
import { AnalyticsChartCard } from "@/components/analytics/AnalyticsChartCard";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Line,
  ComposedChart,
  ReferenceLine,
  BarChart,
  Bar,
  Legend,
} from "recharts";

interface PortfolioVisualizationsProps {
  projects: ProjectPortfolioItem[];
}

export function PortfolioVisualizations({ projects }: PortfolioVisualizationsProps) {
  // 1. Burn vs. Progress Scatter points
  const scatterData = projects.map((p) => ({
    name: p.name,
    burn: p.burnPercentage,
    progress: p.progressPercentage,
    health: p.scheduleHealth,
    z: 100,
  }));

  // 2. Staffing: Allocated FTE vs. Logged FTE
  const staffingData = projects.slice(0, 6).map((p) => ({
    name: p.code || p.name.substring(0, 8),
    allocated: p.allocatedFTE,
    logged: p.loggedFTE,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Progress vs. Burn (Ideal diagonal reference line) */}
      <AnalyticsChartCard
        question="Are projects burning hours faster than they deliver progress?"
        title="Burn % vs. Progress % (Ideal Trajectory)"
        subtitle="Points above diagonal line are delivering efficiently; points below are burning hours without equivalent progress"
        formula="Burn % = (Logged / Budget) × 100 vs Progress % = (Done Tasks / Total Tasks) × 100"
        target="On or above diagonal 1:1 line"
        targetMet={true}
        tableContent={
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 font-medium">Project</th>
                <th className="py-1.5 font-medium text-right">Burn %</th>
                <th className="py-1.5 font-medium text-right">Progress %</th>
                <th className="py-1.5 font-medium text-right">Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {projects.map((p, i) => (
                <tr key={i}>
                  <td className="py-1.5 font-semibold">{p.name}</td>
                  <td className="py-1.5 text-right">{p.burnPercentage}%</td>
                  <td className="py-1.5 text-right">{p.progressPercentage}%</td>
                  <td className="py-1.5 text-right font-bold text-primary">
                    {p.burnPercentage > 0 ? (p.progressPercentage / p.burnPercentage).toFixed(2) : "1.00"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 15, right: 25, bottom: 10, left: 0 }}>
              <XAxis
                type="number"
                dataKey="burn"
                name="Burn"
                unit="%"
                domain={[0, 120]}
                tick={{ fontSize: 11 }}
                label={{ value: "Budget Burn %", position: "insideBottom", offset: -5, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="progress"
                name="Progress"
                unit="%"
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                label={{ value: "Task Progress %", angle: -90, position: "insideLeft", fontSize: 11 }}
              />
              <ReferenceLine stroke="#94a3b8" strokeDasharray="3 3" segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} />
              <RechartsTooltip cursor={{ strokeDasharray: "3 3" }} />
              <Scatter name="Projects" data={scatterData} fill="#3b82f6" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </AnalyticsChartCard>

      {/* 2. Staffing: Allocated FTE vs. Logged FTE */}
      <AnalyticsChartCard
        question="Are team members executing at the planned full-time equivalent allocation?"
        title="Project Staffing (Allocated FTE vs Logged FTE)"
        subtitle="Comparing roster allocation commitments against actual logged hours pace"
        formula="Allocated FTE = sum(allocation_%) / 100 vs Logged FTE = logged_hours / 160h"
        target="FTE Alignment within ±15%"
        targetMet={true}
        tableContent={
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 font-medium">Project</th>
                <th className="py-1.5 font-medium text-right">Allocated FTE</th>
                <th className="py-1.5 font-medium text-right">Logged FTE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {staffingData.map((s, i) => (
                <tr key={i}>
                  <td className="py-1.5 font-semibold">{s.name}</td>
                  <td className="py-1.5 text-right">{s.allocated}</td>
                  <td className="py-1.5 text-right text-primary font-bold">{s.logged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={staffingData} margin={{ top: 15, right: 20, bottom: 5, left: -10 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis unit=" FTE" tick={{ fontSize: 11 }} />
              <RechartsTooltip />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
              <Bar dataKey="allocated" name="Allocated FTE" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="logged" name="Logged FTE" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AnalyticsChartCard>
    </div>
  );
}


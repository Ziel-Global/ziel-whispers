import React from "react";
import { AnalyticsChartCard } from "@/components/analytics/AnalyticsChartCard";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";

interface DepartmentUtilizationChartProps {
  departments: {
    department: string;
    loggedHours: number;
    capacityHours: number;
    utilizationRate: number;
    staffCount: number;
  }[];
}

export function DepartmentUtilizationChart({ departments }: DepartmentUtilizationChartProps) {
  return (
    <AnalyticsChartCard
      question="Which departments are operating below or above target capacity?"
      title="Utilization Rate by Department"
      subtitle="Percentage of working capacity logged against standard 80% baseline"
      formula="(Department Logged Hours / Department Net Capacity) × 100"
      target="Target: 75% – 85%"
      targetMet={departments.every((d) => d.utilizationRate >= 70 && d.utilizationRate <= 90)}
      tableContent={
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1.5 font-medium">Department</th>
              <th className="py-1.5 font-medium text-right">Headcount</th>
              <th className="py-1.5 font-medium text-right">Logged</th>
              <th className="py-1.5 font-medium text-right">Capacity</th>
              <th className="py-1.5 font-medium text-right">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {departments.map((d, i) => (
              <tr key={i}>
                <td className="py-1.5 font-semibold">{d.department}</td>
                <td className="py-1.5 text-right">{d.staffCount}</td>
                <td className="py-1.5 text-right">{d.loggedHours}h</td>
                <td className="py-1.5 text-right">{d.capacityHours}h</td>
                <td className="py-1.5 text-right font-bold text-primary">{d.utilizationRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="h-56 w-full">
        {departments.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            No departmental data recorded
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={departments}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis type="number" domain={[0, 120]} unit="%" tick={{ fontSize: 11 }} />
              <YAxis dataKey="department" type="category" width={110} tick={{ fontSize: 11 }} />
              <RechartsTooltip formatter={(val: any) => [`${val}%`, "Utilization"]} />
              <ReferenceLine x={80} stroke="#10b981" strokeDasharray="3 3" label={{ value: "Target (80%)", fill: "#10b981", fontSize: 10, position: "top" }} />
              <Bar dataKey="utilizationRate" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </AnalyticsChartCard>
  );
}


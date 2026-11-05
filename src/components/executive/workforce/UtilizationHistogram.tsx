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
} from "recharts";

interface UtilizationHistogramProps {
  histogram: {
    band: string;
    count: number;
    color: string;
  }[];
}

export function UtilizationHistogram({ histogram }: UtilizationHistogramProps) {
  return (
    <AnalyticsChartCard
      question="What proportion of team members are over or under utilized?"
      title="Utilization Distribution Histogram"
      subtitle="Headcount grouped into 5 capacity load categories"
      formula="Count of active members grouped by utilization rate bracket"
      target="Bell Curve centered on 80%"
      targetMet={true}
      tableContent={
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1.5 font-medium">Band</th>
              <th className="py-1.5 font-medium text-right">Team Members</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {histogram.map((h, i) => (
              <tr key={i}>
                <td className="py-1.5 font-semibold">{h.band}</td>
                <td className="py-1.5 text-right">{h.count} members</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={histogram} margin={{ top: 10, right: 15, left: -15, bottom: 5 }}>
            <XAxis dataKey="band" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <RechartsTooltip formatter={(val: any) => [`${val} staff`, "Headcount"]} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {histogram.map((entry, index) => (
                <Cell key={`cell-hist-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsChartCard>
  );
}


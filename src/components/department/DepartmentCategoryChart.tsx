import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { AnalyticsChartCard } from "@/components/analytics/AnalyticsChartCard";
import { formatDecimal } from "@/lib/utils";

interface CategoryDistributionItem {
  name: string;
  hours: number;
}

interface DepartmentCategoryChartProps {
  data: CategoryDistributionItem[];
  isLoading?: boolean;
}

const CATEGORY_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#64748b", // Slate
];

export function DepartmentCategoryChart({ data, isLoading }: DepartmentCategoryChartProps) {
  const totalHours = data.reduce((sum, item) => sum + item.hours, 0);

  const tableContent = (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 font-medium">Category</th>
            <th className="py-2 text-right font-medium">Hours</th>
            <th className="py-2 text-right font-medium">Share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {data.map((item, idx) => (
            <tr key={item.name} className="hover:bg-black/[0.02]">
              <td className="py-2 font-medium text-foreground flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                />
                {item.name}
              </td>
              <td className="py-2 text-right font-mono text-muted-foreground">{item.hours}h</td>
              <td className="py-2 text-right font-mono font-medium text-foreground">
                {totalHours > 0 ? `${Math.round((item.hours / totalHours) * 100)}%` : "0%"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <AnalyticsChartCard
      question="What activities consume the department's working hours?"
      title="Department Category Breakdown"
      subtitle={`${formatDecimal(totalHours)} total logged hours in period`}
      formula="SUM(hours) grouped by task category"
      target="Development ≥ 65%"
      targetMet={true}
      isLoading={isLoading}
      isEmpty={data.length === 0}
      emptyMessage="No category hours logged for this department yet."
      tableContent={tableContent}
    >
      <div className="h-[220px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <XAxis type="number" unit="h" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 11 }}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0];
                const hrs = p.value as number;
                const pct = totalHours > 0 ? Math.round((hrs / totalHours) * 100) : 0;
                return (
                  <div className="p-2 bg-popover border border-border shadow-md rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-foreground">{p.payload.name}</p>
                    <p className="text-muted-foreground">
                      Hours: <span className="font-mono font-semibold text-foreground">{hrs}h</span> ({pct}%)
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
              {data.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AnalyticsChartCard>
  );
}


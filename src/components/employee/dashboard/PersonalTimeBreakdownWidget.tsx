import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart as PieIcon, BarChart2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

export interface PersonalTimeBreakdownWidgetProps {
  hoursByProject: { project: string; hours: number }[];
  hoursByCategory: { category: string; hours: number }[];
}

const COLORS = [
  "#17171A",
  "#EB5A1E",
  "#3B82F6",
  "#10B981",
  "#8B5CF6",
  "#F59E0B",
  "#EC4899",
  "#64748B",
];

export function PersonalTimeBreakdownWidget({
  hoursByProject,
  hoursByCategory,
}: PersonalTimeBreakdownWidgetProps) {
  const totalProjectHours = hoursByProject.reduce((s, p) => s + p.hours, 0);
  const totalCategoryHours = hoursByCategory.reduce((s, c) => s + c.hours, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Time by Project Donut */}
      <Card className="p-5 border border-black/[0.08] dark:border-white/[0.08] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-foreground" />
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              Time by Project (This Month)
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">{totalProjectHours}h total</span>
        </div>

        {hoursByProject.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
            No project hours logged this month
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4 my-2">
            <div className="w-48 h-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={hoursByProject}
                    dataKey="hours"
                    nameKey="project"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {hoursByProject.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${value} hours`, "Effort"]}
                    contentStyle={{
                      backgroundColor: "rgba(23, 23, 26, 0.95)",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                      border: "none",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 space-y-1.5 w-full overflow-y-auto max-h-48 pr-2">
              {hoursByProject.map((item, idx) => {
                const pct =
                  totalProjectHours > 0
                    ? Math.round((item.hours / totalProjectHours) * 100)
                    : 0;
                return (
                  <div
                    key={item.project}
                    className="flex items-center justify-between text-xs py-0.5 border-b border-black/[0.04] dark:border-white/[0.04]"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="truncate text-foreground font-medium">
                        {item.project}
                      </span>
                    </div>
                    <span className="text-muted-foreground shrink-0 font-medium">
                      {item.hours}h ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* 2. Time by Category (Meeting vs Rework vs Dev) */}
      <Card className="p-5 border border-black/[0.08] dark:border-white/[0.08] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-foreground" />
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              Work Mix by Category
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">{totalCategoryHours}h total</span>
        </div>

        {hoursByCategory.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
            No work logs logged this month
          </div>
        ) : (
          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={hoursByCategory}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="category"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11 }}
                  width={90}
                />
                <Tooltip
                  formatter={(value: any) => [`${value} hours`, "Hours"]}
                  contentStyle={{
                    backgroundColor: "rgba(23, 23, 26, 0.95)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                    border: "none",
                  }}
                />
                <Bar dataKey="hours" fill="#EB5A1E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = ["#EB5A1E", "#4C57D9", "#1B8A46", "#A9720B", "#7B4DB8", "#1C6FC9", "#E5484D", "#6B6B72"];

type Props = {
  categoryBreakdown: { name: string; value: number }[];
  weeklyLogs: { week: string; hours: number }[];
};

export function AdminTimePanel({ categoryBreakdown, weeklyLogs }: Props) {
  return (
    <div className="space-y-5">
      <div className="mb-0">
        <div className="text-[18px] font-bold text-[#17171A]">Time</div>
        <div className="text-[12.5px] text-[#8B8B92] mt-1">Estimated vs logged time</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white border border-black/[0.08] rounded-[14px] p-5">
          <div className="text-[15px] font-bold text-[#17171A] mb-4">Hours by Category</div>
          {categoryBreakdown.length === 0 ? (
            <p className="text-[13px] text-[#8B8B92]">No logged hours yet.</p>
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryBreakdown.map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 9, border: "1px solid rgba(0,0,0,.08)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-black/[0.08] rounded-[14px] p-5">
          <div className="text-[15px] font-bold text-[#17171A] mb-4">Weekly Hours Trend</div>
          {weeklyLogs.length === 0 ? (
            <p className="text-[13px] text-[#8B8B92]">No logged hours yet.</p>
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyLogs}>
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10, fill: "#8B8B92" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#8B8B92" }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 9, border: "1px solid rgba(0,0,0,.08)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="#EB5A1E"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#EB5A1E" }}
                    name="Hours"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

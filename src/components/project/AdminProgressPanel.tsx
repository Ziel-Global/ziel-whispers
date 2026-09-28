import { format } from "date-fns";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { healthPill } from "@/lib/adminProjectNav";

type Props = {
  latestHealth: any;
  hoursByMember: { name: string; hours: number }[];
  healthTrend: any[];
  progressPct: number;
};

export function AdminProgressPanel({
  latestHealth,
  hoursByMember,
  healthTrend,
  progressPct,
}: Props) {
  const loggedTotal = (hoursByMember || []).reduce((s, m) => s + Number(m.hours || 0), 0);
  const plannedHours = Number(latestHealth?.planned_hours || 0);
  const tasksTotal = Number(latestHealth?.tasks_total || 0);
  const overdue = Number(latestHealth?.tasks_overdue || 0);
  const deliveryPct =
    latestHealth && tasksTotal > 0
      ? Math.max(0, Math.min(100, Math.round(100 - (100 * overdue) / Math.max(tasksTotal, 1))))
      : null;

  const tiles = [
    {
      label: "Progress",
      value: `${Math.round(progressPct)}%`,
      sub:
        latestHealth != null
          ? `${latestHealth.tasks_complete ?? 0}/${latestHealth.tasks_total ?? 0} tasks`
          : "Phase average",
    },
    {
      label: "Workload",
      value: `${Math.round(loggedTotal * 10) / 10}h`,
      sub: "Hours logged",
    },
    {
      label: "Time",
      value: latestHealth != null ? `${plannedHours.toFixed(1)}h` : "—",
      sub: "Planned hours",
    },
    {
      label: "Delivery",
      value: deliveryPct != null ? `${deliveryPct}%` : "—",
      sub: overdue > 0 ? `${overdue} overdue` : "On schedule",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="text-[18px] font-bold text-[#17171A]">Progress</div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="bg-white border border-black/[0.08] rounded-[14px] p-5 min-w-0"
          >
            <div className="text-xs font-semibold text-[#8B8B92]">{t.label}</div>
            <div className="text-[26px] font-bold text-[#17171A] mt-2 leading-none">{t.value}</div>
            <div className="text-[11.5px] text-[#8B8B92] mt-2.5">{t.sub}</div>
          </div>
        ))}
      </div>

      {healthTrend.length > 1 && (
        <div className="bg-white border border-black/[0.08] rounded-[14px] p-5">
          <div className="text-[15px] font-bold text-[#17171A] mb-4">Health Trend</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {healthTrend.map((s: any) => {
              const pill = healthPill(s.health_status);
              return (
                <span
                  key={s.snapshot_date}
                  className="text-[11px] font-bold px-[9px] py-[3px] rounded-full"
                  style={{ background: pill.bg, color: pill.color }}
                >
                  {format(new Date(s.snapshot_date + "T00:00:00"), "MMM d")}
                </span>
              );
            })}
          </div>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={healthTrend.map((s: any) => ({
                  date: format(new Date(s.snapshot_date + "T00:00:00"), "MMM d"),
                  score: s.health_status === "on_track" ? 3 : s.health_status === "at_risk" ? 2 : 1,
                }))}
              >
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8B8B92" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#8B8B92" }}
                  domain={[0, 4]}
                  ticks={[1, 2, 3]}
                  tickFormatter={(v) => (v === 3 ? "On Track" : v === 2 ? "At Risk" : "Delayed")}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 9, border: "1px solid rgba(0,0,0,.08)" }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#EB5A1E"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#EB5A1E" }}
                  name="Health"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

import { format } from "date-fns";
import {
  Area,
  Bar,
  BarChart,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeBurndownData } from "@/lib/projectBurndown";

type Props = {
  project: any;
  burndownScope: string;
  setBurndownScope: (s: string) => void;
  sprints: any[];
  tasks: any[];
  logs: any[];
  phases: any[];
  workflowStatuses: any[];
  projectBlockers: any[];
  PRIORITY_COLORS: Record<string, string>;
};

const cardClass = "bg-white border border-black/[0.08] rounded-[14px] p-5";
const titleClass = "text-[15px] font-bold text-[#17171A] mb-4";
const mutedClass = "text-[13px] text-[#8B8B92]";

export function AdminDeliveryPanel({
  project,
  burndownScope,
  setBurndownScope,
  sprints,
  tasks,
  logs,
  phases,
  workflowStatuses,
  projectBlockers,
  PRIORITY_COLORS,
}: Props) {
  const burndown = computeBurndownData({
    burndownScope,
    phases,
    tasks,
    sprints,
    logs,
    project,
  });

  const overdueTasks = (tasks || []).filter((t: any) => {
    if (!t.due_date) return false;
    const ws = workflowStatuses?.find((s: any) => s.id === t.status_id);
    return new Date(t.due_date) < new Date() && ws?.category !== "done" && !t.completed_at;
  });

  const openBlockers = (projectBlockers || []).filter((b: any) => b.status === "open");
  const resolvedBlockers = (projectBlockers || []).filter((b: any) => b.status === "resolved");
  const avgResolutionDays =
    resolvedBlockers.length > 0
      ? resolvedBlockers.reduce((sum: number, b: any) => {
          if (!b.resolved_at || !b.raised_at) return sum;
          return sum + (new Date(b.resolved_at).getTime() - new Date(b.raised_at).getTime()) / 86400000;
        }, 0) / resolvedBlockers.length
      : null;
  const blockersByMonth = Object.entries(
    (projectBlockers || []).reduce((acc: Record<string, number>, b: any) => {
      if (!b.raised_at) return acc;
      const month = format(new Date(b.raised_at), "MMM yyyy");
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {})
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[18px] font-bold text-[#17171A]">Delivery</div>
        <div className="text-[12.5px] text-[#8B8B92] mt-1">
          On-time completion and schedule health
        </div>
      </div>

      {/* Burndown */}
      <div className={cardClass + " p-6"}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
          <div className="text-[15px] font-bold text-[#17171A] mb-0">Burndown</div>
          <div className="flex items-center gap-2 text-[13px] text-[#4B4B52]">
            Scope:
            <Select value={burndownScope} onValueChange={setBurndownScope}>
              <SelectTrigger className="h-auto w-auto min-w-[120px] border border-black/10 rounded-[9px] px-3 py-[7px] font-semibold text-[13px] gap-1.5 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project">Project</SelectItem>
                {(phases || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title || p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {"error" in burndown ? (
          <p className={mutedClass}>{burndown.error}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[#8B8B92] mb-3">
              <span>
                Total: <b className="text-[#4B4B52]">{burndown.totalEst}h</b>
              </span>
              <span>
                Remaining: <b className="text-[#4B4B52]">{Number(burndown.remaining).toFixed(1)}h</b>
              </span>
              {burndown.unestimated.length > 0 && (
                <span className="text-[#C7860F] font-bold">
                  Unestimated: {burndown.unestimated.length}
                </span>
              )}
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={burndown.burndownData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="deliveryBurndownFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EB5A1E" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#EB5A1E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#8B8B92" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#8B8B92" }} axisLine={false} tickLine={false} width={36} />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 9, border: "1px solid rgba(0,0,0,.08)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="none"
                    fill="url(#deliveryBurndownFill)"
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    stroke="#C6C6CC"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Total estimated"
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#EB5A1E"
                    strokeWidth={3}
                    strokeLinecap="round"
                    connectNulls={false}
                    dot={{ r: 5, fill: "#EB5A1E", stroke: "#fff", strokeWidth: 2 }}
                    name="Remaining"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Overdue Tasks */}
      <div className={cardClass}>
        <div className={titleClass}>Overdue Tasks</div>
        {overdueTasks.length === 0 ? (
          <p className={mutedClass}>No overdue tasks.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto overscroll-contain">
            {overdueTasks.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between bg-[#FDECEC] rounded-[10px] px-3 py-2.5 gap-2"
              >
                <div className="min-w-0">
                  <span className="text-[13px] font-semibold text-[#17171A]">{t.title}</span>
                  <span className="text-[12px] text-[#8B8B92] ml-2">
                    Due {format(new Date(t.due_date + "T00:00:00"), "MMM d")}
                    {t.estimated_hours != null && ` · ${t.estimated_hours}h est.`}
                  </span>
                </div>
                {t.priority && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      PRIORITY_COLORS[t.priority] || "bg-[#F6F5F3] text-[#6B6B72]"
                    }`}
                  >
                    {t.priority}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blocker Summary */}
      <div className={cardClass}>
        <div className={titleClass}>Blocker Summary</div>
        {(projectBlockers || []).length === 0 ? (
          <p className={mutedClass}>No blockers reported.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-6 text-[13px]">
              <div>
                <span className="text-[11px] font-semibold text-[#8B8B92] block">Open</span>
                <span className="font-bold text-[#17171A]">{openBlockers.length}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#8B8B92] block">Resolved</span>
                <span className="font-bold text-[#17171A]">{resolvedBlockers.length}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#8B8B92] block">Avg resolution</span>
                <span className="font-bold text-[#17171A]">
                  {avgResolutionDays !== null ? `${avgResolutionDays.toFixed(1)}d` : "—"}
                </span>
              </div>
            </div>
            {blockersByMonth.length > 1 && (
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={blockersByMonth}>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#8B8B92" }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#8B8B92" }}
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 12, borderRadius: 9, border: "1px solid rgba(0,0,0,.08)" }}
                    />
                    <Bar dataKey="count" fill="#EB5A1E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

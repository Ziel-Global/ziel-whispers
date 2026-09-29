import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Camera, Search, TrendingUp, Check, AlertCircle, Clock } from "lucide-react";
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  subDays,
  parseISO,
  startOfWeek,
  endOfWeek,
  addDays,
  max as maxDate,
  min as minDate,
} from "date-fns";
import { getPKTDateString, formatPKTTime, formatTime12h } from "@/hooks/useWorkSettings";
import { CATEGORIES } from "@/utils/logDateUtils";
import html2canvas from "html2canvas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "SQA", "Management", "Sales", "Other"];

function humanizeCategory(cat: string) {
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type UtilStatus = "High" | "Healthy" | "Watch" | "Low";

function utilStatusFromPct(pct: number): UtilStatus {
  if (pct >= 90) return "High";
  if (pct >= 70) return "Healthy";
  if (pct >= 55) return "Watch";
  return "Low";
}

function utilStatusBadgeClass(status: UtilStatus) {
  switch (status) {
    case "High":
      return "bg-[#DFF6E4] text-[#1B8A46] border-0 shadow-none";
    case "Healthy":
      return "bg-[#EAF3FF] text-[#1C6FC9] border-0 shadow-none";
    case "Watch":
      return "bg-[#FDF3E3] text-[#A9720B] border-0 shadow-none";
    default:
      return "bg-[#FDECEC] text-[#C23A3A] border-0 shadow-none";
  }
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function exportCSV(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

async function exportPNG(ref: React.RefObject<HTMLDivElement>, filename: string) {
  if (!ref.current) return;
  const canvas = await html2canvas(ref.current, { backgroundColor: "#ffffff" });
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
}

function getWorkingDays(start: Date, end: Date, workWeek: number = 5) {
  return eachDayOfInterval({ start, end }).filter((d) => {
    const day = d.getDay();
    return day !== 0 && (day !== 6 || workWeek === 6);
  }).length;
}

/** Catmull-Rom → cubic Bezier SVG path for smooth chart curves (mock-style). */
function smoothPath(points: { x: number; y: number }[], tension = 1): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    const [a, b] = points;
    const dx = (b.x - a.x) / 3;
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} C${(a.x + dx).toFixed(1)} ${a.y.toFixed(1)} ${(b.x - dx).toFixed(1)} ${b.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  // Higher tension = stronger pull toward neighbors (smoother mock-like waves)
  const t = 6 / Math.max(0.5, tension);
  let d = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / t;
    const cp1y = p1.y + (p2.y - p0.y) / t;
    const cp2x = p2.x - (p3.x - p1.x) / t;
    const cp2y = p2.y - (p3.y - p1.y) / t;
    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const REPORT_TABS = [
  { value: "utilization", label: "Utilization" },
  { value: "heatmap", label: "Heatmap" },
  { value: "monthly", label: "Monthly Summary" },
  { value: "attendance", label: "Attendance Trends" },
  { value: "logs", label: "Daily Logs" },
  { value: "leave", label: "Leave Report" },
  { value: "missed", label: "Missed Logs" },
] as const;

export default function ReportsPage() {
  const [tab, setTab] = useState("utilization");
  const tabBodyClass =
    "mt-0 flex-1 min-h-0 overflow-y-auto data-[state=inactive]:hidden focus-visible:outline-none";

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-[26px] font-bold tracking-[-0.55px] leading-[1.15] text-[#17171A]">Reports</h1>
        <p className="text-[12px] text-[#8B8B92] mt-[5px] leading-relaxed">
          Workforce, attendance, leave and logging intelligence
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0 overflow-hidden gap-4">
        <TabsList className="flex w-full h-auto gap-1 bg-[#F6F5F3] border border-black/[0.06] rounded-[11px] p-[5px] overflow-x-auto justify-start scrollbar-none shrink-0">
          {REPORT_TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className={cn(
                "h-[34px] px-3.5 rounded-lg text-[11.5px] font-medium text-[#7D7D84] whitespace-nowrap shrink-0 shadow-none",
                "data-[state=active]:bg-[#17171A] data-[state=active]:text-white data-[state=active]:font-bold",
                "hover:text-[#3F3F45] data-[state=inactive]:bg-transparent"
              )}
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="utilization" className={tabBodyClass}><UtilizationReport /></TabsContent>
        <TabsContent value="heatmap" className={tabBodyClass}><HeatmapReport /></TabsContent>
        <TabsContent value="monthly" className={tabBodyClass}><MonthlySummaryReport /></TabsContent>
        <TabsContent value="attendance" className={tabBodyClass}><AttendanceTrendReport /></TabsContent>
        <TabsContent value="logs" className={tabBodyClass}><DailyLogsReport /></TabsContent>
        <TabsContent value="leave" className={tabBodyClass}><LeaveReport /></TabsContent>
        <TabsContent value="missed" className={tabBodyClass}><MissedLogsReport /></TabsContent>
      </Tabs>
    </div>
  );
}

// ——— G3: Utilization ———
function UtilizationReport() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date(getPKTDateString())), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date(getPKTDateString())), "yyyy-MM-dd"));
  const [dept, setDept] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: employees } = useQuery({ queryKey: ["report-employees"], queryFn: async () => { const { data } = await supabase.from("users").select("id, full_name, department, shift_start, shift_end, created_at, working_days").eq("status", "active").neq("role", "admin").order("full_name"); return data || []; } });
  const { data: logs } = useQuery({
    queryKey: ["report-logs", startDate, endDate],
    queryFn: async () => { const { data } = await supabase.from("daily_logs").select("user_id, hours").gte("log_date", startDate).lte("log_date", endDate).eq("status", "submitted"); return data || []; },
  });

  const rows = useMemo(() => {
    if (!employees || !logs) return [];
    const loggedByUser: Record<string, number> = {};
    logs.forEach((l) => { if (l.user_id) loggedByUser[l.user_id] = (loggedByUser[l.user_id] || 0) + Number(l.hours); });

    return employees.map((e) => {
      const effectiveStart = e.created_at && e.created_at.split("T")[0] > startDate ? e.created_at.split("T")[0] : startDate;
      const effectiveEnd = endDate;

      let available = 0;
      if (effectiveStart <= effectiveEnd) {
        const effectiveWorkingDays = getWorkingDays(parseISO(effectiveStart), parseISO(effectiveEnd), e.working_days ?? 5);
        available = effectiveWorkingDays * 8;
      }

      const logged = loggedByUser[e.id] || 0;
      const pct = available > 0 ? (logged / available) * 100 : 0;
      const roundedPct = Math.round(pct);
      const status = utilStatusFromPct(roundedPct);
      return {
        id: e.id,
        name: e.full_name,
        department: e.department || "Other",
        available,
        logged: Math.round(logged * 10) / 10,
        pct: roundedPct,
        status,
        initials: initialsFromName(e.full_name || "?"),
      };
    }).sort((a, b) => b.pct - a.pct);
  }, [employees, logs, startDate, endDate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (dept !== "all" && r.department !== dept) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, dept, statusFilter, search]);

  const periodLabel = useMemo(() => {
    try {
      return format(parseISO(startDate), "MMMM yyyy");
    } catch {
      return startDate;
    }
  }, [startDate]);

  const kpis = useMemo(() => {
    const avg = filtered.length ? Math.round(filtered.reduce((s, r) => s + r.pct, 0) / filtered.length) : 0;
    const healthyHigh = filtered.filter((r) => r.pct >= 70).length;
    const needsAttention = filtered.filter((r) => r.pct < 70).length;
    const availableCapacity = Math.max(
      0,
      Math.round(filtered.reduce((s, r) => s + Math.max(0, r.available - r.logged), 0))
    );
    return { avg, healthyHigh, needsAttention, availableCapacity };
  }, [filtered]);

  const deptUtilRows = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    filtered.forEach((r) => {
      const d = r.department || "Other";
      if (!map[d]) map[d] = { sum: 0, count: 0 };
      map[d].sum += r.pct;
      map[d].count += 1;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, value: Math.round(v.sum / v.count) }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const capacityMix = useMemo(() => {
    const total = filtered.length || 1;
    const healthyHigh = filtered.filter((r) => r.status === "High" || r.status === "Healthy").length;
    const watch = filtered.filter((r) => r.status === "Watch").length;
    const low = filtered.filter((r) => r.status === "Low").length;
    const healthyPct = Math.round((healthyHigh / total) * 100);
    const watchPct = Math.round((watch / total) * 100);
    const lowPct = Math.max(0, 100 - healthyPct - watchPct);
    return { healthyPct, watchPct, lowPct, healthyHigh, watch, low };
  }, [filtered]);

  const donutGradient = `conic-gradient(#17171A 0 ${capacityMix.healthyPct}%, #EB5A1E ${capacityMix.healthyPct}% ${capacityMix.healthyPct + capacityMix.watchPct}%, #E8E8EB ${capacityMix.healthyPct + capacityMix.watchPct}% 100%)`;

  return (
    <div className="space-y-3.5">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {[
          {
            label: "Average Utilization",
            value: `${kpis.avg}%`,
            sub: `Across active employees in ${periodLabel}`,
            icon: TrendingUp,
          },
          {
            label: "Healthy / High",
            value: String(kpis.healthyHigh),
            sub: "Employees above 70% utilization",
            icon: Check,
          },
          {
            label: "Needs Attention",
            value: String(kpis.needsAttention),
            sub: "Employees below 70%",
            icon: AlertCircle,
          },
          {
            label: "Available Capacity",
            value: `${kpis.availableCapacity}h`,
            sub: "Estimated unutilized capacity",
            icon: Clock,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-white border border-black/[0.075] rounded-xl p-3.5 min-w-0"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-[10px] font-semibold text-[#8B8B92] tracking-wide uppercase">{k.label}</div>
              <div className="w-7 h-7 rounded-lg bg-[#F6F5F3] text-[#8B8B92] flex items-center justify-center shrink-0">
                <k.icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-[22px] font-bold tracking-[-0.4px] text-[#17171A] leading-none">{k.value}</div>
            <div className="text-[10px] text-[#96969D] mt-1.5 leading-snug">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2.5 min-w-0">
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Start</div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-[180px] min-w-[180px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">End</div>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-[180px] min-w-[180px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Department</div>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-9 w-[180px] min-w-[180px] text-[12px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Status</div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[160px] min-w-[160px] text-[12px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Healthy">Healthy</SelectItem>
                <SelectItem value="Watch">Watch</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Search employee</div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8B8B92]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee..."
                className="h-9 w-[220px] min-w-[220px] pl-8 text-[12px]"
              />
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-[12px] shrink-0"
          onClick={() =>
            exportCSV(
              filtered.map(({ id: _id, initials: _i, ...r }) => r),
              "utilization.csv"
            )
          }
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          CSV Export
        </Button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
          <div className="mb-3">
            <div className="text-[13px] font-bold text-[#17171A]">Utilization by Department</div>
            <div className="text-[10px] text-[#96969D] mt-0.5">Average logged capacity for the selected period</div>
          </div>
          <div className="text-[8px] text-[#9A9AA0] mb-2 pl-[120px]">Utilization (%) →</div>
          <div className="space-y-2.5">
            {deptUtilRows.length === 0 ? (
              <p className="text-[12px] text-[#8B8B92] py-6 text-center">No department data</p>
            ) : (
              deptUtilRows.map((d) => (
                <div key={d.name} className="flex items-center gap-2.5">
                  <div className="w-[110px] shrink-0 text-[11px] font-medium text-[#55555C] truncate" title={d.name}>
                    {d.name}
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-[#F0F0F2] overflow-hidden min-w-0">
                    <div
                      className="h-full rounded-full bg-[#17171A]"
                      style={{ width: `${Math.min(100, d.value)}%` }}
                    />
                  </div>
                  <div className="w-10 text-right text-[11px] font-semibold text-[#333338]">{d.value}%</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
          <div className="mb-3">
            <div className="text-[13px] font-bold text-[#17171A]">Capacity Mix</div>
            <div className="text-[10px] text-[#96969D] mt-0.5">How available hours are currently distributed</div>
          </div>
          <div className="flex items-center gap-6 flex-wrap justify-center sm:justify-start pt-2">
            <div
              className="relative w-[130px] h-[130px] rounded-full shrink-0"
              style={{ background: filtered.length === 0 ? "#EFEFF2" : donutGradient }}
            >
              <div className="absolute inset-[28px] rounded-full bg-white flex flex-col items-center justify-center shadow-[inset_0_0_0_1px_#F0F0F2]">
                <b className="text-[20px] font-bold text-[#17171A] leading-none">{capacityMix.healthyPct}%</b>
                <span className="text-[9px] text-[#8B8B92] mt-0.5">healthy</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 min-w-[140px]">
              {[
                { label: "Healthy / high", pct: capacityMix.healthyPct, color: "#17171A" },
                { label: "Watch", pct: capacityMix.watchPct, color: "#EB5A1E" },
                { label: "Low", pct: capacityMix.lowPct, color: "#E8E8EB" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-[11px] text-[#55555C]">
                  <i className="w-2 h-2 rounded-full shrink-0 not-italic" style={{ background: s.color }} />
                  <span className="flex-1">{s.label}</span>
                  <b className="text-[11px] font-semibold text-[#17171A]">{s.pct}%</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Team Utilization — matches adm-card / adm-bar-row */}
      <div className="bg-white border border-black/[0.075] rounded-[13px] overflow-hidden min-w-0">
        <div className="px-4 py-3.5 border-b border-black/[0.06] flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold text-[#29292E]">Team Utilization</div>
            <div className="text-[9px] text-[#93939A] mt-0.5 leading-normal">
              Logged hours as a percentage of available capacity
            </div>
          </div>
          <span className="inline-flex items-center justify-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold bg-[#F1F1F3] text-[#66666D] whitespace-nowrap">
            {periodLabel}
          </span>
        </div>
        <div
          className={cn(
            "px-4 py-4",
            filtered.length > 8 && "max-h-[336px] overflow-y-auto"
          )}
        >
          {filtered.length === 0 ? (
            <p className="text-[12px] text-[#8B8B92] py-8 text-center">No employees match the current filters</p>
          ) : (
            filtered.map((r) => (
              <div
                key={r.id}
                className="grid items-center gap-[11px] py-2"
                style={{ gridTemplateColumns: "170px minmax(120px,1fr) 58px 72px" }}
              >
                <div className="text-[10.5px] font-semibold text-[#303035] whitespace-nowrap overflow-hidden text-ellipsis" title={r.name}>
                  {r.name}
                </div>
                <div className="h-2 bg-[#EFEFF1] rounded-full overflow-hidden min-w-0">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, r.pct))}%`,
                      background: r.status === "Watch" ? "#EB5A1E" : "#17171A",
                    }}
                  />
                </div>
                <div className="text-[10px] font-bold text-right text-[#303035]">{r.pct}%</div>
                <div className="text-right">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold whitespace-nowrap",
                      utilStatusBadgeClass(r.status)
                    )}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Utilization Detail — matches adm-card / adm-data-util */}
      <div className="bg-white border border-black/[0.075] rounded-[13px] overflow-hidden min-w-0 mt-0">
        <div className="px-4 py-3.5 border-b border-black/[0.06] flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold text-[#29292E]">Utilization Detail</div>
            <div className="text-[9px] text-[#93939A] mt-0.5 leading-normal">
              Capacity and logged-hours breakdown by employee
            </div>
          </div>
          <span className="inline-flex items-center justify-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold bg-[#F1F1F3] text-[#66666D] whitespace-nowrap">
            {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="p-3.5">
          <div className="border border-black/[0.07] rounded-xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div
                  className={cn(filtered.length > 8 && "max-h-[470px] overflow-y-auto")}
                  style={{ scrollbarGutter: "stable" }}
                >
                  <div
                    className="sticky top-0 z-10 grid items-center gap-3 bg-[#F8F7F6] border-b border-black/[0.07] min-h-[38px] px-[13px] text-[9px] font-bold text-[#A0A0A7] tracking-[0.055em]"
                    style={{ gridTemplateColumns: "minmax(210px,1.4fr) minmax(120px,.8fr) 90px 90px 100px 95px" }}
                  >
                    <div>EMPLOYEE</div>
                    <div>DEPARTMENT</div>
                    <div className="flex w-full justify-center items-center text-center">AVAILABLE</div>
                    <div className="flex w-full justify-center items-center text-center">LOGGED</div>
                    <div className="flex w-full justify-center items-center text-center">UTILIZATION</div>
                    <div className="flex w-full justify-center items-center text-center">STATUS</div>
                  </div>
                  {filtered.length === 0 ? (
                    <div className="text-center text-[12px] text-[#8B8B92] py-8">
                      No employees match the current filters
                    </div>
                  ) : (
                    filtered.map((r) => (
                      <div
                        key={r.id}
                        className="grid items-center gap-3 min-h-[54px] px-[13px] py-2 border-b border-black/[0.05] last:border-b-0 text-[10.5px] text-[#4B4B52] hover:bg-[#FCFBFA]"
                        style={{ gridTemplateColumns: "minmax(210px,1.4fr) minmax(120px,.8fr) 90px 90px 100px 95px" }}
                      >
                        <div className="flex items-center gap-[9px] min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-[#F0F0F2] text-[#55555C] text-[8px] font-bold flex items-center justify-center shrink-0">
                            {r.initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-[#303035] whitespace-nowrap overflow-hidden text-ellipsis">
                              {r.name}
                            </div>
                            <div className="text-[8.5px] text-[#9999A0] mt-0.5">Active employee</div>
                          </div>
                        </div>
                        <div className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">{r.department}</div>
                        <div className="flex w-full justify-center items-center text-center tabular-nums">
                          {r.available}h
                        </div>
                        <div className="flex w-full justify-center items-center text-center tabular-nums">
                          <b className="font-bold text-[#303035]">{r.logged}h</b>
                        </div>
                        <div className="flex w-full justify-center items-center text-center tabular-nums">
                          {r.pct}%
                        </div>
                        <div className="flex w-full justify-center items-center">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold whitespace-nowrap",
                              utilStatusBadgeClass(r.status)
                            )}
                          >
                            {r.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type HeatmapHoursBand = "all" | "0" | "1-6" | "7-9" | ">9";

function heatmapBandForHours(h: number): Exclude<HeatmapHoursBand, "all"> {
  if (h <= 0) return "0";
  if (h <= 6) return "1-6";
  if (h <= 9) return "7-9";
  return ">9";
}

function heatmapCellBg(h: number, isWeekend: boolean, notJoined: boolean) {
  if (isWeekend) return "#F7F7F8";
  if (notJoined) return "#FAFAFB";
  switch (heatmapBandForHours(h)) {
    case "0":
      return "#F0F0F2";
    case "1-6":
      return "#C6F1D1";
    case "7-9":
      return "#72D891";
    default:
      return "#F5C6C7";
  }
}

// ——— G4: Heatmap ———
function HeatmapReport() {
  const heatmapRef = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(getPKTDateString().slice(0, 7));
  const [dept, setDept] = useState("all");
  const [hoursBand, setHoursBand] = useState<HeatmapHoursBand>("all");
  const [search, setSearch] = useState("");

  const start = `${month}-01`;
  const end = format(endOfMonth(parseISO(start)), "yyyy-MM-dd");
  const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
  const gridTemplate = `150px repeat(${days.length}, 20px)`;

  const { data: employees } = useQuery({
    queryKey: ["heatmap-emp", dept],
    queryFn: async () => {
      let q = supabase
        .from("users")
        .select("id, full_name, department, created_at, working_days")
        .eq("status", "active")
        .neq("role", "admin");
      if (dept !== "all") q = q.eq("department", dept);
      const { data } = await q.order("full_name");
      return data || [];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["heatmap-logs", start, end],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("user_id, log_date, hours, is_late")
        .gte("log_date", start)
        .lte("log_date", end)
        .eq("status", "submitted");
      return data || [];
    },
  });

  const grid = useMemo(() => {
    if (!employees || !logs) return [];
    const map: Record<string, Record<string, number>> = {};
    logs.forEach((l) => {
      if (!l.user_id) return;
      if (!map[l.user_id]) map[l.user_id] = {};
      map[l.user_id][l.log_date] = (map[l.user_id][l.log_date] || 0) + Number(l.hours);
    });
    return employees.map((e) => ({
      id: e.id,
      name: e.full_name || "",
      created_at: e.created_at,
      working_days: e.working_days ?? 5,
      hours: map[e.id] || {},
    }));
  }, [employees, logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return grid.filter((row) => {
      if (q && !row.name.toLowerCase().includes(q)) return false;
      if (hoursBand === "all") return true;

      const values = days.map((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        const notJoined = !!(row.created_at && dateStr <= row.created_at.split("T")[0]);
        const isWeekend = d.getDay() === 0 || (d.getDay() === 6 && row.working_days === 5);
        if (notJoined || isWeekend) return null;
        return row.hours[dateStr] || 0;
      });

      if (hoursBand === "0") {
        return values.some((h) => h === 0) || values.every((h) => h === null || h === 0);
      }
      return values.some((h) => h !== null && heatmapBandForHours(h) === hoursBand);
    });
  }, [grid, search, hoursBand, days]);

  const filteredIds = useMemo(() => new Set(filtered.map((r) => r.id)), [filtered]);

  const avgDailySeries = useMemo(() => {
    return days.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      let sum = 0;
      let count = 0;
      filtered.forEach((row) => {
        const notJoined = !!(row.created_at && dateStr <= row.created_at.split("T")[0]);
        const isWeekend = d.getDay() === 0 || (d.getDay() === 6 && row.working_days === 5);
        if (notJoined || isWeekend) return;
        sum += row.hours[dateStr] || 0;
        count += 1;
      });
      return {
        date: d,
        dateStr,
        avg: count > 0 ? sum / count : 0,
      };
    });
  }, [days, filtered]);

  const avgLinePath = useMemo(() => {
    const plot = avgDailySeries.filter((p) => {
      const day = p.date.getDay();
      return day !== 0 && day !== 6;
    });
    if (plot.length === 0) return "";
    const x0 = 48;
    const x1 = 680;
    const y0 = 145;
    const yMax = 9;
    const span = Math.max(1, plot.length - 1);
    return plot
      .map((p, i) => {
        const x = x0 + ((x1 - x0) * i) / span;
        const y = y0 - (Math.min(yMax, p.avg) / yMax) * (y0 - 25);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [avgDailySeries]);

  const lateRate = useMemo(() => {
    if (!logs) return { latePct: 0, onTimePct: 100, late: 0, total: 0 };
    const relevant = logs.filter((l) => l.user_id && filteredIds.has(l.user_id));
    const total = relevant.length;
    if (total === 0) return { latePct: 0, onTimePct: 100, late: 0, total: 0 };
    const late = relevant.filter((l) => l.is_late).length;
    const latePct = Math.round((late / total) * 100);
    return { latePct, onTimePct: 100 - latePct, late, total };
  }, [logs, filteredIds]);

  const lateDonut = `conic-gradient(#EB5A1E 0 ${lateRate.latePct}%, #17171A ${lateRate.latePct}% 100%)`;

  const monthTickLabels = useMemo(() => {
    if (days.length === 0) return [];
    const idxs = [0, Math.floor(days.length * 0.25), Math.floor(days.length * 0.5), Math.floor(days.length * 0.75), days.length - 1];
    const uniq = [...new Set(idxs)];
    return uniq.map((i) => ({
      label: format(days[i], "MMM d"),
      x: 48 + ((680 - 48) * i) / Math.max(1, days.length - 1),
      anchor: i === 0 ? "start" : i === days.length - 1 ? "end" : "middle",
    }));
  }, [days]);

  return (
    <div className="space-y-3.5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2.5 min-w-0">
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Month</div>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 w-[160px] min-w-[160px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Department</div>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-9 w-[180px] min-w-[180px] text-[12px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Hours band</div>
            <Select value={hoursBand} onValueChange={(v) => setHoursBand(v as HeatmapHoursBand)}>
              <SelectTrigger className="h-9 w-[160px] min-w-[160px] text-[12px]">
                <SelectValue placeholder="All hour bands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All hour bands</SelectItem>
                <SelectItem value="0">0h</SelectItem>
                <SelectItem value="1-6">1–6h</SelectItem>
                <SelectItem value="7-9">7–9h</SelectItem>
                <SelectItem value=">9">&gt;9h</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Search employee</div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8B8B92]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee..."
                className="h-9 w-[220px] min-w-[220px] pl-8 text-[12px]"
              />
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-[12px] shrink-0"
          onClick={() => exportPNG(heatmapRef as any, "heatmap.png")}
        >
          <Camera className="h-3.5 w-3.5 mr-1.5" />
          PNG Export
        </Button>
      </div>

      {/* Heatmap card */}
      <div
        ref={heatmapRef}
        className="bg-white border border-black/[0.075] rounded-[13px] overflow-hidden min-w-0"
      >
        <div className="px-4 py-3.5 border-b border-black/[0.06]">
          <div className="text-[12px] font-bold text-[#29292E]">Daily Logged Hours Heatmap</div>
          <div className="text-[9px] text-[#93939A] mt-0.5 leading-normal">
            Spot under-logging, healthy days and unusually high entries at a glance
          </div>
        </div>
        <div className="px-4 py-4">
          <div className="overflow-x-auto max-w-full pb-1.5">
            <div className="w-max">
              <div
                className="grid items-center gap-[3px] mb-1.5"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <div />
                {days.map((d) => (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "text-[7.5px] text-center",
                      d.getDay() === 0 || d.getDay() === 6 ? "text-[#C8C8CE]" : "text-[#A0A0A7]"
                    )}
                  >
                    {format(d, "d")}
                  </div>
                ))}
              </div>
              {filtered.length === 0 ? (
                <p className="text-[12px] text-[#8B8B92] py-10 text-center">No employees match the current filters</p>
              ) : (
                filtered.map((row) => (
                  <div
                    key={row.id}
                    className="grid items-center gap-[3px] mb-[3px]"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    <div
                      className="text-[9px] font-semibold text-[#55555C] whitespace-nowrap overflow-hidden text-ellipsis pr-2.5"
                      title={row.name}
                    >
                      {row.name}
                    </div>
                    {days.map((d) => {
                      const dateStr = format(d, "yyyy-MM-dd");
                      const h = row.hours[dateStr] || 0;
                      const notJoined = !!(row.created_at && dateStr <= row.created_at.split("T")[0]);
                      const isWeekend = d.getDay() === 0 || (d.getDay() === 6 && row.working_days === 5);
                      return (
                        <div
                          key={dateStr}
                          className="w-5 h-5 rounded-[5px]"
                          style={{ background: heatmapCellBg(h, isWeekend, notJoined) }}
                          title={`${row.name} · ${format(d, "MMM d")} · ${notJoined ? "Account Not Created" : `${h}h`}`}
                        />
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 text-[8.5px] text-[#8B8B92]">
            {[
              { label: "0h", color: "#F0F0F2" },
              { label: "1–6h", color: "#C6F1D1" },
              { label: "7–9h", color: "#72D891" },
              { label: ">9h", color: "#F5C6C7" },
            ].map((k) => (
              <div key={k.label} className="flex items-center gap-1.5">
                <i className="w-[9px] h-[9px] rounded-[3px] not-italic shrink-0" style={{ background: k.color }} />
                {k.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
          <div className="mb-3">
            <div className="text-[13px] font-bold text-[#17171A]">Average Daily Logged Hours</div>
            <div className="text-[10px] text-[#96969D] mt-0.5">Selected workforce trend across the month</div>
          </div>
          <div className="h-[180px] w-full">
            <svg viewBox="0 0 700 180" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              <g stroke="#E8E8EB" strokeWidth="1">
                <line x1="48" y1="25" x2="680" y2="25" />
                <line x1="48" y1="62" x2="680" y2="62" />
                <line x1="48" y1="99" x2="680" y2="99" />
                <line x1="48" y1="136" x2="680" y2="136" />
              </g>
              <line x1="48" y1="20" x2="48" y2="145" stroke="#CFCFD5" strokeWidth="1" />
              <line x1="48" y1="145" x2="680" y2="145" stroke="#CFCFD5" strokeWidth="1" />
              <g fill="#A0A0A7" fontSize="9">
                <text x="40" y="139" textAnchor="end">0h</text>
                <text x="40" y="102" textAnchor="end">3h</text>
                <text x="40" y="65" textAnchor="end">6h</text>
                <text x="40" y="28" textAnchor="end">9h</text>
                {monthTickLabels.map((t) => (
                  <text key={t.label + t.x} x={t.x} y="162" textAnchor={t.anchor as "start" | "middle" | "end"}>
                    {t.label}
                  </text>
                ))}
              </g>
              <text
                x="14"
                y="86"
                fill="#A0A0A7"
                fontSize="9"
                transform="rotate(-90 14 86)"
                textAnchor="middle"
              >
                Avg. hours
              </text>
              {avgLinePath ? (
                <path d={avgLinePath} fill="none" stroke="#17171A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
            </svg>
          </div>
        </div>

        <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
          <div className="mb-3">
            <div className="text-[13px] font-bold text-[#17171A]">Late Submission Rate</div>
            <div className="text-[10px] text-[#96969D] mt-0.5">Share of daily logs submitted after cutoff</div>
          </div>
          <div className="flex items-center gap-6 flex-wrap justify-center sm:justify-start pt-2">
            <div
              className="relative w-[130px] h-[130px] rounded-full shrink-0"
              style={{ background: lateRate.total === 0 ? "#EFEFF2" : lateDonut }}
            >
              <div className="absolute inset-[28px] rounded-full bg-white flex flex-col items-center justify-center shadow-[inset_0_0_0_1px_#F0F0F2]">
                <b className="text-[20px] font-bold text-[#17171A] leading-none">{lateRate.latePct}%</b>
                <span className="text-[9px] text-[#8B8B92] mt-0.5">late</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 min-w-[140px]">
              {[
                { label: "On time", pct: lateRate.onTimePct, color: "#17171A" },
                { label: "Late", pct: lateRate.latePct, color: "#EB5A1E" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-[11px] text-[#55555C]">
                  <i className="w-2 h-2 rounded-full shrink-0 not-italic" style={{ background: s.color }} />
                  <span className="flex-1">{s.label}</span>
                  <b className="text-[11px] font-semibold text-[#17171A]">{s.pct}%</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— G5: Monthly Summary ———
function MonthlySummaryReport() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const [selectedUser, setSelectedUser] = useState(isAdmin ? "" : profile?.id || "");
  const [month, setMonth] = useState(format(subDays(startOfMonth(new Date(getPKTDateString())), 1), "yyyy-MM"));
  const [dept, setDept] = useState("all");
  const [projectId, setProjectId] = useState("all");

  const { data: employees } = useQuery({
    queryKey: ["summary-emp"],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, full_name, department, created_at, working_days")
        .eq("status", "active")
        .neq("role", "admin")
        .order("full_name");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: projects } = useQuery({
    queryKey: ["summary-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
  });

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    if (dept === "all") return employees;
    return employees.filter((e) => (e.department || "Other") === dept);
  }, [employees, dept]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!filteredEmployees.length) {
      if (selectedUser) setSelectedUser("");
      return;
    }
    if (!selectedUser || !filteredEmployees.some((e) => e.id === selectedUser)) {
      setSelectedUser(filteredEmployees[0].id);
    }
  }, [isAdmin, filteredEmployees, selectedUser]);

  const userId = isAdmin ? selectedUser : profile?.id;
  const start = `${month}-01`;
  const end = format(endOfMonth(parseISO(start)), "yyyy-MM-dd");
  const monthLabel = format(parseISO(start), "MMMM yyyy");

  const { data: logs } = useQuery({
    queryKey: ["summary-logs", userId, start, end],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("hours, log_date, is_late, category, project_id, projects(name)")
        .eq("user_id", userId!)
        .gte("log_date", start)
        .lte("log_date", end)
        .eq("status", "submitted");
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: leave } = useQuery({
    queryKey: ["summary-leave", userId, start, end],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("start_date, end_date, days_count, leave_types(name)")
        .eq("user_id", userId!)
        .eq("status", "approved")
        .lte("start_date", end)
        .gte("end_date", start);
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: attendance } = useQuery({
    queryKey: ["summary-att", userId, start, end],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("date, work_mode, is_late")
        .eq("user_id", userId!)
        .gte("date", start)
        .lte("date", end);
      return data || [];
    },
    enabled: !!userId,
  });

  const empData = useMemo(() => {
    if (isAdmin) return filteredEmployees.find((e) => e.id === userId) || employees?.find((e) => e.id === userId);
    return {
      id: profile?.id || "",
      full_name: profile?.full_name || "You",
      department: profile?.department || "Other",
      created_at: profile?.created_at,
      working_days: profile?.working_days,
    };
  }, [isAdmin, filteredEmployees, employees, userId, profile]);

  const workWeek = empData?.working_days ?? 5;

  const effectiveStart =
    empData?.created_at && empData.created_at.split("T")[0] > start
      ? empData.created_at.split("T")[0]
      : start;
  const effectiveEnd = end;

  const workingDayList = useMemo(() => {
    if (effectiveStart > effectiveEnd) return [] as Date[];
    return eachDayOfInterval({ start: parseISO(effectiveStart), end: parseISO(effectiveEnd) }).filter((d) => {
      const day = d.getDay();
      return day !== 0 && (day !== 6 || workWeek === 6);
    });
  }, [effectiveStart, effectiveEnd, workWeek]);

  const workingDays = workingDayList.length;
  const expectedHours = workingDays * 8;

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    if (projectId === "all") return logs;
    return logs.filter((l) => l.project_id === projectId);
  }, [logs, projectId]);

  const loggedHours = useMemo(
    () => filteredLogs.reduce((s, l) => s + Number(l.hours), 0),
    [filteredLogs]
  );
  const utilPct = expectedHours > 0 ? Math.round((loggedHours / expectedHours) * 100) : 0;

  const leaveDaySet = useMemo(() => {
    const set = new Set<string>();
    leave?.forEach((l) => {
      const s = maxDate([parseISO(l.start_date), parseISO(start)]);
      const e = minDate([parseISO(l.end_date), parseISO(end)]);
      if (s > e) return;
      eachDayOfInterval({ start: s, end: e }).forEach((d) => set.add(format(d, "yyyy-MM-dd")));
    });
    return set;
  }, [leave, start, end]);

  const leaveDaysCount = useMemo(
    () => workingDayList.filter((d) => leaveDaySet.has(format(d, "yyyy-MM-dd"))).length,
    [workingDayList, leaveDaySet]
  );

  const attendanceByDate = useMemo(() => {
    const map: Record<string, { onsite: boolean; remote: boolean; late: boolean }> = {};
    attendance?.forEach((a) => {
      if (!map[a.date]) map[a.date] = { onsite: false, remote: false, late: false };
      if (a.work_mode === "onsite") map[a.date].onsite = true;
      if (a.work_mode === "remote") map[a.date].remote = true;
      if (a.is_late) map[a.date].late = true;
    });
    return map;
  }, [attendance]);

  const attendanceDays = Object.keys(attendanceByDate).length;
  const presencePct = workingDays > 0 ? Math.round((attendanceDays / workingDays) * 100) : 0;

  const onTimeDays = Object.values(attendanceByDate).filter((d) => !d.late).length;
  const lateDays = Object.values(attendanceByDate).filter((d) => d.late).length;
  const remoteDays = Object.values(attendanceByDate).filter((d) => d.remote).length;

  const logDates = useMemo(() => {
    const set = new Set<string>();
    filteredLogs.forEach((l) => set.add(l.log_date));
    return set;
  }, [filteredLogs]);

  const missedLogs = useMemo(
    () =>
      workingDayList.filter((d) => {
        const ds = format(d, "yyyy-MM-dd");
        if (ds > getPKTDateString()) return false;
        return !logDates.has(ds) && !leaveDaySet.has(ds);
      }).length,
    [workingDayList, logDates, leaveDaySet]
  );

  const attendanceMix = useMemo(() => {
    let onsite = 0;
    let remote = 0;
    let leaveCount = 0;
    let absent = 0;
    workingDayList.forEach((d) => {
      const ds = format(d, "yyyy-MM-dd");
      const att = attendanceByDate[ds];
      if (att?.onsite) onsite += 1;
      else if (att?.remote) remote += 1;
      else if (leaveDaySet.has(ds)) leaveCount += 1;
      else absent += 1;
    });
    const total = workingDays || 1;
    return {
      onsite,
      remote,
      leave: leaveCount,
      absent,
      onsitePct: Math.round((onsite / total) * 100),
      remotePct: Math.round((remote / total) * 100),
      leavePct: Math.round((leaveCount / total) * 100),
      absentPct: Math.max(
        0,
        100 - Math.round((onsite / total) * 100) - Math.round((remote / total) * 100) - Math.round((leaveCount / total) * 100)
      ),
    };
  }, [workingDayList, attendanceByDate, leaveDaySet, workingDays]);

  const mixDonut = `conic-gradient(#17171A 0 ${attendanceMix.onsitePct}%, #4C8DF5 ${attendanceMix.onsitePct}% ${attendanceMix.onsitePct + attendanceMix.remotePct}%, #EB5A1E ${attendanceMix.onsitePct + attendanceMix.remotePct}% ${attendanceMix.onsitePct + attendanceMix.remotePct + attendanceMix.leavePct}%, #E8E8EB ${attendanceMix.onsitePct + attendanceMix.remotePct + attendanceMix.leavePct}% 100%)`;

  const hoursByWeek = useMemo(() => {
    if (effectiveStart > effectiveEnd) return [] as { label: string; expected: number; logged: number }[];
    const monthStart = parseISO(start);
    const monthEnd = parseISO(end);
    const rows: { label: string; expected: number; logged: number }[] = [];
    let cursor = monthStart;
    let weekIdx = 1;
    while (cursor <= monthEnd) {
      const weekStart = maxDate([startOfWeek(cursor, { weekStartsOn: 1 }), monthStart]);
      const weekEnd = minDate([endOfWeek(cursor, { weekStartsOn: 1 }), monthEnd]);
      const weekWorking = eachDayOfInterval({ start: weekStart, end: weekEnd }).filter((d) => {
        const day = d.getDay();
        const ds = format(d, "yyyy-MM-dd");
        if (ds < effectiveStart || ds > effectiveEnd) return false;
        return day !== 0 && (day !== 6 || workWeek === 6);
      });
      const expected = weekWorking.length * 8;
      const logged = filteredLogs
        .filter((l) => l.log_date >= format(weekStart, "yyyy-MM-dd") && l.log_date <= format(weekEnd, "yyyy-MM-dd"))
        .reduce((s, l) => s + Number(l.hours), 0);
      rows.push({
        label: `Week ${weekIdx}`,
        expected,
        logged: Math.round(logged * 10) / 10,
      });
      cursor = addDays(weekEnd, 1);
      weekIdx += 1;
    }
    return rows;
  }, [start, end, effectiveStart, effectiveEnd, workWeek, filteredLogs]);

  const activityRows = useMemo(() => {
    const map: Record<string, number> = {};
    filteredLogs.forEach((l) => {
      const name = l.category || "Other";
      map[name] = (map[name] || 0) + Number(l.hours);
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map)
      .map(([name, hours]) => ({
        name,
        hours: Math.round(hours * 10) / 10,
        pct: Math.round((hours / total) * 100),
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [filteredLogs]);

  const employeeName = empData?.full_name || "Employee";

  const handleExport = () => {
    if (!userId) return;
    exportCSV(
      [
        {
          Employee: employeeName,
          Month: monthLabel,
          Expected: `${expectedHours}h`,
          WorkingDays: workingDays,
          Logged: `${Math.round(loggedHours * 10) / 10}h`,
          Utilization: `${utilPct}%`,
          AttendanceDays: attendanceDays,
          Presence: `${presencePct}%`,
          LeaveDays: leaveDaysCount,
          OnTimeDays: onTimeDays,
          LateDays: lateDays,
          RemoteDays: remoteDays,
          MissedLogs: missedLogs,
          OnsiteDays: attendanceMix.onsite,
          AbsentDays: attendanceMix.absent,
        },
      ],
      "monthly-summary.csv"
    );
  };

  return (
    <div className="space-y-3.5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2.5 min-w-0">
          {isAdmin && (
            <div>
              <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Employee</div>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-9 w-[220px] min-w-[220px] text-[12px]">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {filteredEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Month</div>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 w-[160px] min-w-[160px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          {isAdmin && (
            <div>
              <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Department</div>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="h-9 w-[180px] min-w-[180px] text-[12px]">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Project</div>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-9 w-[200px] min-w-[200px] text-[12px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-[12px] shrink-0"
          disabled={!userId}
          onClick={handleExport}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export Summary
        </Button>
      </div>

      {!userId && (
        <p className="text-[12px] text-[#8B8B92] py-10 text-center">Select an employee to view their summary.</p>
      )}

      {userId && (
        <>
          {/* Hero */}
          <div className="grid grid-cols-2 xl:grid-cols-[1.2fr_repeat(4,minmax(0,0.72fr))] border border-black/[0.07] rounded-xl overflow-hidden bg-white">
            {[
              { label: "Employee", value: employeeName, sub: monthLabel },
              { label: "Expected", value: `${expectedHours}h`, sub: `${workingDays} work days` },
              {
                label: "Logged",
                value: `${Math.round(loggedHours * 10) / 10}h`,
                sub: `${utilPct}% utilization`,
              },
              {
                label: "Attendance",
                value: `${attendanceDays} days`,
                sub: `${presencePct}% presence`,
              },
              { label: "Leave", value: `${leaveDaysCount} days`, sub: "approved" },
            ].map((cell, i) => (
              <div
                key={cell.label}
                className={cn(
                  "p-[15px] min-w-0",
                  i < 4 && "border-r border-black/[0.06]",
                  i === 0 && "col-span-2 xl:col-span-1"
                )}
              >
                <div className="text-[8.5px] text-[#9A9AA0]">{cell.label}</div>
                <div className="text-[17px] font-bold text-[#17171A] mt-1 whitespace-nowrap overflow-hidden text-ellipsis">
                  {cell.value}
                </div>
                <div className="text-[8px] text-[#A0A0A7] mt-0.5">{cell.sub}</div>
              </div>
            ))}
          </div>

          {/* Hours by Week + Attendance Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <div className="bg-white border border-black/[0.075] rounded-[13px] overflow-hidden min-w-0">
              <div className="px-4 py-3.5 border-b border-black/[0.06]">
                <div className="text-[12px] font-bold text-[#29292E]">Hours by Week</div>
                <div className="text-[9px] text-[#93939A] mt-0.5">Logged versus expected working hours</div>
              </div>
              <div className="p-4">
                <div className="h-[210px]">
                {hoursByWeek.length === 0 ? (
                  <p className="text-[12px] text-[#8B8B92] py-10 text-center">No week data</p>
                ) : (
                  <svg viewBox="0 0 700 220" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    {/* Grid */}
                    <g stroke="#E8E8EB" strokeWidth="1">
                      <line x1="55" y1="25" x2="680" y2="25" />
                      <line x1="55" y1="75" x2="680" y2="75" />
                      <line x1="55" y1="125" x2="680" y2="125" />
                      <line x1="55" y1="175" x2="680" y2="175" />
                    </g>
                    <line x1="55" y1="20" x2="55" y2="180" stroke="#CFCFD5" strokeWidth="1" />
                    <line x1="55" y1="180" x2="680" y2="180" stroke="#CFCFD5" strokeWidth="1" />
                    {/* Y ticks — fixed 0/12/24/36 like mock */}
                    <g fill="#A0A0A7" fontSize="10">
                      <text x="47" y="178" textAnchor="end">0h</text>
                      <text x="47" y="128" textAnchor="end">12h</text>
                      <text x="47" y="78" textAnchor="end">24h</text>
                      <text x="47" y="28" textAnchor="end">36h</text>
                    </g>
                    <text
                      x="16"
                      y="104"
                      fill="#A0A0A7"
                      fontSize="9"
                      transform="rotate(-90 16 104)"
                      textAnchor="middle"
                    >
                      Logged hours
                    </text>
                    {/* Overlapping bars: gray expected (back), orange logged (front) */}
                    {(() => {
                      const n = hoursByWeek.length;
                      const plotLeft = 90;
                      const plotRight = 575;
                      const barW = 65;
                      const yBase = 180;
                      const yTop = 25;
                      const yScale = (h: number) => Math.min(36, Math.max(0, h)) / 36;
                      const gap = n <= 1 ? 0 : (plotRight - plotLeft) / (n - 1);
                      return hoursByWeek.map((w, i) => {
                        const x = n === 1 ? (plotLeft + plotRight) / 2 - barW / 2 : plotLeft + gap * i;
                        const expH = yScale(w.expected) * (yBase - yTop);
                        const logH = yScale(w.logged) * (yBase - yTop);
                        return (
                          <g key={w.label}>
                            <title>{`${w.label}: Expected ${w.expected}h, Logged ${w.logged}h`}</title>
                            <rect
                              x={x}
                              y={yBase - expH}
                              width={barW}
                              height={Math.max(0, expH)}
                              rx={5}
                              fill="#E9E9EC"
                            />
                            <rect
                              x={x}
                              y={yBase - logH}
                              width={barW}
                              height={Math.max(0, logH)}
                              rx={5}
                              fill="#EB5A1E"
                            />
                            <text x={x + barW / 2} y={201} textAnchor="middle" fill="#A0A0A7" fontSize="10">
                              {w.label}
                            </text>
                          </g>
                        );
                      });
                    })()}
                  </svg>
                )}
                </div>
                {hoursByWeek.length > 0 && (
                  <div className="flex items-center justify-center gap-4 mt-1.5 text-[8.5px] text-[#8B8B92]">
                    <div className="flex items-center gap-1.5">
                      <i className="w-[9px] h-[9px] rounded-[3px] not-italic shrink-0" style={{ background: "#E9E9EC" }} />
                      Expected
                    </div>
                    <div className="flex items-center gap-1.5">
                      <i className="w-[9px] h-[9px] rounded-[3px] not-italic shrink-0" style={{ background: "#EB5A1E" }} />
                      Logged
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-black/[0.075] rounded-[13px] overflow-hidden min-w-0">
              <div className="px-4 py-3.5 border-b border-black/[0.06]">
                <div className="text-[12px] font-bold text-[#29292E]">Attendance Summary</div>
                <div className="text-[9px] text-[#93939A] mt-0.5">Month-level employee attendance signals</div>
              </div>
              <div className="p-4 grid grid-cols-2 gap-2.5">
                {[
                  { label: "On-time days", value: onTimeDays },
                  { label: "Late days", value: lateDays },
                  { label: "Remote days", value: remoteDays },
                  { label: "Missed logs", value: missedLogs },
                ].map((k) => (
                  <div key={k.label} className="bg-white border border-black/[0.075] rounded-xl p-3.5 min-w-0">
                    <div className="text-[10px] font-semibold text-[#8B8B92] tracking-wide uppercase">{k.label}</div>
                    <div className="text-[22px] font-bold tracking-[-0.4px] text-[#17171A] leading-none mt-2">
                      {k.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Hours by Activity + Attendance Mix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
              <div className="mb-3">
                <div className="text-[13px] font-bold text-[#17171A]">Hours by Activity</div>
                <div className="text-[10px] text-[#96969D] mt-0.5">Where the employee’s logged time is being spent</div>
              </div>
              {activityRows.length === 0 ? (
                <p className="text-[12px] text-[#8B8B92] py-8 text-center">No activity data</p>
              ) : (
                <div className="space-y-3 pt-1">
                  {activityRows.map((row, i) => (
                    <div key={row.name} className="flex items-center gap-2.5">
                      <div className="w-[110px] shrink-0 text-[11px] font-medium text-[#55555C] truncate" title={row.name}>
                        {row.name}
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-[#F0F0F2] overflow-hidden min-w-0">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, row.pct)}%`,
                            background: i === 1 ? "#EB5A1E" : "#17171A",
                          }}
                        />
                      </div>
                      <div className="w-12 text-right text-[11px] font-semibold text-[#333338]">{row.hours}h</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
              <div className="mb-3">
                <div className="text-[13px] font-bold text-[#17171A]">Attendance Mix</div>
                <div className="text-[10px] text-[#96969D] mt-0.5">Presence, remote work and leave days</div>
              </div>
              <div className="flex items-center gap-6 flex-wrap justify-center sm:justify-start pt-2">
                <div
                  className="relative w-[130px] h-[130px] rounded-full shrink-0"
                  style={{ background: workingDays === 0 ? "#EFEFF2" : mixDonut }}
                >
                  <div className="absolute inset-[28px] rounded-full bg-white flex flex-col items-center justify-center shadow-[inset_0_0_0_1px_#F0F0F2]">
                    <b className="text-[20px] font-bold text-[#17171A] leading-none">{workingDays}</b>
                    <span className="text-[9px] text-[#8B8B92] mt-0.5">work days</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 min-w-[140px]">
                  {[
                    { label: "Onsite", value: attendanceMix.onsite, color: "#17171A" },
                    { label: "Remote", value: attendanceMix.remote, color: "#4C8DF5" },
                    { label: "Leave", value: attendanceMix.leave, color: "#EB5A1E" },
                    { label: "Absent", value: attendanceMix.absent, color: "#E8E8EB" },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-[11px] text-[#55555C]">
                      <i className="w-2 h-2 rounded-full shrink-0 not-italic" style={{ background: s.color }} />
                      <span className="flex-1">{s.label}</span>
                      <b className="text-[11px] font-semibold text-[#17171A]">{s.value}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ——— G6: Attendance Trends ———
function AttendanceTrendReport() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState(format(subDays(new Date(getPKTDateString()), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(getPKTDateString());
  const [dept, setDept] = useState("all");
  const [workMode, setWorkMode] = useState("all");
  const [attStatus, setAttStatus] = useState("all");

  const { data: employees } = useQuery({
    queryKey: ["att-trend-emp", dept],
    queryFn: async () => {
      let q = supabase
        .from("users")
        .select("id, full_name, department, shift_start, working_days")
        .eq("status", "active")
        .neq("role", "admin");
      if (dept !== "all") q = q.eq("department", dept);
      const { data } = await q.order("full_name");
      return data || [];
    },
  });

  const { data: attendance } = useQuery({
    queryKey: ["att-trend", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("date, clock_in, work_mode, user_id, is_late")
        .gte("date", startDate)
        .lte("date", endDate);
      return data || [];
    },
  });

  const { data: defaultShiftStart } = useQuery({
    queryKey: ["att-trend-shift-start"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "default_shift_start")
        .maybeSingle();
      return data?.value || "10:00";
    },
  });

  const standardStartHours = useMemo(() => {
    const raw = defaultShiftStart || "10:00";
    const [h, m] = raw.split(":").map(Number);
    if (Number.isNaN(h)) return 10;
    return h + (Number.isNaN(m) ? 0 : m / 60);
  }, [defaultShiftStart]);

  const chartData = useMemo(() => {
    if (!attendance || !employees) return [];
    const empIds = new Set(employees.map((e) => e.id));
    let base = attendance.filter((a) => a.user_id && empIds.has(a.user_id));
    if (workMode !== "all") base = base.filter((a) => a.work_mode === workMode);

    const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) }).filter(
      (d) => d.getDay() !== 0
    );

    return days.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      let dayAtt = base.filter((a) => a.date === dateStr);

      // Status filter for present-row metrics (On Time / Late)
      let statusFiltered = dayAtt;
      if (attStatus === "ontime") statusFiltered = dayAtt.filter((a) => !a.is_late);
      else if (attStatus === "late") statusFiltered = dayAtt.filter((a) => a.is_late);

      const firstClockInsByUser: Record<string, string> = {};
      statusFiltered.forEach((a) => {
        if (
          a.clock_in &&
          a.user_id &&
          (!firstClockInsByUser[a.user_id] || new Date(a.clock_in) < new Date(firstClockInsByUser[a.user_id]))
        ) {
          firstClockInsByUser[a.user_id] = a.clock_in;
        }
      });

      const clockInTimes = Object.values(firstClockInsByUser).map((ci) => {
        const date = new Date(ci);
        return date.getHours() + date.getMinutes() / 60;
      });
      const avgClockIn =
        clockInTimes.length > 0 ? clockInTimes.reduce((s, v) => s + v, 0) / clockInTimes.length : null;

      // Presence always based on any attendance that day (dept + work mode), before status filter
      const presentUsers = new Set(dayAtt.map((a) => a.user_id).filter(Boolean) as string[]);
      const presentCount = presentUsers.size;
      const empCount = employees.length || 1;
      const presenceRate = Math.round((presentCount / empCount) * 100);
      const absentRate = Math.round(((empCount - presentCount) / empCount) * 100);
      const rate = attStatus === "absent" ? absentRate : presenceRate;

      // Unique users per work mode (from status-filtered or all present when All/Absent)
      const modeSource = attStatus === "absent" ? [] : statusFiltered;
      const onsiteUsers = new Set(
        modeSource.filter((a) => a.work_mode === "onsite" && a.user_id).map((a) => a.user_id!)
      );
      const remoteUsers = new Set(
        modeSource.filter((a) => a.work_mode === "remote" && a.user_id).map((a) => a.user_id!)
      );

      return {
        date: format(d, "MMM d"),
        dateStr,
        avgClockIn: avgClockIn === null ? null : Math.round(avgClockIn * 100) / 100,
        rate,
        onsite: onsiteUsers.size,
        remote: remoteUsers.size,
        presentCount,
      };
    });
  }, [attendance, employees, startDate, endDate, workMode, attStatus]);

  const kpis = useMemo(() => {
    const clockDays = chartData.filter((d) => d.avgClockIn !== null && d.avgClockIn > 0);
    const avgClock =
      clockDays.length > 0
        ? clockDays.reduce((s, d) => s + (d.avgClockIn as number), 0) / clockDays.length
        : null;
    const avgRate = chartData.length
      ? Math.round(chartData.reduce((s, d) => s + d.rate, 0) / chartData.length)
      : 0;

    if (!attendance || !employees) {
      return { avgClock, avgRate, remoteShare: 0, lateArrivals: 0, minutesAfter: 0 };
    }
    const empIds = new Set(employees.map((e) => e.id));
    let rows = attendance.filter((a) => a.user_id && empIds.has(a.user_id));
    if (workMode !== "all") rows = rows.filter((a) => a.work_mode === workMode);
    const lateArrivals = rows.filter((a) => a.is_late).length;
    const remoteShare =
      rows.length > 0 ? Math.round((rows.filter((a) => a.work_mode === "remote").length / rows.length) * 100) : 0;
    const minutesAfter =
      avgClock !== null ? Math.max(0, Math.round((avgClock - standardStartHours) * 60)) : 0;
    return { avgClock, avgRate, remoteShare, lateArrivals, minutesAfter };
  }, [chartData, attendance, employees, workMode, standardStartHours]);

  const formatClockDisplay = (hours: number | null) => {
    if (hours === null || hours <= 0) return "—";
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  };

  const remoteYMax = useMemo(() => {
    const m = Math.max(0, ...chartData.map((d) => Math.max(d.onsite, d.remote)));
    return Math.max(30, Math.ceil(m / 10) * 10 || 30);
  }, [chartData]);

  const dateTicks = useMemo(() => {
    if (chartData.length === 0) return [];
    const idxs = [
      0,
      Math.floor(chartData.length * 0.33),
      Math.floor(chartData.length * 0.66),
      chartData.length - 1,
    ];
    return [...new Set(idxs)].map((i) => ({ i, label: chartData[i].date }));
  }, [chartData]);

  const clockInPath = useMemo(() => {
    if (chartData.length === 0) return "";
    const raw = chartData.map((d) =>
      d.avgClockIn !== null && d.avgClockIn > 0 ? (d.avgClockIn as number) : null
    );
    let first = -1;
    let last = -1;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] !== null) {
        if (first === -1) first = i;
        last = i;
      }
    }
    if (first === -1) return "";

    // Fill gaps between first/last known days so the curve is continuous (mock-like wave)
    const values = [...raw] as (number | null)[];
    for (let i = first + 1; i < last; i++) {
      if (values[i] !== null) continue;
      let j = i + 1;
      while (j <= last && values[j] === null) j++;
      const prev = values[i - 1] as number;
      const next = values[j] as number;
      const spanGap = j - (i - 1);
      for (let k = i; k < j; k++) {
        const t = (k - (i - 1)) / spanGap;
        values[k] = prev + (next - prev) * t;
      }
      i = j - 1;
    }

    const x0 = 58;
    const x1 = 680;
    const y0 = 180;
    const yTop = 30;
    const span = Math.max(1, chartData.length - 1);
    const yFor = (h: number) => {
      const clamped = Math.min(12, Math.max(9, h));
      return y0 - ((clamped - 9) / 3) * (y0 - yTop);
    };

    const points: { x: number; y: number }[] = [];
    for (let i = first; i <= last; i++) {
      points.push({
        x: x0 + ((x1 - x0) * i) / span,
        y: yFor(values[i] as number),
      });
    }
    return smoothPath(points, 1.5);
  }, [chartData]);

  const remotePaths = useMemo(() => {
    if (chartData.length === 0) return { line: "", area: "", onsite: "" };
    const x0 = 52;
    const x1 = 970;
    const y0 = 154;
    const yTop = 25;
    const span = Math.max(1, chartData.length - 1);
    const yFor = (v: number) => y0 - (Math.min(remoteYMax, Math.max(0, v)) / remoteYMax) * (y0 - yTop);
    const remotePts = chartData.map((d, i) => {
      const x = x0 + ((x1 - x0) * i) / span;
      return { x, y: yFor(d.remote) };
    });
    const onsitePts = chartData.map((d, i) => {
      const x = x0 + ((x1 - x0) * i) / span;
      return { x, y: yFor(d.onsite) };
    });
    const line = smoothPath(remotePts, 1.5);
    const onsite = smoothPath(onsitePts, 1.5);
    const area =
      line &&
      `${line} L${remotePts[remotePts.length - 1].x.toFixed(1)} ${y0} L${remotePts[0].x.toFixed(1)} ${y0} Z`;
    return { line, area, onsite };
  }, [chartData, remoteYMax]);

  return (
    <div className="space-y-3.5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2.5 min-w-0">
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Start</div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-[180px] min-w-[180px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">End</div>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-[180px] min-w-[180px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Department</div>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-9 w-[180px] min-w-[180px] text-[12px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Work mode</div>
            <Select value={workMode} onValueChange={setWorkMode}>
              <SelectTrigger className="h-9 w-[150px] min-w-[150px] text-[12px]">
                <SelectValue placeholder="All Modes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="onsite">Onsite</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Attendance</div>
            <Select value={attStatus} onValueChange={setAttStatus}>
              <SelectTrigger className="h-9 w-[160px] min-w-[160px] text-[12px]">
                <SelectValue placeholder="All Attendance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Attendance</SelectItem>
                <SelectItem value="ontime">On Time</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-[12px]"
            onClick={() => exportPNG(chartRef as any, "attendance-trend.png")}
          >
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-[12px]"
            onClick={() =>
              exportCSV(
                chartData.map(({ date, avgClockIn, rate, onsite, remote }) => ({
                  Date: date,
                  AvgClockIn: avgClockIn ?? "",
                  Rate: rate,
                  Onsite: onsite,
                  Remote: remote,
                })),
                "attendance-trend.csv"
              )
            }
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            CSV
          </Button>
        </div>
      </div>

      <div ref={chartRef} className="space-y-3.5">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {[
            {
              label: "Average Clock-in",
              value: formatClockDisplay(kpis.avgClock),
              sub:
                kpis.avgClock !== null
                  ? `${kpis.minutesAfter} minute${kpis.minutesAfter !== 1 ? "s" : ""} after standard start`
                  : "No clock-in data",
            },
            {
              label: "Attendance Rate",
              value: `${kpis.avgRate}%`,
              sub: attStatus === "absent" ? "Average daily absence rate" : "Across selected period",
            },
            {
              label: "Remote Share",
              value: `${kpis.remoteShare}%`,
              sub: "Of attended workdays",
            },
            {
              label: "Late Arrivals",
              value: String(kpis.lateArrivals),
              sub: "Across all departments",
            },
          ].map((k) => (
            <div key={k.label} className="bg-white border border-black/[0.075] rounded-xl p-3.5 min-w-0">
              <div className="text-[10px] font-semibold text-[#8B8B92] tracking-wide uppercase">{k.label}</div>
              <div className="text-[22px] font-bold tracking-[-0.4px] text-[#17171A] leading-none mt-2">{k.value}</div>
              <div className="text-[10px] text-[#96969D] mt-1.5 leading-snug">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Clock-in + Attendance Rate */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <div className="bg-white border border-black/[0.075] rounded-[13px] overflow-hidden min-w-0">
            <div className="px-4 py-3.5 border-b border-black/[0.06]">
              <div className="text-[12px] font-bold text-[#29292E]">Average Clock-in Time</div>
              <div className="text-[9px] text-[#93939A] mt-0.5">Daily team arrival trend</div>
            </div>
            <div className="p-4 h-[230px]">
              {chartData.length === 0 || !clockInPath ? (
                <p className="text-[12px] text-[#8B8B92] py-10 text-center">No clock-in data</p>
              ) : (
                <svg viewBox="0 0 700 220" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                  <g stroke="#E8E8EB" strokeWidth="1">
                    <line x1="58" y1="30" x2="680" y2="30" />
                    <line x1="58" y1="80" x2="680" y2="80" />
                    <line x1="58" y1="130" x2="680" y2="130" />
                    <line x1="58" y1="180" x2="680" y2="180" />
                  </g>
                  <line x1="58" y1="25" x2="58" y2="180" stroke="#CFCFD5" strokeWidth="1" />
                  <line x1="58" y1="180" x2="680" y2="180" stroke="#CFCFD5" strokeWidth="1" />
                  <g fill="#A0A0A7" fontSize="10">
                    <text x="50" y="183" textAnchor="end">09:00</text>
                    <text x="50" y="133" textAnchor="end">10:00</text>
                    <text x="50" y="83" textAnchor="end">11:00</text>
                    <text x="50" y="33" textAnchor="end">12:00</text>
                    {dateTicks.map((t, idx) => {
                      const x = 58 + ((680 - 58) * t.i) / Math.max(1, chartData.length - 1);
                      const anchor = idx === 0 ? "start" : idx === dateTicks.length - 1 ? "end" : "middle";
                      return (
                        <text key={t.label + t.i} x={x} y={202} textAnchor={anchor}>
                          {t.label}
                        </text>
                      );
                    })}
                  </g>
                  <text
                    x="16"
                    y="104"
                    fill="#A0A0A7"
                    fontSize="9"
                    transform="rotate(-90 16 104)"
                    textAnchor="middle"
                  >
                    Clock-in time
                  </text>
                  {/* Dashed reference at 10:00 */}
                  <line x1="58" y1="130" x2="680" y2="130" stroke="#BFC0C5" strokeDasharray="5 5" />
                  <path d={clockInPath} fill="none" stroke="#EB5A1E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>

          <div className="bg-white border border-black/[0.075] rounded-[13px] overflow-hidden min-w-0">
            <div className="px-4 py-3.5 border-b border-black/[0.06]">
              <div className="text-[12px] font-bold text-[#29292E]">Daily Attendance Rate</div>
              <div className="text-[9px] text-[#93939A] mt-0.5">
                {attStatus === "absent"
                  ? "Percentage of active employees absent"
                  : "Percentage of active employees present"}
              </div>
            </div>
            <div className="p-4 h-[230px]">
              {chartData.length === 0 ? (
                <p className="text-[12px] text-[#8B8B92] py-10 text-center">No attendance data</p>
              ) : (
                <svg viewBox="0 0 700 220" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                  <g stroke="#E8E8EB" strokeWidth="1">
                    <line x1="54" y1="30" x2="680" y2="30" />
                    <line x1="54" y1="67" x2="680" y2="67" />
                    <line x1="54" y1="105" x2="680" y2="105" />
                    <line x1="54" y1="142" x2="680" y2="142" />
                    <line x1="54" y1="180" x2="680" y2="180" />
                  </g>
                  <line x1="54" y1="25" x2="54" y2="180" stroke="#CFCFD5" strokeWidth="1" />
                  <line x1="54" y1="180" x2="680" y2="180" stroke="#CFCFD5" strokeWidth="1" />
                  <g fill="#A0A0A7" fontSize="10">
                    <text x="46" y="183" textAnchor="end">0%</text>
                    <text x="46" y="145" textAnchor="end">25%</text>
                    <text x="46" y="108" textAnchor="end">50%</text>
                    <text x="46" y="70" textAnchor="end">75%</text>
                    <text x="46" y="33" textAnchor="end">100%</text>
                  </g>
                  <text
                    x="15"
                    y="105"
                    fill="#A0A0A7"
                    fontSize="9"
                    transform="rotate(-90 15 105)"
                    textAnchor="middle"
                  >
                    Attendance rate
                  </text>
                  {(() => {
                    const n = chartData.length;
                    const plotLeft = 65;
                    const plotRight = 640;
                    const barW = Math.min(34, Math.max(8, ((plotRight - plotLeft) / n) * 0.7));
                    const gap = n <= 1 ? 0 : (plotRight - plotLeft) / Math.max(1, n - 1);
                    const y0 = 180;
                    const yTop = 30;
                    const tickIdxs = [
                      0,
                      Math.floor(n * 0.2),
                      Math.floor(n * 0.4),
                      Math.floor(n * 0.6),
                      Math.floor(n * 0.8),
                      n - 1,
                    ];
                    const tickSet = new Set(tickIdxs);
                    return chartData.map((d, i) => {
                      const x = n === 1 ? (plotLeft + plotRight) / 2 - barW / 2 : plotLeft + gap * i - barW / 2;
                      const h = (Math.min(100, Math.max(0, d.rate)) / 100) * (y0 - yTop);
                      return (
                        <g key={d.dateStr}>
                          <title>{`${d.date}: ${d.rate}%`}</title>
                          <rect x={x} y={y0 - h} width={barW} height={Math.max(0, h)} rx={4} fill="#17171A" />
                          {tickSet.has(i) && (
                            <text x={x + barW / 2} y={201} textAnchor="middle" fill="#A0A0A7" fontSize="9">
                              {d.date}
                            </text>
                          )}
                        </g>
                      );
                    });
                  })()}
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Remote vs Onsite */}
        <div className="bg-white border border-black/[0.075] rounded-[13px] overflow-hidden min-w-0">
          <div className="px-4 py-3.5 border-b border-black/[0.06]">
            <div className="text-[12px] font-bold text-[#29292E]">Remote vs Onsite</div>
            <div className="text-[9px] text-[#93939A] mt-0.5">Work-mode mix by day</div>
          </div>
          <div className="p-4">
            <div className="h-[180px]">
              {chartData.length === 0 ? (
                <p className="text-[12px] text-[#8B8B92] py-10 text-center">No work-mode data</p>
              ) : (
                <svg viewBox="0 0 1000 180" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                  <g stroke="#E8E8EB" strokeWidth="1">
                    <line x1="52" y1="25" x2="970" y2="25" />
                    <line x1="52" y1="68" x2="970" y2="68" />
                    <line x1="52" y1="111" x2="970" y2="111" />
                    <line x1="52" y1="154" x2="970" y2="154" />
                  </g>
                  <line x1="52" y1="20" x2="52" y2="154" stroke="#CFCFD5" strokeWidth="1" />
                  <line x1="52" y1="154" x2="970" y2="154" stroke="#CFCFD5" strokeWidth="1" />
                  <g fill="#A0A0A7" fontSize="10">
                    <text x="44" y="157" textAnchor="end">0</text>
                    <text x="44" y="114" textAnchor="end">{Math.round(remoteYMax / 3)}</text>
                    <text x="44" y="71" textAnchor="end">{Math.round((remoteYMax * 2) / 3)}</text>
                    <text x="44" y="28" textAnchor="end">{remoteYMax}</text>
                    {dateTicks.map((t, idx) => {
                      const x = 52 + ((970 - 52) * t.i) / Math.max(1, chartData.length - 1);
                      const anchor = idx === 0 ? "start" : idx === dateTicks.length - 1 ? "end" : "middle";
                      return (
                        <text key={"rv" + t.label + t.i} x={x} y={173} textAnchor={anchor}>
                          {t.label}
                        </text>
                      );
                    })}
                  </g>
                  <text
                    x="15"
                    y="92"
                    fill="#A0A0A7"
                    fontSize="9"
                    transform="rotate(-90 15 92)"
                    textAnchor="middle"
                  >
                    Employees
                  </text>
                  {remotePaths.area && <path d={remotePaths.area} fill="#EAF3FF" />}
                  {remotePaths.line && (
                    <path d={remotePaths.line} fill="none" stroke="#4C8DF5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                  {remotePaths.onsite && (
                    <path d={remotePaths.onsite} fill="none" stroke="#EB5A1E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Daily Logs Report ———
function DailyLogsReport() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(getPKTDateString()), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(getPKTDateString());
  const [empFilter, setEmpFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lateFilter, setLateFilter] = useState("all");

  const { data: employees } = useQuery({
    queryKey: ["dlr-emp"],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("status", "active")
        .neq("role", "admin")
        .order("full_name");
      return data || [];
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["dlr-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["dlr-logs", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("id, log_date, hours, category, is_late, user_id, project_id, users(full_name), projects(name)")
        .gte("log_date", startDate)
        .lte("log_date", endDate)
        .eq("status", "submitted")
        .order("log_date", { ascending: false });
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!logs) return [];
    return logs.filter((l) => {
      if (empFilter !== "all" && l.user_id !== empFilter) return false;
      if (projectFilter !== "all" && l.project_id !== projectFilter) return false;
      if (categoryFilter !== "all" && l.category !== categoryFilter) return false;
      if (lateFilter === "yes" && !l.is_late) return false;
      if (lateFilter === "no" && l.is_late) return false;
      return true;
    });
  }, [logs, empFilter, projectFilter, categoryFilter, lateFilter]);

  const kpis = useMemo(() => {
    const count = filtered.length;
    const totalHours = filtered.reduce((s, l) => s + Number(l.hours), 0);
    const lateCount = filtered.filter((l) => l.is_late).length;
    const latePct = count > 0 ? Math.round((lateCount / count) * 1000) / 10 : 0;
    const avgPerLog = count > 0 ? Math.round((totalHours / count) * 10) / 10 : 0;
    return { count, totalHours: Math.round(totalHours * 10) / 10, lateCount, latePct, avgPerLog };
  }, [filtered]);

  const categoryRows = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((l) => {
      const name = l.category || "other";
      map[name] = (map[name] || 0) + Number(l.hours);
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map)
      .map(([name, hours]) => ({
        name: humanizeCategory(name),
        hours: Math.round(hours * 10) / 10,
        pct: Math.round((hours / total) * 100),
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [filtered]);

  const trendSeries = useMemo(() => {
    if (startDate > endDate) return [] as { date: Date; dateStr: string; label: string; count: number }[];
    const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });
    const counts: Record<string, number> = {};
    filtered.forEach((l) => {
      counts[l.log_date] = (counts[l.log_date] || 0) + 1;
    });
    return days.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      return {
        date: d,
        dateStr,
        label: format(d, "MMM d"),
        count: counts[dateStr] || 0,
      };
    });
  }, [filtered, startDate, endDate]);

  const trendYMax = useMemo(() => {
    const m = Math.max(0, ...trendSeries.map((d) => d.count));
    if (m <= 5) return 5;
    if (m <= 10) return 10;
    if (m <= 15) return 15;
    return Math.ceil(m / 5) * 5;
  }, [trendSeries]);

  const trendPath = useMemo(() => {
    if (trendSeries.length === 0) return "";
    const x0 = 48;
    const x1 = 680;
    const y0 = 145;
    const yTop = 25;
    const span = Math.max(1, trendSeries.length - 1);
    const yFor = (v: number) => y0 - (Math.min(trendYMax, Math.max(0, v)) / trendYMax) * (y0 - yTop);
    return smoothPath(
      trendSeries.map((d, i) => ({
        x: x0 + ((x1 - x0) * i) / span,
        y: yFor(d.count),
      })),
      1.5
    );
  }, [trendSeries, trendYMax]);

  const trendTicks = useMemo(() => {
    if (trendSeries.length === 0) return [];
    const idxs = [
      0,
      Math.floor(trendSeries.length * 0.25),
      Math.floor(trendSeries.length * 0.5),
      Math.floor(trendSeries.length * 0.75),
      trendSeries.length - 1,
    ];
    return [...new Set(idxs)].map((i) => ({ i, label: trendSeries[i].label }));
  }, [trendSeries]);

  const formatHours = (h: number) =>
    h >= 1000 ? `${h.toLocaleString(undefined, { maximumFractionDigits: 1 })}h` : `${h}h`;

  return (
    <div className="space-y-3.5">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {[
          { label: "Logs Submitted", value: String(kpis.count), sub: "Selected period" },
          { label: "Logged Hours", value: formatHours(kpis.totalHours), sub: "Across all projects" },
          {
            label: "Late Logs",
            value: String(kpis.lateCount),
            sub: `${kpis.latePct}% of submissions`,
          },
          {
            label: "Avg. Daily Hours",
            value: `${kpis.avgPerLog}h`,
            sub: "Per submitted log",
          },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-black/[0.075] rounded-xl p-3.5 min-w-0">
            <div className="text-[10px] font-semibold text-[#8B8B92] tracking-wide uppercase">{k.label}</div>
            <div className="text-[22px] font-bold tracking-[-0.4px] text-[#17171A] leading-none mt-2">{k.value}</div>
            <div className="text-[10px] text-[#96969D] mt-1.5 leading-snug">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2.5 min-w-0">
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Start</div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-[180px] min-w-[180px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">End</div>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-[180px] min-w-[180px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Employee</div>
            <Select value={empFilter} onValueChange={setEmpFilter}>
              <SelectTrigger className="h-9 w-[180px] min-w-[180px] text-[12px]">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Project</div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9 w-[200px] min-w-[200px] text-[12px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Category</div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[170px] min-w-[170px] text-[12px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {humanizeCategory(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Late</div>
            <Select value={lateFilter} onValueChange={setLateFilter}>
              <SelectTrigger className="h-9 w-[110px] min-w-[110px] text-[12px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-[12px] shrink-0"
          onClick={() =>
            exportCSV(
              filtered.map((l) => ({
                Date: l.log_date,
                Employee: (l.users as any)?.full_name,
                Project: (l.projects as any)?.name || "",
                Category: l.category,
                Hours: l.hours,
                Late: l.is_late ? "Yes" : "No",
              })),
              "daily-logs.csv"
            )
          }
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          CSV Export
        </Button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
          <div className="mb-3">
            <div className="text-[13px] font-bold text-[#17171A]">Logged Hours by Category</div>
            <div className="text-[10px] text-[#96969D] mt-0.5">Distribution of submitted work across activity types</div>
          </div>
          <div className="text-[8px] text-[#9A9AA0] mb-2 pl-[120px]">Share of logged hours (%) →</div>
          {categoryRows.length === 0 ? (
            <p className="text-[12px] text-[#8B8B92] py-8 text-center">No category data</p>
          ) : (
            <div className="space-y-2.5">
              {categoryRows.map((row, i) => (
                <div key={row.name} className="flex items-center gap-2.5">
                  <div className="w-[110px] shrink-0 text-[11px] font-medium text-[#55555C] truncate" title={row.name}>
                    {row.name}
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-[#F0F0F2] overflow-hidden min-w-0">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, row.pct)}%`,
                        background: i === 1 ? "#EB5A1E" : "#17171A",
                      }}
                    />
                  </div>
                  <div className="w-10 text-right text-[11px] font-semibold text-[#333338]">{row.pct}%</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
          <div className="mb-3">
            <div className="text-[13px] font-bold text-[#17171A]">Daily Submission Trend</div>
            <div className="text-[10px] text-[#96969D] mt-0.5">Number of logs submitted each day</div>
          </div>
          <div className="h-[180px]">
            {trendSeries.length === 0 ? (
              <p className="text-[12px] text-[#8B8B92] py-10 text-center">No trend data</p>
            ) : (
              <svg viewBox="0 0 700 180" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <g stroke="#E8E8EB" strokeWidth="1">
                  <line x1="48" y1="25" x2="680" y2="25" />
                  <line x1="48" y1="62" x2="680" y2="62" />
                  <line x1="48" y1="99" x2="680" y2="99" />
                  <line x1="48" y1="136" x2="680" y2="136" />
                </g>
                <line x1="48" y1="20" x2="48" y2="145" stroke="#CFCFD5" strokeWidth="1" />
                <line x1="48" y1="145" x2="680" y2="145" stroke="#CFCFD5" strokeWidth="1" />
                <g fill="#A0A0A7" fontSize="9">
                  <text x="40" y="139" textAnchor="end">0</text>
                  <text x="40" y="102" textAnchor="end">{Math.round(trendYMax / 3)}</text>
                  <text x="40" y="65" textAnchor="end">{Math.round((trendYMax * 2) / 3)}</text>
                  <text x="40" y="28" textAnchor="end">{trendYMax}</text>
                  {trendTicks.map((t, idx) => {
                    const x = 48 + ((680 - 48) * t.i) / Math.max(1, trendSeries.length - 1);
                    const anchor = idx === 0 ? "start" : idx === trendTicks.length - 1 ? "end" : "middle";
                    return (
                      <text key={t.label + t.i} x={x} y={162} textAnchor={anchor}>
                        {t.label}
                      </text>
                    );
                  })}
                </g>
                <text
                  x="14"
                  y="88"
                  fill="#A0A0A7"
                  fontSize="9"
                  transform="rotate(-90 14 88)"
                  textAnchor="middle"
                >
                  Logs submitted
                </text>
                {trendPath && (
                  <path
                    d={trendPath}
                    fill="none"
                    stroke="#EB5A1E"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-white border border-black/[0.075] rounded-[13px] overflow-hidden min-w-0">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div
              className={cn(filtered.length > 8 && "max-h-[470px] overflow-y-auto")}
              style={{ scrollbarGutter: "stable" }}
            >
              <div
                className="sticky top-0 z-10 grid items-center gap-3 bg-[#F8F7F6] border-b border-black/[0.07] min-h-[38px] px-[13px] text-[9px] font-bold text-[#A0A0A7] tracking-[0.055em]"
                style={{ gridTemplateColumns: "120px minmax(170px,1fr) minmax(210px,1.3fr) 135px 80px 75px" }}
              >
                <div>DATE</div>
                <div>EMPLOYEE</div>
                <div>PROJECT</div>
                <div>CATEGORY</div>
                <div className="text-center">HOURS</div>
                <div className="text-center">LATE</div>
              </div>
              {filtered.length === 0 ? (
                <div className="text-center text-[12px] text-[#8B8B92] py-8">No logs match the current filters</div>
              ) : (
                filtered.map((l) => (
                  <div
                    key={l.id}
                    className="grid items-center gap-3 min-h-[48px] px-[13px] py-2 border-b border-black/[0.05] last:border-b-0 text-[10.5px] text-[#4B4B52] hover:bg-[#FCFBFA]"
                    style={{ gridTemplateColumns: "120px minmax(170px,1fr) minmax(210px,1.3fr) 135px 80px 75px" }}
                  >
                    <div>{format(parseISO(l.log_date), "MMM d, yyyy")}</div>
                    <div className="font-bold text-[#303035] whitespace-nowrap overflow-hidden text-ellipsis">
                      {(l.users as any)?.full_name || "—"}
                    </div>
                    <div className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
                      {(l.projects as any)?.name || "—"}
                    </div>
                    <div>
                      <span className="inline-flex items-center justify-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold bg-[#F1F1F3] text-[#66666D] whitespace-nowrap">
                        {humanizeCategory(l.category || "other")}
                      </span>
                    </div>
                    <div className="text-center font-bold text-[#303035] tabular-nums">{Number(l.hours)}h</div>
                    <div className="flex justify-center">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold whitespace-nowrap",
                          l.is_late ? "bg-[#FDECEC] text-[#C23A3A]" : "bg-[#F1F1F3] text-[#66666D]"
                        )}
                      >
                        {l.is_late ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Leave Report ———
function LeaveReport() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date(getPKTDateString())), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date(getPKTDateString())), "yyyy-MM-dd"));
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dept, setDept] = useState("all");

  const { data: leaveTypes } = useQuery({
    queryKey: ["leave-report-types"],
    queryFn: async () => {
      const { data } = await supabase.from("leave_types").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: requests } = useQuery({
    queryKey: ["leave-report", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("id, start_date, end_date, days_count, status, reason, leave_type_id, user_id, users(full_name, department), leave_types(name)")
        .lte("start_date", endDate)
        .gte("end_date", startDate)
        .order("start_date", { ascending: false });
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!requests) return [];
    return requests.filter((r) => {
      if (typeFilter !== "all" && r.leave_type_id !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      const userDept = (r.users as any)?.department || "Other";
      if (dept !== "all" && userDept !== dept) return false;
      return true;
    });
  }, [requests, typeFilter, statusFilter, dept]);

  const kpis = useMemo(() => {
    const approvedDays = filtered
      .filter((r) => r.status === "approved")
      .reduce((s, r) => s + Number(r.days_count || 0), 0);
    const total = filtered.length;
    const pending = filtered.filter((r) => r.status === "pending").length;
    const approved = filtered.filter((r) => r.status === "approved").length;
    const rejected = filtered.filter((r) => r.status === "rejected").length;
    const decided = approved + rejected;
    const approvalRate = decided > 0 ? Math.round((approved / decided) * 100) : 0;
    return {
      approvedDays: Math.round(approvedDays * 10) / 10,
      total,
      pending,
      approvalRate,
      approved,
      rejected,
    };
  }, [filtered]);

  const typeRows = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((r) => {
      const name = (r.leave_types as any)?.name || "Unknown";
      map[name] = (map[name] || 0) + Number(r.days_count || 0);
    });
    const max = Math.max(1, ...Object.values(map));
    return Object.entries(map)
      .map(([name, days]) => ({
        name,
        days: Math.round(days * 10) / 10,
        pct: Math.round((days / max) * 100),
      }))
      .sort((a, b) => b.days - a.days);
  }, [filtered]);

  const statusMix = useMemo(() => {
    const total = kpis.total || 1;
    const approvedPct = Math.round((kpis.approved / total) * 100);
    const pendingPct = Math.round((kpis.pending / total) * 100);
    const rejectedPct = Math.max(0, 100 - approvedPct - pendingPct);
    return { approvedPct, pendingPct, rejectedPct };
  }, [kpis]);

  const statusDonut =
    kpis.total === 0
      ? "#EFEFF2"
      : `conic-gradient(#17171A 0 ${statusMix.approvedPct}%, #EB5A1E ${statusMix.approvedPct}% ${statusMix.approvedPct + statusMix.pendingPct}%, #E8E8EB ${statusMix.approvedPct + statusMix.pendingPct}% 100%)`;

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-[#DFF6E4] text-[#1B8A46]";
      case "rejected":
        return "bg-[#FDECEC] text-[#C23A3A]";
      case "pending":
        return "bg-[#FDF3E3] text-[#A9720B]";
      default:
        return "bg-[#F1F1F3] text-[#66666D]";
    }
  };

  return (
    <div className="space-y-3.5">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {[
          { label: "Leave Days", value: String(kpis.approvedDays), sub: "Approved in selected period" },
          { label: "Requests", value: String(kpis.total), sub: "Across all types" },
          { label: "Pending", value: String(kpis.pending), sub: "Needs review" },
          { label: "Approval Rate", value: `${kpis.approvalRate}%`, sub: "For selected range" },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-black/[0.075] rounded-xl p-3.5 min-w-0">
            <div className="text-[10px] font-semibold text-[#8B8B92] tracking-wide uppercase">{k.label}</div>
            <div className="text-[22px] font-bold tracking-[-0.4px] text-[#17171A] leading-none mt-2">{k.value}</div>
            <div className="text-[10px] text-[#96969D] mt-1.5 leading-snug">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2.5 min-w-0">
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Start</div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-[180px] min-w-[180px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">End</div>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-[180px] min-w-[180px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Leave Type</div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-[180px] min-w-[180px] text-[12px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {leaveTypes?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Status</div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[160px] min-w-[160px] text-[12px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Department</div>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-9 w-[180px] min-w-[180px] text-[12px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-[12px] shrink-0"
          onClick={() =>
            exportCSV(
              filtered.map((r) => ({
                Employee: (r.users as any)?.full_name,
                Type: (r.leave_types as any)?.name,
                From: r.start_date,
                To: r.end_date,
                Days: r.days_count,
                Status: r.status,
                Department: (r.users as any)?.department || "",
              })),
              "leave-report.csv"
            )
          }
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          CSV Export
        </Button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
          <div className="mb-3">
            <div className="text-[13px] font-bold text-[#17171A]">Leave Days by Type</div>
            <div className="text-[10px] text-[#96969D] mt-0.5">Approved and requested days in the selected period</div>
          </div>
          <div className="text-[8px] text-[#9A9AA0] mb-2 pl-[120px]">Leave days →</div>
          {typeRows.length === 0 ? (
            <p className="text-[12px] text-[#8B8B92] py-8 text-center">No leave type data</p>
          ) : (
            <div className="space-y-2.5">
              {typeRows.map((row, i) => (
                <div key={row.name} className="flex items-center gap-2.5">
                  <div className="w-[110px] shrink-0 text-[11px] font-medium text-[#55555C] truncate" title={row.name}>
                    {row.name}
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-[#F0F0F2] overflow-hidden min-w-0">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, row.pct)}%`,
                        background: i === 1 ? "#EB5A1E" : "#17171A",
                      }}
                    />
                  </div>
                  <div className="w-10 text-right text-[11px] font-semibold text-[#333338]">{row.days}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
          <div className="mb-3">
            <div className="text-[13px] font-bold text-[#17171A]">Request Status</div>
            <div className="text-[10px] text-[#96969D] mt-0.5">Current approval position for leave requests</div>
          </div>
          <div className="flex items-center gap-6 flex-wrap justify-center sm:justify-start pt-2">
            <div className="relative w-[130px] h-[130px] rounded-full shrink-0" style={{ background: statusDonut }}>
              <div className="absolute inset-[28px] rounded-full bg-white flex flex-col items-center justify-center shadow-[inset_0_0_0_1px_#F0F0F2]">
                <b className="text-[20px] font-bold text-[#17171A] leading-none">{kpis.total}</b>
                <span className="text-[9px] text-[#8B8B92] mt-0.5">requests</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 min-w-[140px]">
              {[
                { label: "Approved", value: kpis.approved, color: "#17171A" },
                { label: "Pending", value: kpis.pending, color: "#EB5A1E" },
                { label: "Rejected", value: kpis.rejected, color: "#E8E8EB" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-[11px] text-[#55555C]">
                  <i className="w-2 h-2 rounded-full shrink-0 not-italic" style={{ background: s.color }} />
                  <span className="flex-1">{s.label}</span>
                  <b className="text-[11px] font-semibold text-[#17171A]">{s.value}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-white border border-black/[0.075] rounded-[13px] overflow-hidden min-w-0">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div
              className={cn(filtered.length > 8 && "max-h-[470px] overflow-y-auto")}
              style={{ scrollbarGutter: "stable" }}
            >
              <div
                className="sticky top-0 z-10 grid items-center gap-3 bg-[#F8F7F6] border-b border-black/[0.07] min-h-[38px] px-[13px] text-[9px] font-bold text-[#A0A0A7] tracking-[0.055em]"
                style={{ gridTemplateColumns: "minmax(180px,1.1fr) 150px 125px 125px 80px 100px" }}
              >
                <div>EMPLOYEE</div>
                <div>TYPE</div>
                <div>FROM</div>
                <div>TO</div>
                <div className="text-center">DAYS</div>
                <div className="text-center">STATUS</div>
              </div>
              {filtered.length === 0 ? (
                <div className="text-center text-[12px] text-[#8B8B92] py-8">No leave requests match the current filters</div>
              ) : (
                filtered.map((r) => (
                  <div
                    key={r.id}
                    className="grid items-center gap-3 min-h-[48px] px-[13px] py-2 border-b border-black/[0.05] last:border-b-0 text-[10.5px] text-[#4B4B52] hover:bg-[#FCFBFA]"
                    style={{ gridTemplateColumns: "minmax(180px,1.1fr) 150px 125px 125px 80px 100px" }}
                  >
                    <div className="font-bold text-[#303035] whitespace-nowrap overflow-hidden text-ellipsis">
                      {(r.users as any)?.full_name || "—"}
                    </div>
                    <div className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
                      {(r.leave_types as any)?.name || "—"}
                    </div>
                    <div>{format(parseISO(r.start_date), "MMM d, yyyy")}</div>
                    <div>{format(parseISO(r.end_date), "MMM d, yyyy")}</div>
                    <div className="text-center tabular-nums font-semibold text-[#303035]">{r.days_count}</div>
                    <div className="flex justify-center">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold whitespace-nowrap capitalize",
                          statusBadgeClass(r.status)
                        )}
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ——— Missed Logs Report ———
function MissedLogsReport() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(getPKTDateString()), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(getPKTDateString());
  const [dept, setDept] = useState("all");
  const [repeatFilter, setRepeatFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const todayStr = getPKTDateString();

  const { data: missed } = useQuery({
    queryKey: ["missed-report", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("missed_logs")
        .select("*, users(full_name, department, created_at, working_days)")
        .gte("log_date", startDate)
        .lte("log_date", endDate)
        .order("log_date", { ascending: false });
      return data || [];
    },
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["missed-report-leaves", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("user_id, start_date, end_date, hours")
        .eq("status", "approved")
        .lte("start_date", endDate)
        .gte("end_date", startDate);
      return data || [];
    },
  });

  const { data: dailyLogs = [] } = useQuery({
    queryKey: ["missed-report-logs", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("user_id, log_date, hours")
        .gte("log_date", startDate)
        .lte("log_date", endDate)
        .eq("status", "submitted");
      return data || [];
    },
  });

  const { data: cutoffSetting } = useQuery({
    queryKey: ["missed-report-cutoff"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "default_shift_end")
        .maybeSingle();
      return data?.value || "19:00";
    },
  });

  const baseMissed = useMemo(() => {
    if (!missed) return [];
    return missed.filter((m) => {
      const day = parseISO(m.log_date).getDay();
      const userWd = (m.users as any)?.working_days ?? 5;
      if (day === 0 || (day === 6 && userWd === 5)) return false;

      const createdAtDate = (m.users as any)?.created_at
        ? (m.users as any).created_at.split("T")[0]
        : null;
      if (createdAtDate && m.log_date <= createdAtDate) return false;

      const dayLeave = leaves.find(
        (l: any) =>
          l.user_id === m.user_id && l.start_date <= m.log_date && l.end_date >= m.log_date
      );
      if (dayLeave) {
        if (!dayLeave.hours) return false;
        const userLogsToday = dailyLogs.filter(
          (l: any) => l.user_id === m.user_id && l.log_date === m.log_date
        );
        const loggedHoursToday = userLogsToday.reduce((sum, l: any) => sum + Number(l.hours), 0);
        if (loggedHoursToday + (dayLeave.hours || 0) >= 8) return false;
      }

      return true;
    });
  }, [missed, leaves, dailyLogs]);

  const missCountByUser = useMemo(() => {
    const map: Record<string, number> = {};
    baseMissed.forEach((m) => {
      if (!m.user_id) return;
      map[m.user_id] = (map[m.user_id] || 0) + 1;
    });
    return map;
  }, [baseMissed]);

  const filteredMissed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseMissed.filter((m) => {
      const userDept = (m.users as any)?.department || "Other";
      if (dept !== "all" && userDept !== dept) return false;
      const name = ((m.users as any)?.full_name || "").toLowerCase();
      if (q && !name.includes(q)) return false;
      const count = m.user_id ? missCountByUser[m.user_id] || 0 : 0;
      if (repeatFilter === "1" && count !== 1) return false;
      if (repeatFilter === "2+" && count < 2) return false;
      if (repeatFilter === "3+" && count < 3) return false;
      return true;
    });
  }, [baseMissed, dept, search, repeatFilter, missCountByUser]);

  const kpis = useMemo(() => {
    const todayCount = filteredMissed.filter((m) => m.log_date === todayStr).length;
    const monthStart = format(startOfMonth(parseISO(todayStr)), "yyyy-MM-dd");
    const monthMisses = baseMissed.filter((m) => m.log_date >= monthStart && m.log_date <= todayStr);
    const monthByUser: Record<string, number> = {};
    monthMisses.forEach((m) => {
      if (!m.user_id) return;
      monthByUser[m.user_id] = (monthByUser[m.user_id] || 0) + 1;
    });
    const repeatMisses = Object.values(monthByUser).filter((c) => c > 1).length;

    const deptMap: Record<string, number> = {};
    filteredMissed.forEach((m) => {
      const d = (m.users as any)?.department || "Other";
      deptMap[d] = (deptMap[d] || 0) + 1;
    });
    const topDept = Object.entries(deptMap).sort((a, b) => b[1] - a[1])[0];

    const cutoffRaw = (cutoffSetting || "19:00").substring(0, 5);
    const [ch, cm] = cutoffRaw.split(":").map(Number);
    const cutoffDisplay =
      !Number.isNaN(ch)
        ? `${ch % 12 || 12}:${String(cm || 0).padStart(2, "0")}`
        : formatTime12h(cutoffRaw);

    return {
      todayCount,
      repeatMisses,
      topDeptName: topDept?.[0] || "—",
      topDeptCount: topDept?.[1] || 0,
      cutoffDisplay,
    };
  }, [filteredMissed, baseMissed, todayStr, cutoffSetting]);

  const deptRows = useMemo(() => {
    const map: Record<string, number> = {};
    filteredMissed.forEach((m) => {
      const d = (m.users as any)?.department || "Other";
      map[d] = (map[d] || 0) + 1;
    });
    const max = Math.max(1, ...Object.values(map));
    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        pct: Math.round((value / max) * 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredMissed]);

  const trend7 = useMemo(() => {
    const end = parseISO(endDate);
    const start = subDays(end, 6);
    const days = eachDayOfInterval({ start, end });
    const counts: Record<string, number> = {};
    // Use baseMissed for trend so dept filter doesn't empty the week chart oddly — actually use filtered for consistency with filters
    filteredMissed.forEach((m) => {
      counts[m.log_date] = (counts[m.log_date] || 0) + 1;
    });
    return days.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      return { date: d, dateStr, label: format(d, "MMM d"), count: counts[dateStr] || 0 };
    });
  }, [filteredMissed, endDate]);

  const trendYMax = useMemo(() => {
    const m = Math.max(0, ...trend7.map((d) => d.count));
    if (m <= 3) return 3;
    if (m <= 6) return 6;
    if (m <= 9) return 9;
    return Math.ceil(m / 3) * 3;
  }, [trend7]);

  const sendReminder = async (m: (typeof filteredMissed)[0]) => {
    if (!m.user_id) return;
    setRemindingId(m.id);
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: m.user_id,
        type: "missed_log_reminder",
        channel: "in_app",
        metadata: {
          title: "Missed daily log reminder",
          message: `Please submit your daily log for ${format(parseISO(m.log_date), "MMM d, yyyy")}.`,
          log_date: m.log_date,
        },
        status: "pending",
      });
      if (error) throw error;
      toast.success("Reminder queued");
    } catch (e: any) {
      toast.error(e?.message || "Failed to send reminder");
    } finally {
      setRemindingId(null);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {[
          { label: "Missed Logs Today", value: String(kpis.todayCount), sub: "Detected after cutoff" },
          { label: "Repeat Misses", value: String(kpis.repeatMisses), sub: "More than once this month" },
          {
            label: kpis.topDeptName === "—" ? "Top Department" : kpis.topDeptName,
            value: String(kpis.topDeptCount),
            sub: "Largest affected department",
          },
          { label: "Cutoff", value: kpis.cutoffDisplay, sub: "Default daily detection time" },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-black/[0.075] rounded-xl p-3.5 min-w-0">
            <div className="text-[10px] font-semibold text-[#8B8B92] tracking-wide uppercase truncate">{k.label}</div>
            <div className="text-[22px] font-bold tracking-[-0.4px] text-[#17171A] leading-none mt-2">{k.value}</div>
            <div className="text-[10px] text-[#96969D] mt-1.5 leading-snug">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2.5 min-w-0">
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Start</div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-[180px] min-w-[180px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">End</div>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-[180px] min-w-[180px] text-[12px] pr-9 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4"
            />
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Department</div>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="h-9 w-[180px] min-w-[180px] text-[12px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Repeat Misses</div>
            <Select value={repeatFilter} onValueChange={setRepeatFilter}>
              <SelectTrigger className="h-9 w-[160px] min-w-[160px] text-[12px]">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                <SelectItem value="1">1 miss</SelectItem>
                <SelectItem value="2+">2+ misses</SelectItem>
                <SelectItem value="3+">3+ misses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Search employee</div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8B8B92]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee..."
                className="h-9 w-[220px] min-w-[220px] pl-8 text-[12px]"
              />
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-[12px] shrink-0"
          onClick={() =>
            exportCSV(
              filteredMissed.map((m) => ({
                Employee: (m.users as any)?.full_name,
                Department: (m.users as any)?.department || "",
                Date: m.log_date,
                Detected: m.detected_at,
                Misses: m.user_id ? missCountByUser[m.user_id] || 1 : 1,
              })),
              "missed-logs.csv"
            )
          }
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          CSV Export
        </Button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
          <div className="mb-3">
            <div className="text-[13px] font-bold text-[#17171A]">Missed Logs by Department</div>
            <div className="text-[10px] text-[#96969D] mt-0.5">Where missing submissions are concentrated</div>
          </div>
          <div className="text-[8px] text-[#9A9AA0] mb-2 pl-[120px]">Missed logs →</div>
          {deptRows.length === 0 ? (
            <p className="text-[12px] text-[#8B8B92] py-8 text-center">No department data</p>
          ) : (
            <div className="space-y-2.5">
              {deptRows.map((row) => (
                <div key={row.name} className="flex items-center gap-2.5">
                  <div className="w-[110px] shrink-0 text-[11px] font-medium text-[#55555C] truncate" title={row.name}>
                    {row.name}
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-[#F0F0F2] overflow-hidden min-w-0">
                    <div
                      className="h-full rounded-full bg-[#EB5A1E]"
                      style={{ width: `${Math.min(100, row.pct)}%` }}
                    />
                  </div>
                  <div className="w-10 text-right text-[11px] font-semibold text-[#333338]">{row.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-black/[0.075] rounded-xl p-4 min-w-0">
          <div className="mb-3">
            <div className="text-[13px] font-bold text-[#17171A]">7-Day Missed Log Trend</div>
            <div className="text-[10px] text-[#96969D] mt-0.5">Daily missed-log detections over the last week</div>
          </div>
          <div className="h-[180px]">
            <svg viewBox="0 0 700 180" preserveAspectRatio="none" className="w-full h-full overflow-visible">
              <g stroke="#E8E8EB" strokeWidth="1">
                <line x1="48" y1="25" x2="680" y2="25" />
                <line x1="48" y1="62" x2="680" y2="62" />
                <line x1="48" y1="99" x2="680" y2="99" />
                <line x1="48" y1="136" x2="680" y2="136" />
              </g>
              <line x1="48" y1="20" x2="48" y2="145" stroke="#CFCFD5" strokeWidth="1" />
              <line x1="48" y1="145" x2="680" y2="145" stroke="#CFCFD5" strokeWidth="1" />
              <g fill="#A0A0A7" fontSize="9">
                <text x="40" y="139" textAnchor="end">0</text>
                <text x="40" y="102" textAnchor="end">{Math.round(trendYMax / 3)}</text>
                <text x="40" y="65" textAnchor="end">{Math.round((trendYMax * 2) / 3)}</text>
                <text x="40" y="28" textAnchor="end">{trendYMax}</text>
              </g>
              <text
                x="14"
                y="88"
                fill="#A0A0A7"
                fontSize="9"
                transform="rotate(-90 14 88)"
                textAnchor="middle"
              >
                Missed logs
              </text>
              {(() => {
                const n = trend7.length;
                const x0 = 55;
                const x1 = 625;
                const y0 = 145;
                const yTop = 25;
                const span = Math.max(1, n - 1);
                const yFor = (v: number) =>
                  y0 - (Math.min(trendYMax, Math.max(0, v)) / trendYMax) * (y0 - yTop);
                const pts = trend7.map((d, i) => ({
                  x: x0 + ((x1 - x0) * i) / span,
                  y: yFor(d.count),
                  label: d.label,
                }));
                const path = pts
                  .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                  .join(" ");
                return (
                  <>
                    {pts.map((p) => (
                      <text key={p.label} x={p.x} y={162} textAnchor="middle" fill="#A0A0A7" fontSize="9">
                        {p.label}
                      </text>
                    ))}
                    {path && (
                      <path d={path} fill="none" stroke="#EB5A1E" strokeWidth="2.5" strokeLinejoin="round" />
                    )}
                    <g fill="#EB5A1E">
                      {pts.map((p) => (
                        <circle key={"c" + p.label} cx={p.x} cy={p.y} r={4} />
                      ))}
                    </g>
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-white border border-black/[0.075] rounded-[13px] overflow-hidden min-w-0">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div
              className={cn(filteredMissed.length > 8 && "max-h-[470px] overflow-y-auto")}
              style={{ scrollbarGutter: "stable" }}
            >
              <div
                className="sticky top-0 z-10 grid items-center gap-3 bg-[#F8F7F6] border-b border-black/[0.07] min-h-[38px] px-[13px] text-[9px] font-bold text-[#A0A0A7] tracking-[0.055em]"
                style={{ gridTemplateColumns: "minmax(180px,1fr) 140px 125px 110px 120px 120px" }}
              >
                <div>EMPLOYEE</div>
                <div>DEPARTMENT</div>
                <div>DATE</div>
                <div>DETECTED</div>
                <div className="text-center">MISSES</div>
                <div className="text-center">ACTION</div>
              </div>
              {filteredMissed.length === 0 ? (
                <div className="text-center text-[12px] text-[#8B8B92] py-8">No missed logs match the current filters</div>
              ) : (
                filteredMissed.map((m) => {
                  const missCount = m.user_id ? missCountByUser[m.user_id] || 1 : 1;
                  return (
                    <div
                      key={m.id}
                      className="grid items-center gap-3 min-h-[48px] px-[13px] py-2 border-b border-black/[0.05] last:border-b-0 text-[10.5px] text-[#4B4B52] hover:bg-[#FCFBFA]"
                      style={{ gridTemplateColumns: "minmax(180px,1fr) 140px 125px 110px 120px 120px" }}
                    >
                      <div className="font-bold text-[#303035] whitespace-nowrap overflow-hidden text-ellipsis">
                        {(m.users as any)?.full_name || "—"}
                      </div>
                      <div className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
                        {(m.users as any)?.department || "Other"}
                      </div>
                      <div>{format(parseISO(m.log_date), "MMM d, yyyy")}</div>
                      <div className="text-[#8B8B92]">{formatPKTTime(m.detected_at)}</div>
                      <div className="flex justify-center">
                        <span className="inline-flex items-center justify-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold bg-[#FDF3E3] text-[#A9720B] whitespace-nowrap">
                          {missCount} {missCount === 1 ? "miss" : "misses"}
                        </span>
                      </div>
                      <div className="flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-[30px] px-2.5 text-[9px] font-semibold"
                          disabled={!m.user_id || remindingId === m.id}
                          onClick={() => sendReminder(m)}
                        >
                          {remindingId === m.id ? "…" : "Remind"}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

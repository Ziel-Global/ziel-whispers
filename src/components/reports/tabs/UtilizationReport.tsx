import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/ui/metric-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { DEPARTMENTS } from "@/lib/constants";
import {
  humanizeCategory,
  utilStatusFromPct,
  utilStatusBadgeClass,
  initialsFromName,
  exportCSV,
  exportPNG,
  getWorkingDays,
  smoothPath,
  type UtilStatus,
} from "./legacyReportHelpers";

export function UtilizationReport() {
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
          <MetricCard
            key={k.label}
            label={k.label}
            value={k.value}
            sub={k.sub}
            icon={<k.icon className="h-3.5 w-3.5" />}
          />
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
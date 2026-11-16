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

export function HeatmapReport() {
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
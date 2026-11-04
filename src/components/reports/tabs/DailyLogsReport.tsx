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

export function DailyLogsReport() {
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
          <MetricCard key={k.label} label={k.label} value={k.value} sub={k.sub} />
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
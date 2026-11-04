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

export function MissedLogsReport() {
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

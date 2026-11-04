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

export function AttendanceTrendReport() {
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
            <MetricCard key={k.label} label={k.label} value={k.value} sub={k.sub} />
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
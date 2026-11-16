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

export function MonthlySummaryReport() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "hr_manager" || profile?.role === "project_manager";
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
                  <MetricCard key={k.label} label={k.label} value={k.value} />
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
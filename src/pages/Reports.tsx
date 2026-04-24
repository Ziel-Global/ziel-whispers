import { useState, useMemo, useRef } from "react";
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
import { Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LineChart, Line, AreaChart, Area } from "recharts";
import { Download, Camera } from "lucide-react";
import { format, eachDayOfInterval, isWeekend, startOfMonth, endOfMonth, subDays, parseISO } from "date-fns";
import { getPKTDateString, formatPKTTime } from "@/hooks/useWorkSettings";
import html2canvas from "html2canvas";

const _CHART_COLORS = ["hsl(82,100%,72%)", "#60a5fa", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#ec4899"];
const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "Management", "Sales", "Other"];

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

function getWorkingDays(start: Date, end: Date) {
  return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d)).length;
}

export default function ReportsPage() {
  const [tab, setTab] = useState("utilization");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Summary</TabsTrigger>
          <TabsTrigger value="attendance">Attendance Trends</TabsTrigger>
          <TabsTrigger value="logs">Daily Logs</TabsTrigger>
          <TabsTrigger value="leave">Leave Report</TabsTrigger>
          <TabsTrigger value="missed">Missed Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="utilization"><UtilizationReport /></TabsContent>
        <TabsContent value="heatmap"><HeatmapReport /></TabsContent>
        <TabsContent value="monthly"><MonthlySummaryReport /></TabsContent>
        <TabsContent value="attendance"><AttendanceTrendReport /></TabsContent>
        <TabsContent value="logs"><DailyLogsReport /></TabsContent>
        <TabsContent value="leave"><LeaveReport /></TabsContent>
        <TabsContent value="missed"><MissedLogsReport /></TabsContent>
      </Tabs>
    </div>
  );
}

// ——— G3: Utilization ———
function UtilizationReport() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date(getPKTDateString())), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date(getPKTDateString())), "yyyy-MM-dd"));

  const { data: employees } = useQuery({ queryKey: ["report-employees"], queryFn: async () => { const { data } = await supabase.from("users").select("id, full_name, department, shift_start, shift_end").eq("status", "active").order("full_name"); return data || []; } });
  const { data: logs } = useQuery({
    queryKey: ["report-logs", startDate, endDate],
    queryFn: async () => { const { data } = await supabase.from("daily_logs").select("user_id, hours").gte("log_date", startDate).lte("log_date", endDate); return data || []; },
  });

  const rows = useMemo(() => {
    if (!employees || !logs) return [];
    const workingDays = getWorkingDays(parseISO(startDate), parseISO(endDate));
    const loggedByUser: Record<string, number> = {};
    logs.forEach((l) => { if (l.user_id) loggedByUser[l.user_id] = (loggedByUser[l.user_id] || 0) + Number(l.hours); });

    return employees.map((e) => {
      const available = workingDays * 8;
      const logged = loggedByUser[e.id] || 0;
      const pct = available > 0 ? (logged / available) * 100 : 0;
      return { id: e.id, name: e.full_name, department: e.department, available, logged: Math.round(logged * 10) / 10, pct: Math.round(pct), status: pct < 70 ? "Low" : pct > 110 ? "Over" : "Good" };
    }).sort((a, b) => b.pct - a.pct);
  }, [employees, logs, startDate, endDate]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div><label className="text-sm text-muted-foreground">Start</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><label className="text-sm text-muted-foreground">End</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        <Button variant="outline" size="sm" onClick={() => exportCSV(rows.map(({ id: _id, ...r }) => r), "utilization.csv")}><Download className="h-4 w-4 mr-1" />CSV</Button>
      </div>
      {rows.length > 0 && (
        <Card className="p-4">
          <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 30)}>
            <BarChart data={rows} layout="vertical" margin={{ left: 120 }}>
              <XAxis type="number" domain={[0, Math.max(120, ...rows.map((r) => r.pct))]} unit="%" />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
              <RechartsTooltip formatter={(v: number) => `${v}%`} />
              <Bar dataKey="pct" fill="hsl(82,100%,72%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Department</TableHead><TableHead>Available</TableHead><TableHead>Logged</TableHead><TableHead>Utilization</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className={r.pct < 70 ? "bg-yellow-50/50" : r.pct > 110 ? "bg-red-50/50" : ""}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.department}</TableCell>
                <TableCell>{r.available}h</TableCell>
                <TableCell>{r.logged}h</TableCell>
                <TableCell className="font-semibold">{r.pct}%</TableCell>
                <TableCell><Badge className={r.status === "Low" ? "bg-yellow-100 text-yellow-800" : r.status === "Over" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>{r.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ——— G4: Heatmap ———
function HeatmapReport() {
  const heatmapRef = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(getPKTDateString().slice(0, 7)); // "YYYY-MM"
  const [dept, setDept] = useState("all");

  const start = `${month}-01`;
  const end = format(endOfMonth(parseISO(start)), "yyyy-MM-dd");
  const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });

  const { data: employees } = useQuery({ queryKey: ["heatmap-emp", dept], queryFn: async () => { let q = supabase.from("users").select("id, full_name, department").eq("status", "active"); if (dept !== "all") q = q.eq("department", dept); const { data } = await q.order("full_name"); return data || []; } });
  const { data: logs } = useQuery({ queryKey: ["heatmap-logs", start, end], queryFn: async () => { const { data } = await supabase.from("daily_logs").select("user_id, log_date, hours").gte("log_date", start).lte("log_date", end); return data || []; } });

  const grid = useMemo(() => {
    if (!employees || !logs) return [];
    const map: Record<string, Record<string, number>> = {};
    logs.forEach((l) => { if (!l.user_id) return; if (!map[l.user_id]) map[l.user_id] = {}; const d = l.log_date; map[l.user_id][d] = (map[l.user_id][d] || 0) + Number(l.hours); });
    return employees.map((e) => ({ id: e.id, name: e.full_name, hours: map[e.id] || {} }));
  }, [employees, logs]);

  const cellColor = (h: number) => { if (h === 0) return "bg-muted"; if (h <= 6) return "bg-green-200"; if (h <= 9) return "bg-yellow-200"; return "bg-red-200"; };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div><label className="text-sm text-muted-foreground">Month</label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        <Select value={dept} onValueChange={setDept}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" size="sm" onClick={() => exportPNG(heatmapRef as any, "heatmap.png")}><Camera className="h-4 w-4 mr-1" />PNG</Button>
      </div>
      <Card className="p-4 overflow-x-auto" ref={heatmapRef}>
        <div className="min-w-max">
          <div className="flex">
            <div className="w-32 shrink-0" />
            {days.map((d) => (
              <div key={d.toISOString()} className={`w-7 text-center text-[10px] ${isWeekend(d) ? "text-muted-foreground/40" : "text-muted-foreground"}`}>{format(d, "d")}</div>
            ))}
          </div>
          {grid.map((row) => (
            <div key={row.id} className="flex items-center">
              <div className="w-32 shrink-0 text-xs truncate pr-2">{row.name}</div>
              {days.map((d) => {
                const dateStr = format(d, "yyyy-MM-dd");
                const h = row.hours[dateStr] || 0;
                return (
                  <div key={dateStr} className={`w-7 h-6 m-px rounded-sm ${isWeekend(d) ? "bg-muted/30" : cellColor(h)}`} title={`${row.name} · ${format(d, "MMM d")} · ${h}h`} />
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-muted" />0h</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-200" />1-6h</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-yellow-200" />7-9h</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-200" />&gt;9h</span>
        </div>
      </Card>
    </div>
  );
}

// ——— G5: Monthly Summary ———
function MonthlySummaryReport() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const [selectedUser, setSelectedUser] = useState(isAdmin ? "" : profile?.id || "");
  const [month, setMonth] = useState(format(subDays(startOfMonth(new Date(getPKTDateString())), 1), "yyyy-MM"));

  const { data: employees } = useQuery({ queryKey: ["summary-emp"], queryFn: async () => { const { data } = await supabase.from("users").select("id, full_name").eq("status", "active").order("full_name"); return data || []; }, enabled: isAdmin });

  const userId = isAdmin ? selectedUser : profile?.id;
  const start = `${month}-01`;
  const end = format(endOfMonth(parseISO(start)), "yyyy-MM-dd");

  const { data: logs } = useQuery({ queryKey: ["summary-logs", userId, start, end], queryFn: async () => { const { data } = await supabase.from("daily_logs").select("*, projects(name)").eq("user_id", userId!).gte("log_date", start).lte("log_date", end); return data || []; }, enabled: !!userId });
  const { data: leave } = useQuery({ queryKey: ["summary-leave", userId, start, end], queryFn: async () => { const { data } = await supabase.from("leave_requests").select("*, leave_types(name)").eq("user_id", userId!).eq("status", "approved").gte("start_date", start).lte("end_date", end); return data || []; }, enabled: !!userId });
  const { data: attendance } = useQuery({ queryKey: ["summary-att", userId, start, end], queryFn: async () => { const { data } = await supabase.from("attendance").select("date, work_mode").eq("user_id", userId!).gte("date", start).lte("date", end); return data || []; }, enabled: !!userId });

  const workingDays = getWorkingDays(parseISO(start), parseISO(end));
  const totalHours = logs?.reduce((s, l) => s + Number(l.hours), 0) || 0;
  const lateLogs = logs?.filter((l) => l.is_late).length || 0;
  const onsiteDays = attendance?.filter((a) => a.work_mode === "onsite").length || 0;
  const remoteDays = attendance?.filter((a) => a.work_mode === "remote").length || 0;

  const projectHours: Record<string, number> = {};
  logs?.forEach((l) => { const name = (l.projects as any)?.name || "No Project"; projectHours[name] = (projectHours[name] || 0) + Number(l.hours); });

  const leaveByType: Record<string, number> = {};
  leave?.forEach((l) => { const name = (l.leave_types as any)?.name || "Unknown"; leaveByType[name] = (leaveByType[name] || 0) + l.days_count; });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        {isAdmin && (
          <div><label className="text-sm text-muted-foreground">Employee</label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>{employees?.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div><label className="text-sm text-muted-foreground">Month</label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        {userId && <Button variant="outline" size="sm" onClick={() => exportCSV([{ "Working Days": workingDays, "Total Hours": totalHours, "Late Logs": lateLogs, "Onsite Days": onsiteDays, "Remote Days": remoteDays, ...projectHours, ...leaveByType }], "monthly-summary.csv")}><Download className="h-4 w-4 mr-1" />CSV</Button>}
      </div>
      {!userId && <p className="text-muted-foreground">Select an employee to view their summary.</p>}
      {userId && logs && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 text-center"><p className="text-sm text-muted-foreground">Working Days</p><p className="text-2xl font-bold">{workingDays}</p></Card>
          <Card className="p-4 text-center"><p className="text-sm text-muted-foreground">Hours Logged</p><p className="text-2xl font-bold">{totalHours.toFixed(1)}</p></Card>
          <Card className="p-4 text-center"><p className="text-sm text-muted-foreground">Late Logs</p><p className="text-2xl font-bold">{lateLogs}</p></Card>
          <Card className="p-4 text-center"><p className="text-sm text-muted-foreground">Onsite</p><p className="text-2xl font-bold">{onsiteDays}</p></Card>
          <Card className="p-4 text-center"><p className="text-sm text-muted-foreground">Remote</p><p className="text-2xl font-bold">{remoteDays}</p></Card>
        </div>
      )}
      {userId && Object.keys(projectHours).length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium text-sm mb-2">Hours by Project</h3>
          <Table><TableBody>{Object.entries(projectHours).sort((a, b) => b[1] - a[1]).map(([name, hours]) => (
            <TableRow key={name}><TableCell>{name}</TableCell><TableCell className="text-right font-medium">{hours.toFixed(1)}h</TableCell></TableRow>
          ))}</TableBody></Table>
        </Card>
      )}
      {userId && Object.keys(leaveByType).length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium text-sm mb-2">Leave Days</h3>
          <Table><TableBody>{Object.entries(leaveByType).map(([type, days]) => (
            <TableRow key={type}><TableCell>{type}</TableCell><TableCell className="text-right font-medium">{days}d</TableCell></TableRow>
          ))}</TableBody></Table>
        </Card>
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

  const { data: employees } = useQuery({ queryKey: ["att-trend-emp", dept], queryFn: async () => { let q = supabase.from("users").select("id, full_name").eq("status", "active"); if (dept !== "all") q = q.eq("department", dept); const { data } = await q.order("full_name"); return data || []; } });
  const { data: attendance } = useQuery({
    queryKey: ["att-trend", startDate, endDate, dept],
    queryFn: async () => {
      let q = supabase.from("attendance").select("date, clock_in, work_mode, user_id").gte("date", startDate).lte("date", endDate);
      const { data } = await q;
      return data || [];
    },
  });

  const chartData = useMemo(() => {
    if (!attendance || !employees) return [];
    const empIds = new Set(employees.map((e) => e.id));
    const filtered = attendance.filter((a) => empIds.has(a.user_id!));
    const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) }).filter((d) => !isWeekend(d));

    return days.map((d) => {
      const dateStr = format(d, "yyyy-MM-dd");
      const dayAtt = filtered.filter((a) => a.date === dateStr);
      const clockIns = dayAtt.filter((a) => a.clock_in).map((a) => new Date(a.clock_in!).getHours() + new Date(a.clock_in!).getMinutes() / 60);
      const avgClockIn = clockIns.length > 0 ? clockIns.reduce((s, v) => s + v, 0) / clockIns.length : 0;
      const rate = employees.length > 0 ? (dayAtt.length / employees.length) * 100 : 0;
      const onsite = dayAtt.filter((a) => a.work_mode === "onsite").length;
      const remote = dayAtt.filter((a) => a.work_mode === "remote").length;
      return { date: format(d, "MMM d"), avgClockIn: Math.round(avgClockIn * 100) / 100, rate: Math.round(rate), onsite, remote };
    });
  }, [attendance, employees, startDate, endDate]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div><label className="text-sm text-muted-foreground">Start</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><label className="text-sm text-muted-foreground">End</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        <Select value={dept} onValueChange={setDept}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Depts</SelectItem>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" size="sm" onClick={() => exportPNG(chartRef as any, "attendance-trend.png")}><Camera className="h-4 w-4 mr-1" />PNG</Button>
        <Button variant="outline" size="sm" onClick={() => exportCSV(chartData, "attendance-trend.csv")}><Download className="h-4 w-4 mr-1" />CSV</Button>
      </div>
      <div ref={chartRef} className="space-y-4">
        <Card className="p-4"><h3 className="font-medium text-sm mb-2">Average Clock-in Time</h3>
          <ResponsiveContainer width="100%" height={200}><LineChart data={chartData}><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis domain={[7, 12]} tickFormatter={(v) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, "0")}`} /><RechartsTooltip /><Line type="monotone" dataKey="avgClockIn" stroke="hsl(82,100%,72%)" strokeWidth={2} name="Avg Clock-in" /></LineChart></ResponsiveContainer>
        </Card>
        <Card className="p-4"><h3 className="font-medium text-sm mb-2">Daily Attendance Rate</h3>
          <ResponsiveContainer width="100%" height={200}><BarChart data={chartData}><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} unit="%" /><RechartsTooltip /><Bar dataKey="rate" fill="#60a5fa" radius={[2, 2, 0, 0]} name="Attendance %" /></BarChart></ResponsiveContainer>
        </Card>
        <Card className="p-4"><h3 className="font-medium text-sm mb-2">Remote vs Onsite</h3>
          <ResponsiveContainer width="100%" height={200}><AreaChart data={chartData}><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis /><RechartsTooltip /><Area type="monotone" dataKey="onsite" stackId="1" fill="hsl(82,100%,72%)" stroke="hsl(82,100%,60%)" name="Onsite" /><Area type="monotone" dataKey="remote" stackId="1" fill="#60a5fa" stroke="#3b82f6" name="Remote" /></AreaChart></ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ——— Daily Logs Report ———
function DailyLogsReport() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(getPKTDateString()), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(getPKTDateString());
  const [empFilter, setEmpFilter] = useState("all");

  const { data: employees } = useQuery({ queryKey: ["dlr-emp"], queryFn: async () => { const { data } = await supabase.from("users").select("id, full_name").eq("status", "active").order("full_name"); return data || []; } });
  const { data: logs } = useQuery({
    queryKey: ["dlr-logs", startDate, endDate, empFilter],
    queryFn: async () => {
      let q = supabase.from("daily_logs").select("*, users(full_name), projects(name)").gte("log_date", startDate).lte("log_date", endDate).order("log_date", { ascending: false });
      if (empFilter !== "all") q = q.eq("user_id", empFilter);
      const { data } = await q;
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div><label className="text-sm text-muted-foreground">Start</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><label className="text-sm text-muted-foreground">End</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        <Select value={empFilter} onValueChange={setEmpFilter}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Employees</SelectItem>{employees?.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" size="sm" onClick={() => exportCSV((logs || []).map((l) => ({ Date: l.log_date, Employee: (l.users as any)?.full_name, Project: (l.projects as any)?.name, Category: l.category, Hours: l.hours, Description: l.description, Late: l.is_late })), "daily-logs.csv")}><Download className="h-4 w-4 mr-1" />CSV</Button>
      </div>
      <Card><Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>Project</TableHead><TableHead>Category</TableHead><TableHead>Hours</TableHead><TableHead>Late</TableHead></TableRow></TableHeader>
        <TableBody>{(logs || []).map((l) => (
          <TableRow key={l.id}><TableCell>{format(parseISO(l.log_date), "MMM d")}</TableCell><TableCell>{(l.users as any)?.full_name}</TableCell><TableCell>{(l.projects as any)?.name || "—"}</TableCell><TableCell><Badge variant="outline">{l.category}</Badge></TableCell><TableCell>{l.hours}h</TableCell><TableCell>{l.is_late && <Badge variant="destructive" className="text-xs">Late</Badge>}</TableCell></TableRow>
        ))}{(!logs || logs.length === 0) && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No logs found</TableCell></TableRow>}</TableBody>
      </Table></Card>
    </div>
  );
}

// ——— Leave Report ———
function LeaveReport() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date(getPKTDateString())), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date(getPKTDateString())), "yyyy-MM-dd"));

  const { data: requests } = useQuery({
    queryKey: ["leave-report", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase.from("leave_requests").select("*, users(full_name), leave_types(name)").gte("start_date", startDate).lte("end_date", endDate).order("start_date", { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div><label className="text-sm text-muted-foreground">Start</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><label className="text-sm text-muted-foreground">End</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        <Button variant="outline" size="sm" onClick={() => exportCSV((requests || []).map((r) => ({ Employee: (r.users as any)?.full_name, Type: (r.leave_types as any)?.name, From: r.start_date, To: r.end_date, Days: r.days_count, Status: r.status, Reason: r.reason })), "leave-report.csv")}><Download className="h-4 w-4 mr-1" />CSV</Button>
      </div>
      <Card><Table>
        <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>{(requests || []).map((r) => (
          <TableRow key={r.id}><TableCell>{(r.users as any)?.full_name}</TableCell><TableCell>{(r.leave_types as any)?.name}</TableCell><TableCell>{format(parseISO(r.start_date), "MMM d")}</TableCell><TableCell>{format(parseISO(r.end_date), "MMM d")}</TableCell><TableCell>{r.days_count}</TableCell><TableCell><Badge className={r.status === "approved" ? "bg-green-100 text-green-800" : r.status === "rejected" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}>{r.status}</Badge></TableCell></TableRow>
        ))}{(!requests || requests.length === 0) && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No requests found</TableCell></TableRow>}</TableBody>
      </Table></Card>
    </div>
  );
}

// ——— Missed Logs Report ———
function MissedLogsReport() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(getPKTDateString()), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(getPKTDateString());

  const { data: missed } = useQuery({
    queryKey: ["missed-report", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase.from("missed_logs").select("*, users(full_name)").gte("log_date", startDate).lte("log_date", endDate).order("log_date", { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div><label className="text-sm text-muted-foreground">Start</label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><label className="text-sm text-muted-foreground">End</label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        <Button variant="outline" size="sm" onClick={() => exportCSV((missed || []).map((m) => ({ Employee: (m.users as any)?.full_name, Date: m.log_date, Detected: m.detected_at })), "missed-logs.csv")}><Download className="h-4 w-4 mr-1" />CSV</Button>
      </div>
      <Card><Table>
        <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Detected At</TableHead></TableRow></TableHeader>
        <TableBody>{(missed || []).map((m) => (
          <TableRow key={m.id} className="bg-red-50/30"><TableCell>{(m.users as any)?.full_name}</TableCell><TableCell>{format(parseISO(m.log_date), "MMM d, yyyy")}</TableCell><TableCell className="text-muted-foreground">{formatPKTTime(m.detected_at)}</TableCell></TableRow>
        ))}{(!missed || missed.length === 0) && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No missed logs found</TableCell></TableRow>}</TableBody>
      </Table></Card>
    </div>
  );
}

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Flag, ChevronDown, ChevronUp, Search, Save } from "lucide-react";
import { format } from "date-fns";
import { formatShiftTime } from "@/hooks/useWorkSettings";

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function getShiftHours(shiftStart: string, shiftEnd: string): number {
  const [sh, sm] = shiftStart.split(":").map(Number);
  const [eh, em] = shiftEnd.split(":").map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

export default function LogsAdminPage() {
  const { user: _user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  // Settings state for Log Rules
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");
  const [logEditDays, setLogEditDays] = useState("3");
  const [missedLogTime, setMissedLogTime] = useState("19:00");
  const [savingSettings, setSavingSettings] = useState(false);

  // Load settings
  const { data: settings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("key, value");
      const map: Record<string, string> = {};
      (data || []).forEach((s) => { map[s.key] = s.value; });
      return map;
    },
  });

  useEffect(() => {
    if (settings) {
      setShiftStart(settings["default_shift_start"] || "09:00");
      setShiftEnd(settings["default_shift_end"] || "18:00");
      setLogEditDays(settings["log_edit_window_days"] || "3");
      setMissedLogTime(settings["missed_log_check_time"] || "19:00");
    }
  }, [settings]);

  const globalShiftStart = settings?.default_shift_start || "09:00";
  const globalShiftEnd = settings?.default_shift_end || "18:00";

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const entries = [
        { key: "default_shift_start", value: shiftStart },
        { key: "default_shift_end", value: shiftEnd },
        { key: "log_edit_window_days", value: logEditDays },
        { key: "missed_log_check_time", value: missedLogTime },
      ];
      for (const entry of entries) {
        await supabase.from("system_settings").upsert(
          { ...entry, updated_by: profile?.id },
          { onConflict: "key" }
        );
      }
      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "settings.shift_log_rules_updated",
        target_entity: "system_settings",
      });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["system-setting-log-edit-days"] });
      toast.success("Shift & Log Rules saved");
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingSettings(false); }
  };

  // Fetch logs for selected date
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-logs", selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("*, users!daily_logs_user_id_fkey(full_name, email, shift_start, shift_end, has_custom_shift), projects(name)")
        .eq("log_date", selectedDate)
        .order("submitted_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch all active employees
  const { data: employees = [] } = useQuery({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, full_name, shift_start, shift_end, has_custom_shift").eq("status", "active");
      return data || [];
    },
  });

  // Fetch attendance for the selected date
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["admin-attendance-for-logs", selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("user_id, clock_in, clock_out, is_late").eq("date", selectedDate);
      return data || [];
    },
  });

  // Group logs by employee, include employees with zero logs
  const groupedRows = useMemo(() => {
    const logsByUser: Record<string, any[]> = {};
    logs.forEach((l: any) => {
      if (!l.user_id) return;
      if (!logsByUser[l.user_id]) logsByUser[l.user_id] = [];
      logsByUser[l.user_id].push(l);
    });

    const attByUser: Record<string, any> = {};
    attendanceRecords.forEach((a: any) => {
      if (a.user_id) attByUser[a.user_id] = a;
    });

    const allRows = employees.map((emp: any) => {
      const empLogs = logsByUser[emp.id] || [];
      const totalHours = empLogs.reduce((s: number, l: any) => s + Number(l.hours), 0);
      const empShiftStart = emp.has_custom_shift ? emp.shift_start : globalShiftStart;
      const empShiftEnd = emp.has_custom_shift ? emp.shift_end : globalShiftEnd;
      const shiftHours = getShiftHours(empShiftStart, empShiftEnd);
      const unloggedHours = Math.max(0, shiftHours - totalHours);
      const att = attByUser[emp.id];
      let status = "Absent";
      if (att?.clock_in && att?.is_late) status = "Late";
      else if (att?.clock_in) status = "Present";

      return {
        userId: emp.id,
        name: emp.full_name,
        logs: empLogs,
        loggedHours: totalHours,
        unloggedHours,
        shiftHours,
        logCount: empLogs.length,
        status,
      };
    });

    // Filter
    return allRows.filter((r) => {
      const matchEmp = employeeFilter === "all" || r.userId === employeeFilter;
      const matchStatus = statusFilter === "all" ||
        (statusFilter === "present" && r.status === "Present") ||
        (statusFilter === "late" && r.status === "Late") ||
        (statusFilter === "absent" && r.status === "Absent");
      const matchSearch = !searchQ || r.name.toLowerCase().includes(searchQ.toLowerCase()) || r.logs.some((l: any) => l.description?.toLowerCase().includes(searchQ.toLowerCase()));
      return matchEmp && matchStatus && matchSearch;
    });
  }, [logs, employees, attendanceRecords, employeeFilter, statusFilter, searchQ, globalShiftStart, globalShiftEnd]);

  const toggleFlag = async (log: any) => {
    await supabase.from("daily_logs").update({ admin_flagged: !log.admin_flagged }).eq("id", log.id);
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };

  const toggleLock = async (log: any) => {
    await supabase.from("daily_logs").update({ is_locked: !log.is_locked }).eq("id", log.id);
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };

  const saveComment = async (logId: string) => {
    await supabase.from("daily_logs").update({ admin_comment: comment }).eq("id", logId);
    toast.success("Comment saved");
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };

  const exportCSV = () => {
    const header = "Employee,Logged Hours,Unlogged Hours,Status,Log Count\n";
    const rows = groupedRows.map((r) =>
      `"${r.name}",${r.loggedHours.toFixed(1)},${r.unloggedHours.toFixed(1)},"${r.status}",${r.logCount}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `logs_${selectedDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Daily Logs</h1>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">All Logs</TabsTrigger>
          {isAdmin && <TabsTrigger value="rules">Shift & Log Rules</TabsTrigger>}
        </TabsList>

        <TabsContent value="logs" className="space-y-6">
          <div className="flex items-center justify-end">
            <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search employees or descriptions…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="pl-9" />
            </div>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-[170px]" />
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Employee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Logged Hours</TableHead>
                  <TableHead>Unlogged Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Log Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : groupedRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>
                ) : (
                  groupedRows.map((row) => (
                    <>
                      <TableRow
                        key={row.userId}
                        className={`cursor-pointer ${row.logCount === 0 ? "bg-red-50/50" : ""}`}
                        onClick={() => setExpandedId(expandedId === row.userId ? null : row.userId)}
                      >
                        <TableCell>{expandedId === row.userId ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{formatHours(row.loggedHours)}</TableCell>
                        <TableCell>
                          <span className={row.unloggedHours > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                            {row.unloggedHours > 0 ? formatHours(row.unloggedHours) : "0"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {row.status === "Absent" ? <Badge className="bg-red-100 text-red-700">Absent</Badge> :
                           row.status === "Late" ? <Badge className="bg-yellow-100 text-yellow-800">Late</Badge> :
                           <Badge className="bg-green-100 text-green-800">Present</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {row.logCount > 0 ? (
                              <span className="text-sm">{row.logCount} log{row.logCount > 1 ? "s" : ""}</span>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">No Logs</Badge>
                            )}
                            {isAdmin && row.logs.length > 0 && (
                              <div className="flex items-center gap-0.5 ml-auto">
                                {row.logs.map((log: any) => (
                                  <button
                                    key={log.id}
                                    onClick={(e) => { e.stopPropagation(); toggleFlag(log); }}
                                    className="p-0.5 rounded hover:bg-muted transition-colors"
                                    title={`${log.admin_flagged ? "Unflag" : "Flag"}: ${log.description?.slice(0, 30) || "log"}`}
                                  >
                                    <Flag className={`h-3.5 w-3.5 ${log.admin_flagged ? "text-destructive fill-destructive" : "text-muted-foreground/30"}`} />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedId === row.userId && (
                        <TableRow key={`${row.userId}-detail`}>
                          <TableCell colSpan={6} className="bg-muted/50 p-0">
                            {row.logCount === 0 ? (
                              <div className="p-4 text-sm text-muted-foreground text-center">No log entries submitted for this date.</div>
                            ) : (
                              <div className="divide-y">
                                {row.logs.map((log: any) => (
                                  <div key={log.id} className="p-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="space-y-1 flex-1">
                                        <div className="flex flex-wrap gap-2 items-center">
                                          {log.projects?.name && <Badge variant="outline">{log.projects.name}</Badge>}
                                          <Badge variant="secondary">{log.category}</Badge>
                                          <span className="text-sm font-medium">{formatHours(log.hours)}</span>
                                          {log.is_late && <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Late</Badge>}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{log.description}</p>
                                        <p className="text-xs text-muted-foreground">
                                          Submitted {format(new Date(log.submitted_at), "h:mm a")}
                                        </p>
                                      </div>
                                    </div>
                                    {isAdmin && expandedLogId === log.id && (
                                      <div className="mt-3 space-y-3 border-t pt-3">
                                        <div className="flex items-center gap-4">
                                          <div className="flex items-center gap-2">
                                            <Label className="text-xs">Lock</Label>
                                            <Switch checked={log.is_locked} onCheckedChange={() => toggleLock(log)} />
                                          </div>
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Admin Comment</Label>
                                          <div className="flex gap-2">
                                            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="flex-1" />
                                            <Button size="sm" onClick={() => saveComment(log.id)}>Save</Button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {isAdmin && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="mt-1 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedLogId(expandedLogId === log.id ? null : log.id);
                                          setComment(log.admin_comment || "");
                                        }}
                                      >
                                        {expandedLogId === log.id ? "Hide Actions" : "Admin Actions"}
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="rules">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Shift & Log Rules</h3>
                <Button onClick={handleSaveSettings} disabled={savingSettings} className="rounded-button">
                  <Save className="h-4 w-4 mr-2" />{savingSettings ? "Saving…" : "Save Rules"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Default Shift Start</Label>
                  <Input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Currently: {formatShiftTime(shiftStart)}</p>
                </div>
                <div className="space-y-1">
                  <Label>Default Shift End</Label>
                  <Input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Currently: {formatShiftTime(shiftEnd)}</p>
                </div>
                <div className="space-y-1">
                  <Label>Log Edit Window (days)</Label>
                  <Input type="number" value={logEditDays} onChange={(e) => setLogEditDays(e.target.value)} min="1" max="30" />
                  <p className="text-xs text-muted-foreground">Employees can submit logs for today and up to this many days in the past</p>
                </div>
                <div className="space-y-1">
                  <Label>Missed Log Detection Time</Label>
                  <Input type="time" value={missedLogTime} onChange={(e) => setMissedLogTime(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Currently: {formatShiftTime(missedLogTime)}</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

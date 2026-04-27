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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Flag, ChevronDown, ChevronUp, Search, Save, FileX, FileText, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { formatTime12h, getPKTDateString, formatPKTTime } from "@/hooks/useWorkSettings";

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function getShiftHours(shiftStart: string, shiftEnd: string): number {
  if (!shiftStart || !shiftEnd) return 0;
  const [sh, sm] = shiftStart.split(":").map(Number);
  const [eh, em] = shiftEnd.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function LogsAdminPage() {
  const { user: _user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(getPKTDateString());
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [modalType, setModalType] = useState<"missed" | "added" | "late" | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [logEditDays, setLogEditDays] = useState("");
  const [missedLogTime, setMissedLogTime] = useState("");
  const [autoClockoutLabel, setAutoClockoutLabel] = useState("");
  const [expectedHours, setExpectedHours] = useState("");
  const [utilLow, setUtilLow] = useState("");
  const [utilHigh, setUtilHigh] = useState("");
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
      setLogEditDays(settings["log_edit_window_days"] ?? "");
      setMissedLogTime(settings["missed_log_check_time"] ?? "");
      setAutoClockoutLabel(settings["auto_clockout_display_time"] ?? "");
      setExpectedHours(settings["expected_daily_hours"] ?? "8");
      setUtilLow(settings["utilization_low"] ?? "70");
      setUtilHigh(settings["utilization_high"] ?? "110");
    }
  }, [settings]);

  const globalShiftStart = settings?.default_shift_start ?? "";
  const globalShiftEnd = settings?.default_shift_end ?? "";
  const _missedLogDeadline = settings?.missed_log_check_time ?? "";

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const entries = [
        { key: "log_edit_window_days", value: logEditDays },
        { key: "missed_log_check_time", value: missedLogTime },
        { key: "auto_clockout_display_time", value: autoClockoutLabel },
        { key: "expected_daily_hours", value: expectedHours },
        { key: "utilization_low", value: utilLow },
        { key: "utilization_high", value: utilHigh },
      ];
      for (const entry of entries) {
        await supabase.from("system_settings").upsert(
          { ...entry, updated_by: profile?.id },
          { onConflict: "key" }
        );
      }
      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "settings.log_rules_updated",
        target_entity: "system_settings",
      });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["system-setting-log-edit-days"] });
      queryClient.invalidateQueries({ queryKey: ["auto-clockout-display-label"] });
      toast.success("Log Rules saved");
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
      const { data } = await supabase.from("users").select("id, full_name, shift_start, shift_end, has_custom_shift").eq("status", "active").order("full_name");
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

  // Group logs by employee — compute log status
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

      // Log status: missed / added / late
      const hasLogs = empLogs.length > 0;
      const hasLateLog = empLogs.some((l: any) => l.is_late);
      let logStatus: "missed" | "added" | "late" = "missed";
      if (hasLogs && hasLateLog) logStatus = "late";
      else if (hasLogs) logStatus = "added";

      // Has any flagged log
      const hasFlaggedLog = empLogs.some((l: any) => l.admin_flagged);

      return {
        userId: emp.id,
        name: emp.full_name,
        logs: empLogs,
        loggedHours: totalHours,
        unloggedHours,
        shiftHours,
        logCount: empLogs.length,
        logStatus,
        hasFlaggedLog,
      };
    });

    // Filter
    return allRows.filter((r) => {
      const matchEmp = employeeFilter === "all" || r.userId === employeeFilter;
      const matchStatus = statusFilter === "all" ||
        (statusFilter === "missed" && r.logStatus === "missed") ||
        (statusFilter === "added" && r.logStatus === "added") ||
        (statusFilter === "late" && r.logStatus === "late");
      const matchSearch = !searchQ || r.name.toLowerCase().includes(searchQ.toLowerCase()) || r.logs.some((l: any) => l.description?.toLowerCase().includes(searchQ.toLowerCase()));
      return matchEmp && matchStatus && matchSearch;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [logs, employees, attendanceRecords, employeeFilter, statusFilter, searchQ, globalShiftStart, globalShiftEnd]);

  // Stat card counts (unfiltered)
  const allUnfilteredRows = useMemo(() => {
    const logsByUser: Record<string, any[]> = {};
    logs.forEach((l: any) => {
      if (!l.user_id) return;
      if (!logsByUser[l.user_id]) logsByUser[l.user_id] = [];
      logsByUser[l.user_id].push(l);
    });
    return employees.map((emp: any) => {
      const empLogs = logsByUser[emp.id] || [];
      const hasLogs = empLogs.length > 0;
      const hasLateLog = empLogs.some((l: any) => l.is_late);
      let logStatus: "missed" | "added" | "late" = "missed";
      if (hasLogs && hasLateLog) logStatus = "late";
      else if (hasLogs) logStatus = "added";
      return { userId: emp.id, name: emp.full_name, logStatus };
    });
  }, [logs, employees]);

  const missedList = allUnfilteredRows.filter(r => r.logStatus === "missed");
  const addedList = allUnfilteredRows.filter(r => r.logStatus === "added");
  const lateList = allUnfilteredRows.filter(r => r.logStatus === "late");

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

  const handleDeleteLog = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from("daily_logs").delete().eq("id", deleteId);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "log.deleted", target_entity: "daily_logs", target_id: deleteId });
    toast.success("Log deleted");
    setDeleteId(null);
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };

  const exportCSV = () => {
    const header = "Employee,Logged Hours,Unlogged Hours,Log Status,Log Count\n";
    const rows = groupedRows.map((r) =>
      `"${r.name}",${r.loggedHours.toFixed(1)},${r.unloggedHours.toFixed(1)},"${r.logStatus}",${r.logCount}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `logs_${selectedDate}.csv`;
    a.click();
  };

  const modalData = modalType === "missed" ? missedList : modalType === "added" ? addedList : modalType === "late" ? lateList : [];
  const modalTitle = modalType === "missed" ? "Logs Missed" : modalType === "added" ? "Logs Added" : "Logs Late";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Daily Logs</h1>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">All Logs</TabsTrigger>
          {isAdmin && <TabsTrigger value="rules">Log Rules & Thresholds</TabsTrigger>}
        </TabsList>

        <TabsContent value="logs" className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setModalType("missed")}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-red-50"><FileX className="h-5 w-5 text-red-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Logs Missed</p>
                  <p className="text-2xl font-bold">{missedList.length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setModalType("added")}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-green-50"><FileText className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Logs Added</p>
                  <p className="text-2xl font-bold">{addedList.length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setModalType("late")}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-yellow-50"><Clock className="h-5 w-5 text-yellow-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Logs Late</p>
                  <p className="text-2xl font-bold">{lateList.length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Stat Card Modal */}
          <Dialog open={!!modalType} onOpenChange={() => setModalType(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{modalTitle} — {new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", month: "short", day: "numeric", year: "numeric" }).format(new Date(selectedDate + "T00:00:00"))}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[400px]">
                {modalData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No employees</p>
                ) : (
                  <div className="space-y-2">
                    {modalData.map((emp) => (
                      <div key={emp.userId} className="flex items-center gap-3 py-2 px-1">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">{getInitials(emp.name)}</div>
                        <span className="text-sm">{emp.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>

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
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="missed">Logs Missed</SelectItem>
                <SelectItem value="added">Logs Added</SelectItem>
                <SelectItem value="late">Logs Late</SelectItem>
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
                  <TableHead>Log Status</TableHead>
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
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {row.name}
                            {row.hasFlaggedLog && <Flag className="h-3.5 w-3.5 text-destructive fill-destructive" />}
                          </span>
                        </TableCell>
                        <TableCell>{formatHours(row.loggedHours)}</TableCell>
                        <TableCell>
                          <span className={row.unloggedHours > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                            {row.unloggedHours > 0 ? formatHours(row.unloggedHours) : "0"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {row.logStatus === "missed" ? <Badge className="bg-red-100 text-red-700">Missed</Badge> :
                            row.logStatus === "late" ? <Badge className="bg-yellow-100 text-yellow-800">Late</Badge> :
                              <Badge className="bg-green-100 text-green-800">Added</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 border border-border rounded-md px-3 py-1.5">
                            {row.logCount > 0 ? (
                              <span className="text-sm">{row.logCount} log{row.logCount > 1 ? "s" : ""}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">No Logs</span>
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
                                      <div className="flex-1">
                                        {/* Vertical column grid layout with labels above values */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                                          <div>
                                            <p className="text-[12px] text-muted-foreground mb-0.5">Logged Hours</p>
                                            <p className="text-sm font-medium">{formatHours(log.hours)}</p>
                                          </div>
                                          <div>
                                            <p className="text-[12px] text-muted-foreground mb-0.5">Submitted Time</p>
                                            <p className="text-sm">{formatPKTTime(log.submitted_at)}</p>
                                          </div>
                                          <div>
                                            <p className="text-[12px] text-muted-foreground mb-0.5">Project Name</p>
                                            <p className="text-sm">{log.projects?.name || "—"}</p>
                                          </div>
                                          <div>
                                            <p className="text-[12px] text-muted-foreground mb-0.5">Category</p>
                                            <Badge variant="secondary">{log.category}</Badge>
                                          </div>
                                        </div>
                                        <div className="mb-2">
                                          <p className="text-[12px] text-muted-foreground mb-0.5">Description</p>
                                          <p className="text-sm text-muted-foreground">{log.description}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          {log.is_late && <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Late</Badge>}
                                          {log.admin_comment && (
                                            <div>
                                              <p className="text-[12px] text-muted-foreground mb-0.5">Admin Comment</p>
                                              <p className="text-sm">{log.admin_comment}</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      {isAdmin && (
                                        <div className="flex gap-1 items-center">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); toggleFlag(log); }}
                                            className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                                            title={log.admin_flagged ? "Unflag" : "Flag"}
                                          >
                                            <Flag className={`h-4 w-4 ${log.admin_flagged ? "text-destructive fill-destructive" : "text-muted-foreground/40"}`} />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setDeleteId(log.id); }}
                                            className="shrink-0 p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                                            title="Delete Log"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                      )}
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
                                        size="sm"
                                        className="mt-1 text-xs bg-primary text-primary-foreground hover:bg-foreground hover:text-white transition-[background] duration-150 ease-in-out"
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
            <Card className="p-6 space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium border-b pb-2">Log Submission Rules</h4>
                  <div className="space-y-1">
                    <Label>Log Edit Window (days)</Label>
                    <Input type="number" value={logEditDays} onChange={(e) => setLogEditDays(e.target.value)} min="1" max="30" />
                    <p className="text-xs text-muted-foreground">Employees can submit logs for today and up to this many days in the past</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Missed Log Detection Time</Label>
                    <Input type="time" value={missedLogTime} onChange={(e) => setMissedLogTime(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Currently: {formatTime12h(missedLogTime)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Auto Clock-Out Display Time</Label>
                    <Input value={autoClockoutLabel} onChange={(e) => setAutoClockoutLabel(e.target.value)} placeholder="12:00 AM" />
                    <p className="text-xs text-muted-foreground">Label shown to users in missed clock-out alerts</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium border-b pb-2">Reporting Thresholds</h4>
                  <div className="space-y-1">
                    <Label>Expected Daily Hours</Label>
                    <Input type="number" value={expectedHours} onChange={(e) => setExpectedHours(e.target.value)} min="1" max="24" />
                    <p className="text-xs text-muted-foreground">Used to calculate utilization percentages</p>
                  </div>
                  <div className="space-y-1">
                    <Label>Underutilized Threshold (%)</Label>
                    <Input type="number" value={utilLow} onChange={(e) => setUtilLow(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Overburdened Threshold (%)</Label>
                    <Input type="number" value={utilHigh} onChange={(e) => setUtilHigh(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end">
                {/* <h3 className="font-semibold">Log Rules & Threshols</h3> */}
                <Button onClick={handleSaveSettings} disabled={savingSettings} className="rounded-button">
                  <Save className="h-4 w-4 mr-2" />{savingSettings ? "Saving…" : "Save Rules"}
                </Button>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Log?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this log? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLog} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

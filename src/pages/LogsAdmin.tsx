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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Flag, Search, Save, FileX, FileText, Clock, Trash2, Pencil, Lock, ChevronDown, ChevronRight } from "lucide-react";

import { format } from "date-fns";
import { formatTime12h, getPKTDateString, isLogSubmissionLate } from "@/hooks/useWorkSettings";
import { AdminAddLogDialog } from "@/components/AdminAddLogDialog";
import { formatHours, MISC_PROJECT_ID } from "@/lib/utils";

function getShiftHours(shiftStart: string, shiftEnd: string): number {
  if (!shiftStart || !shiftEnd) return 0;
  const [sh, sm] = shiftStart.split(":").map(Number);
  const [eh, em] = shiftEnd.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const durationMins = (eh * 60 + em - sh * 60 - sm);
  return Math.max(0, (durationMins - 60) / 60);
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
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [modalType, setModalType] = useState<"missed" | "added" | "late" | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [bulkDeleteLogOpen, setBulkDeleteLogOpen] = useState(false);

  const { data: allProjects = [] } = useQuery({
    queryKey: ["all-projects-for-edit"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
    enabled: isAdmin,
  });

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogOpen, setEditLogOpen] = useState(false);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const CATEGORIES = ["development", "meeting", "bug_fix", "code_review", "deployment", "documentation", "testing", "marketing", "seo", "research", "posting", "designing", "outbound_calls", "other"];

  const handleEditLog = async (logId: string) => {
    const { error } = await supabase
      .from("daily_logs")
      .update({
        project_id: editProjectId,
        category: editCategory,
        description: editDescription,
        admin_comment: comment || null,
      })
      .eq("id", logId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Log updated");
      setEditingLogId(null);
      setEditLogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
    }
  };

  const [logEditDays, setLogEditDays] = useState("");
  const [autoClockoutTime, setAutoClockoutTime] = useState("");
  const [expectedHours, setExpectedHours] = useState("");
  const [utilLow, setUtilLow] = useState("");
  const [utilHigh, setUtilHigh] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

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
      setAutoClockoutTime(settings["auto_clockout_time"] ?? "");
      setExpectedHours(settings["expected_daily_hours"] ?? "8");
      setUtilLow(settings["utilization_low"] ?? "70");
      setUtilHigh(settings["utilization_high"] ?? "110");
    }
  }, [settings]);

  const globalShiftStart = settings?.default_shift_start ?? "";
  const globalShiftEnd = settings?.default_shift_end ?? "";

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const entries = [
        { key: "log_edit_window_days", value: logEditDays },
        { key: "auto_clockout_time", value: autoClockoutTime },
        { key: "auto_clockout_display_time", value: formatTime12h(autoClockoutTime) },
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
      queryClient.invalidateQueries({ queryKey: ["system-settings-global"] });
      queryClient.invalidateQueries({ queryKey: ["system-setting-log-edit-days"] });
      queryClient.invalidateQueries({ queryKey: ["auto-clockout-display-label"] });
      queryClient.invalidateQueries({ queryKey: ["user-shift-info"] });
      toast.success("Log Rules saved");
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingSettings(false); }
  };

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-logs", selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("*, users!daily_logs_user_id_fkey(full_name, email, shift_start, shift_end, has_custom_shift, overtime_enabled), projects(name)")
        .eq("log_date", selectedDate)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false });
      return data || [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, full_name, shift_start, shift_end, has_custom_shift, created_at, overtime_enabled, is_oversight, working_days").eq("status", "active").neq("role", "admin").order("full_name");
      return data || [];
    },
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["admin-attendance-for-logs", selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("user_id, clock_in, clock_out, is_late").eq("date", selectedDate);
      return data || [];
    },
  });

  const { data: standupRecords = [] } = useQuery({
    queryKey: ["admin-standups", selectedDate],
    queryFn: async () => {
      const { data } = await supabase.from("daily_standups").select("*").eq("date", selectedDate);
      return data || [];
    },
  });

  const { data: dayLeaves = [] } = useQuery({
    queryKey: ["admin-leaves", selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, leave_types(name)")
        .eq("status", "approved")
        .lte("start_date", selectedDate)
        .gte("end_date", selectedDate);
      return data || [];
    },
  });

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

    const standupByUser: Record<string, boolean> = {};
    standupRecords.forEach((s: any) => {
      if (s.user_id) standupByUser[s.user_id] = s.is_done;
    });

    const leavesByUser: Record<string, any> = {};
    dayLeaves.forEach((l: any) => {
      if (l.user_id) leavesByUser[l.user_id] = l;
    });

    const allRows = employees.filter((emp: any) => {
      const createdAtDate = emp.created_at ? emp.created_at.split("T")[0] : null;
      if (createdAtDate && selectedDate < createdAtDate) return false;
      return true;
    }).map((emp: any) => {
      const empLogs = logsByUser[emp.id] || [];
      const regularLogs = empLogs.filter((l: any) => !l.is_overtime);
      const overtimeLogs = empLogs.filter((l: any) => l.is_overtime);
      const regularHours = regularLogs.reduce((s: number, l: any) => s + Number(l.hours), 0);
      const overtimeHours = overtimeLogs.reduce((s: number, l: any) => s + Number(l.hours), 0);
      const totalHours = regularHours;
      const empShiftStart = emp.has_custom_shift ? emp.shift_start : globalShiftStart;
      const empShiftEnd = emp.has_custom_shift ? emp.shift_end : globalShiftEnd;
      const shiftHours = getShiftHours(empShiftStart, empShiftEnd);

      const leave = leavesByUser[emp.id];
      const leaveHours = leave ? (leave.hours || 0) : 0;
      const leaveName = leave ? (leave.leave_types?.name || "Leave") : "";
      const isFullLeave = leave && !leave.hours;
      const isHalfLeave = leave && !!leave.hours;

      const unloggedHours = isFullLeave ? 0 : Math.max(0, shiftHours - totalHours - leaveHours);

      const hasLogs = empLogs.length > 0;
      const hasLateLog = empLogs.some((l: any) => l.submitted_at && isLogSubmissionLate(l.submitted_at, empShiftEnd, l.log_date));
      const isWeekend = new Date(selectedDate + "T00:00:00").getDay() === 0 || (new Date(selectedDate + "T00:00:00").getDay() === 6 && (emp.working_days ?? 5) === 5);

      let logStatus: "missed" | "added" | "late" | "none" | "on_leave" | "half_day_leave" | "partial_day" = "missed";
      if (isFullLeave) {
        logStatus = "on_leave";
      } else if (isHalfLeave) {
        if (hasLogs) {
          logStatus = "partial_day";
        } else {
          logStatus = "half_day_leave";
        }
      } else if (hasLogs && hasLateLog) {
        logStatus = "late";
      } else if (hasLogs) {
        logStatus = "added";
      } else if (isWeekend) {
        logStatus = "none";
      }

      const hasFlaggedLog = empLogs.some((l: any) => l.admin_flagged);

      return {
        userId: emp.id,
        name: emp.full_name,
        logs: empLogs,
        regularLogs,
        overtimeLogs,
        loggedHours: totalHours,
        overtimeHours,
        unloggedHours,
        shiftHours,
        logCount: empLogs.length,
        logStatus,
        hasFlaggedLog,
        standupDone: standupByUser[emp.id] ?? true,
        overtimeEnabled: emp.overtime_enabled === true,
        leaveHours,
        leaveName,
        isOversight: emp.is_oversight === true,
      };
    });

    return allRows.filter((r) => {
      const matchEmp = employeeFilter === "all" || r.userId === employeeFilter;
      const matchStatus = statusFilter === "all" ||
        (statusFilter === "missed" && r.logStatus === "missed") ||
        (statusFilter === "added" && (r.logStatus === "added" || r.logStatus === "partial_day")) ||
        (statusFilter === "late" && r.logStatus === "late");
      if ((r.logStatus === "none" || r.logStatus === "on_leave" || r.logStatus === "half_day_leave") && statusFilter !== "all") return false;
      const matchSearch = !searchQ || r.name.toLowerCase().includes(searchQ.toLowerCase()) || r.logs.some((l: any) => l.description?.toLowerCase().includes(searchQ.toLowerCase()));
      return matchEmp && matchStatus && matchSearch;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [logs, employees, attendanceRecords, standupRecords, dayLeaves, employeeFilter, statusFilter, searchQ, globalShiftStart, globalShiftEnd]);

  const allUnfilteredRows = useMemo(() => {
    const logsByUser: Record<string, any[]> = {};
    logs.forEach((l: any) => {
      if (!l.user_id) return;
      if (!logsByUser[l.user_id]) logsByUser[l.user_id] = [];
      logsByUser[l.user_id].push(l);
    });

    const leavesByUser: Record<string, any> = {};
    dayLeaves.forEach((l: any) => {
      if (l.user_id) leavesByUser[l.user_id] = l;
    });

    return employees.filter((emp: any) => {
      const createdAtDate = emp.created_at ? emp.created_at.split("T")[0] : null;
      if (createdAtDate && selectedDate < createdAtDate) return false;
      return true;
    }).map((emp: any) => {
      const empLogs = logsByUser[emp.id] || [];
      const hasLogs = empLogs.length > 0;
      const empShiftEnd = emp.has_custom_shift ? emp.shift_end : globalShiftEnd;
      const hasLateLog = empLogs.some((l: any) => l.submitted_at && isLogSubmissionLate(l.submitted_at, empShiftEnd, l.log_date));
      const isWeekend = new Date(selectedDate + "T00:00:00").getDay() === 0 || (new Date(selectedDate + "T00:00:00").getDay() === 6 && (emp.working_days ?? 5) === 5);

      const leave = leavesByUser[emp.id];
      const isFullLeave = leave && !leave.hours;
      const isHalfLeave = leave && !!leave.hours;

      let logStatus: "missed" | "added" | "late" | "none" | "on_leave" | "half_day_leave" | "partial_day" = "missed";
      if (isFullLeave) {
        logStatus = "on_leave";
      } else if (isHalfLeave) {
        if (hasLogs) {
          logStatus = "partial_day";
        } else {
          logStatus = "half_day_leave";
        }
      } else if (hasLogs && hasLateLog) {
        logStatus = "late";
      } else if (hasLogs) {
        logStatus = "added";
      } else if (isWeekend) {
        logStatus = "none";
      }
      return { userId: emp.id, name: emp.full_name, logStatus };
    });
  }, [logs, employees, dayLeaves, selectedDate]);

  const missedList = allUnfilteredRows.filter(r => r.logStatus === "missed");
  const addedList = allUnfilteredRows.filter(r => r.logStatus === "added" || r.logStatus === "partial_day" || r.logStatus === "late");
  const lateList = allUnfilteredRows.filter(r => logs.some((l: any) => {
    if (l.user_id !== r.userId || !l.submitted_at) return false;
    const emp = employees.find((e: any) => e.id === r.userId);
    if (!emp) return false;
    const empShiftEnd = emp.has_custom_shift ? emp.shift_end : globalShiftEnd;
    return empShiftEnd ? isLogSubmissionLate(l.submitted_at, empShiftEnd, l.log_date) : false;
  }));

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

  const handleBulkDeleteLogs = async () => {
    const ids = Array.from(selectedLogIds);
    if (!ids.length) return;
    setDeleting(true);
    const { error } = await supabase.from("daily_logs").delete().in("id", ids);
    if (error) { toast.error(error.message); setDeleting(false); return; }
    for (const id of ids) {
      await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "log.deleted", target_entity: "daily_logs", target_id: id });
    }
    toast.success(`${ids.length} log${ids.length > 1 ? "s" : ""} deleted`);
    setSelectedLogIds(new Set());
    setBulkDeleteLogOpen(false);
    setDeleting(false);
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };

  const toggleAllLogsForEmployee = (empLogs: any[]) => {
    const ids = empLogs.map((l: any) => l.id);
    const allSelected = ids.every((id: string) => selectedLogIds.has(id));
    const next = new Set(selectedLogIds);
    if (allSelected) {
      ids.forEach((id: string) => next.delete(id));
    } else {
      ids.forEach((id: string) => next.add(id));
    }
    setSelectedLogIds(next);
  };

  const exportCSV = () => {
    const header = "Employee,Logged Hours,Unlogged Hours,Log Status,Standup Status\n";
    const rows = groupedRows.map((r) =>
      `"${r.name}",${r.loggedHours.toFixed(1)},${r.unloggedHours.toFixed(1)},"${r.logStatus}","${r.standupDone ? "Done" : "Missed"}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `logs_${selectedDate}.csv`;
    a.click();
  };

  const modalData = modalType === "missed" ? missedList : modalType === "added" ? addedList : modalType === "late" ? lateList : [];
  const modalTitle = modalType === "missed" ? "Logs Missed" : modalType === "added" ? "Logs Added" : "Logs Late";

  const statusBadge = (logStatus: string) => {
    switch (logStatus) {
      case "added": return <Badge className="bg-green-100 text-green-800">Logs Added</Badge>;
      case "partial_day": return <Badge className="bg-green-100 text-green-800">Partial Day</Badge>;
      case "late": return <Badge className="bg-yellow-100 text-yellow-800">Late</Badge>;
      case "missed": return <Badge className="bg-red-100 text-red-800">Missed</Badge>;
      case "on_leave": return <Badge className="bg-blue-100 text-blue-800">On Leave</Badge>;
      case "half_day_leave": return <Badge className="bg-blue-50 text-blue-700">Half Day Leave</Badge>;
      default: return <Badge variant="secondary">—</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Daily Logs</h1>
        <AdminAddLogDialog employees={employees} />
      </div>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">All Logs</TabsTrigger>
          {isAdmin && <TabsTrigger value="rules">Log Rules & Thresholds</TabsTrigger>}
        </TabsList>

        <TabsContent value="logs" className="space-y-6">
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

          <Dialog open={!!modalType} onOpenChange={() => setModalType(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{modalTitle} — {new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", month: "short", day: "numeric", year: "numeric" }).format(new Date(selectedDate + "T00:00:00"))}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[400px]">
                {modalData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No employees</p>
                ) : (
                  <div className="divide-y divide-black/30">
                    {modalData.map((emp) => (
                      <div key={emp.userId} className="flex items-center gap-3 py-3 px-1">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">{getInitials(emp.name)}</div>
                        <span className="text-sm font-medium">{emp.name}</span>
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

          {isLoading ? (
            <Card><div className="py-12 text-center text-muted-foreground">Loading…</div></Card>
          ) : groupedRows.length === 0 ? (
            <Card><div className="py-12 text-center text-muted-foreground">No logs found for the selected filters</div></Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[40px_1fr_90px_90px_140px_40px] gap-2 px-4 py-2.5 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <div />
                <span>Employee</span>
                <span>Logs</span>
                <span>Hours</span>
                <span>Status</span>
                <div />
              </div>

              {selectedLogIds.size > 0 && (
                <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
                  <span className="text-sm text-blue-700">{selectedLogIds.size} log{selectedLogIds.size > 1 ? "s" : ""} selected</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedLogIds(new Set())}
                      className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg bg-white"
                    >
                      Clear selection
                    </button>
                    <button
                      onClick={() => setBulkDeleteLogOpen(true)}
                      className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete selected
                    </button>
                  </div>
                </div>
              )}

              {groupedRows.map((row) => {
                const isExpanded = expandedEmployeeId === row.userId;
                const allSelected = row.logs.length > 0 && row.logs.every((l: any) => selectedLogIds.has(l.id));
                const someSelected = row.logs.some((l: any) => selectedLogIds.has(l.id));
                const hasFlagged = row.hasFlaggedLog;
                const hasLate = row.logs.some((l: any) => {
                  const empShiftEnd = row.logs[0] ? undefined : undefined;
                  return l.submitted_at && isLogSubmissionLate(l.submitted_at, globalShiftEnd, l.log_date);
                });

                return (
                  <div key={row.userId}>
                    <div
                      className={`grid grid-cols-[40px_1fr_90px_90px_140px_40px] gap-2 items-center px-4 py-3 border-b cursor-pointer hover:bg-muted/30 transition-colors ${isExpanded ? "bg-muted/20" : ""}`}
                      onClick={() => setExpandedEmployeeId(isExpanded ? null : row.userId)}
                    >
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                          onChange={() => toggleAllLogsForEmployee(row.logs)}
                        />
                      </div>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                          {getInitials(row.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium break-words flex items-center gap-1.5">
                            {row.name}
                            {hasFlagged && <Flag className="h-3 w-3 text-destructive fill-destructive shrink-0" />}
                          </p>
                          {row.leaveName && (
                            <p className="text-xs text-muted-foreground">{row.leaveName}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm font-medium">{row.logCount}</span>
                        {row.overtimeHours > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">(+{formatHours(row.overtimeHours)} OT)</span>
                        )}
                      </div>
                      <div className="text-sm font-medium">{formatHours(row.loggedHours)}</div>
                      <div>{statusBadge(row.logStatus)}</div>
                      <div className="flex items-center justify-center">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-muted/10 border-b">
                        {row.logs.length === 0 ? (
                          <div className="px-6 py-4 text-sm text-muted-foreground">No logs submitted this day.</div>
                        ) : (
                          <div className="divide-y divide-border/50">
                            {row.logs.map((log: any) => {
                              const empForLog = employees.find((e: any) => e.id === log.user_id);
                              const logShiftEnd = empForLog?.has_custom_shift ? empForLog.shift_end : globalShiftEnd;
                              const isLate = log.submitted_at && logShiftEnd && isLogSubmissionLate(log.submitted_at, logShiftEnd, log.log_date);
                              return (
                                <div key={log.id} className="px-6 py-3.5">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className="text-xs font-normal capitalize">{(log.projects?.name || "Miscellaneous")}</Badge>
                                        <Badge variant="secondary" className="text-xs font-normal capitalize">{log.category?.replace(/_/g, " ")}</Badge>
                                        <span className="text-sm font-medium">{formatHours(log.hours)}</span>
                                        {isLate && <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Late</Badge>}
                                        {log.admin_flagged && <Badge className="bg-red-100 text-red-700 text-[10px]">Flagged</Badge>}
                                        {log.is_locked && <Badge className="bg-blue-100 text-blue-700 text-[10px]">Locked</Badge>}
                                        {log.submitted_at && (
                                          <span className="text-xs text-muted-foreground">Submitted {format(new Date(log.submitted_at), "h:mm a")}</span>
                                        )}
                                      </div>
                                      {log.description && (
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.description}</p>
                                      )}
                                      {log.admin_comment && (
                                        <p className="text-xs text-blue-600 italic">Admin: {log.admin_comment}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button
                                        onClick={() => {
                                          setEditingLogId(log.id);
                                          setEditProjectId(log.project_id);
                                          setEditCategory(log.category);
                                          setEditDescription(log.description || "");
                                          setComment(log.admin_comment || "");
                                          setEditLogOpen(true);
                                        }}
                                        className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors"
                                        title="Edit Log"
                                      >
                                        <Pencil className="h-4 w-4 text-[#6b7280]" />
                                      </button>
                                      <button onClick={() => toggleFlag(log)} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors" title={log.admin_flagged ? "Unflag" : "Flag"}>
                                        <Flag className={`h-4 w-4 ${log.admin_flagged ? "text-destructive fill-destructive" : "text-[#d1d5db]"}`} />
                                      </button>
                                      <button onClick={() => toggleLock(log)} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors" title={log.is_locked ? "Unlock" : "Lock"}>
                                        <Lock className={`h-4 w-4 ${log.is_locked ? "text-blue-600" : "text-[#d1d5db]"}`} />
                                      </button>
                                      <button
                                        onClick={() => setDeleteId(log.id)}
                                        className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors"
                                        title="Delete Log"
                                      >
                                        <Trash2 className="h-4 w-4 text-[#d1d5db] hover:text-destructive" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
                    <Label>Auto Clock-Out Time</Label>
                    <Input type="time" value={autoClockoutTime} onChange={(e) => setAutoClockoutTime(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Currently: {formatTime12h(autoClockoutTime)}</p>
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
                <Button onClick={handleSaveSettings} disabled={savingSettings} className="rounded-button">
                  <Save className="h-4 w-4 mr-2" />{savingSettings ? "Saving…" : "Save Rules"}
                </Button>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Log Dialog */}
      <Dialog open={editLogOpen} onOpenChange={(open) => { setEditLogOpen(open); if (!open) setEditingLogId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Log</DialogTitle>
          </DialogHeader>
          {editingLogId && (() => {
            const editLog = (logs || []).find((l: any) => l.id === editingLogId);
            if (!editLog) return null;
            const editEmp = employees.find((e: any) => e.id === editLog.user_id);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Employee</span>
                    <p className="font-medium">{editEmp?.full_name || editLog.users?.full_name}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Date</span>
                    <p className="font-medium">{format(new Date(editLog.log_date + "T00:00:00"), "MMM d, yyyy")}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Hours</span>
                    <p className="font-medium">{formatHours(editLog.hours)}</p>
                  </div>
                  {editLog.submitted_at && (
                    <div className="space-y-0.5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Submitted</span>
                      <p className="font-medium">{format(new Date(editLog.submitted_at), "h:mm a")}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Description</Label>
                  <Textarea
                    rows={3}
                    placeholder="Log description..."
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Project</Label>
                  <Select value={editProjectId || MISC_PROJECT_ID} onValueChange={setEditProjectId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(allProjects as any[]).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Category</Label>
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Admin Comment</Label>
                  <Textarea
                    rows={2}
                    placeholder="Add a comment..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setEditLogOpen(false); setEditingLogId(null); }}>Cancel</Button>
                  <Button onClick={() => handleEditLog(editingLogId)}>Save Changes</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

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

      <AlertDialog open={bulkDeleteLogOpen} onOpenChange={setBulkDeleteLogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedLogIds.size} Log{selectedLogIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedLogIds.size} log{selectedLogIds.size > 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteLogs} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

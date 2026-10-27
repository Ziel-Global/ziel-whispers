import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard, MetricGroup } from "@/components/ui/metric-card";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Flag, Search, Save, FileX, FileText, Clock, Trash2, Pencil, Lock, ChevronDown, ChevronRight } from "lucide-react";

import { format } from "date-fns";
import { formatTime12h, getPKTDateString, isLogSubmissionLate } from "@/hooks/useWorkSettings";
import { AdminAddLogDialog } from "@/components/AdminAddLogDialog";
import { formatHours, MISC_PROJECT_ID, getInitials } from "@/lib/utils";
import { LogsSummaryModal } from "@/components/logs-admin/LogsSummaryModal";
import { LogsFilterBar } from "@/components/logs-admin/LogsFilterBar";
import { LogsAdminTable } from "@/components/logs-admin/LogsAdminTable";
import { LogRulesTab } from "@/components/logs-admin/LogRulesTab";
import { EditLogModal } from "@/components/logs-admin/EditLogModal";

function getShiftHours(shiftStart: string, shiftEnd: string): number {
  if (!shiftStart || !shiftEnd) return 0;
  const [sh, sm] = shiftStart.split(":").map(Number);
  const [eh, em] = shiftEnd.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const durationMins = (eh * 60 + em - sh * 60 - sm);
  return Math.max(0, (durationMins - 60) / 60);
}

export default function LogsAdminPage() {
  const { user: _user, profile } = useAuth();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager" || profile?.role === "hr_manager" || profile?.role === "project_manager";
  const isSuperAdmin = profile?.role === "admin";
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


  return (
    <div className="flex flex-col flex-1 h-full min-h-0 gap-4 font-sans overflow-hidden">
      <PageHeader
        title="Daily Logs"
        actions={
          <>
            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-2 bg-white border border-black/[0.08] rounded-[10px] px-4 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] transition-colors shadow-sm"
            >
              <Download className="h-3.5 w-3.5 text-[#4B4B52]" />
              Export CSV
            </button>
            <AdminAddLogDialog employees={employees} />
          </>
        }
      />

      <Tabs defaultValue="logs" className="flex flex-col flex-1 min-h-0 overflow-hidden gap-4">
        <TabsList className="bg-white border border-black/[0.08] rounded-[11px] p-[5px] h-auto flex items-center gap-1 w-fit shrink-0">
          <TabsTrigger
            value="logs"
            className="rounded-[8px] px-4 py-2 text-[13px] font-semibold text-[#8B8B92] data-[state=active]:bg-[#17171A] data-[state=active]:text-white transition-all shadow-none"
          >
            All Logs
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="rules"
              className="rounded-[8px] px-4 py-2 text-[13px] font-medium text-[#8B8B92] data-[state=active]:bg-[#17171A] data-[state=active]:text-white transition-all shadow-none"
            >
              Log Rules &amp; Thresholds
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="logs" className="mt-0 flex-1 min-h-0 flex flex-col gap-4 overflow-hidden data-[state=inactive]:hidden">
          <MetricGroup columns={3}>
            <MetricCard
              variant="row"
              icon={<FileX className="h-4.5 w-4.5 text-[#E5484D]" />}
              iconClassName="bg-[#FDECEC] text-[#E5484D]"
              label="Logs Missed"
              value={missedList.length}
              onClick={() => setModalType("missed")}
            />
            <MetricCard
              variant="row"
              icon={<FileText className="h-4.5 w-4.5 text-[#1FAA59]" />}
              iconClassName="bg-[#DFF6E4] text-[#1FAA59]"
              label="Logs Added"
              value={addedList.length}
              onClick={() => setModalType("added")}
            />
            <MetricCard
              variant="row"
              icon={<Clock className="h-4.5 w-4.5 text-[#C7860F]" />}
              iconClassName="bg-[#FDF3E3] text-[#C7860F]"
              label="Logs Late"
              value={lateList.length}
              onClick={() => setModalType("late")}
            />
          </MetricGroup>

          <LogsSummaryModal
            modalType={modalType}
            onClose={() => setModalType(null)}
            selectedDate={selectedDate}
            modalTitle={modalTitle}
            modalData={modalData}
          />

          <LogsFilterBar
            searchQ={searchQ}
            setSearchQ={setSearchQ}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            employeeFilter={employeeFilter}
            setEmployeeFilter={setEmployeeFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            employees={employees}
          />

          {isLoading ? (
            <EmptyState isLoading message="Loading…" />
          ) : groupedRows.length === 0 ? (
            <EmptyState message="No logs found for the selected filters" />
          ) : (
            <LogsAdminTable
              groupedRows={groupedRows}
              expandedEmployeeId={expandedEmployeeId}
              setExpandedEmployeeId={setExpandedEmployeeId}
              selectedLogIds={selectedLogIds}
              setSelectedLogIds={setSelectedLogIds}
              setBulkDeleteLogOpen={setBulkDeleteLogOpen}
              toggleAllLogsForEmployee={toggleAllLogsForEmployee}
              employees={employees}
              globalShiftEnd={globalShiftEnd}
              selectedDate={selectedDate}
              onEditLog={(log) => {
                setEditingLogId(log.id);
                setEditProjectId(log.project_id);
                setEditCategory(log.category);
                setEditDescription(log.description || "");
                setComment(log.admin_comment || "");
                setEditLogOpen(true);
              }}
              toggleFlag={toggleFlag}
              toggleLock={toggleLock}
              onDeleteLog={(id) => setDeleteId(id)}
            />
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="rules" className="mt-0 flex-1 min-h-0 overflow-y-auto data-[state=inactive]:hidden">
            <LogRulesTab
              logEditDays={logEditDays}
              setLogEditDays={setLogEditDays}
              autoClockoutTime={autoClockoutTime}
              setAutoClockoutTime={setAutoClockoutTime}
              expectedHours={expectedHours}
              setExpectedHours={setExpectedHours}
              utilLow={utilLow}
              setUtilLow={setUtilLow}
              utilHigh={utilHigh}
              setUtilHigh={setUtilHigh}
              savingSettings={savingSettings}
              onSave={handleSaveSettings}
            />
          </TabsContent>
        )}
      </Tabs>

      <EditLogModal
        open={editLogOpen}
        onOpenChange={(open) => {
          setEditLogOpen(open);
          if (!open) setEditingLogId(null);
        }}
        editLog={(logs || []).find((l: any) => l.id === editingLogId)}
        editEmpName={employees.find((e: any) => e.id === (logs || []).find((l: any) => l.id === editingLogId)?.user_id)?.full_name}
        allProjects={allProjects as any[]}
        categories={CATEGORIES}
        editProjectId={editProjectId}
        setEditProjectId={setEditProjectId}
        editCategory={editCategory}
        setEditCategory={setEditCategory}
        editDescription={editDescription}
        setEditDescription={setEditDescription}
        comment={comment}
        setComment={setComment}
        onSave={(logId) => handleEditLog(logId)}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete Log?"
        description="Are you sure you want to delete this log? This action cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDeleteLog}
      />

      <ConfirmDialog
        open={bulkDeleteLogOpen}
        onOpenChange={setBulkDeleteLogOpen}
        title={`Delete ${selectedLogIds.size} Log${selectedLogIds.size > 1 ? "s" : ""}?’`}
        description={`Are you sure you want to delete ${selectedLogIds.size} log${selectedLogIds.size > 1 ? "s" : ""}? This action cannot be undone.`}
        confirmLabel="Delete all"
        loading={deleting}
        onConfirm={handleBulkDeleteLogs}
      />
    </div>
  );
}

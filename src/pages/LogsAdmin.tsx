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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataRow,
  RowPrimary,
  RowSecondary,
  RowDataGrid,
  RowDataItem,
  RowBadgeItem,
  RowActions,
  TableHeader,
} from "@/components/ui/data-row";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download,
  Flag,
  Search,
  Save,
  FileX,
  FileText,
  Clock,
  Trash2,
  Pencil,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import {
  formatTime12h,
  getPKTDateString,
  formatPKTTime,
  isLogSubmissionLate,
} from "@/hooks/useWorkSettings";
import { AdminAddLogDialog } from "@/components/AdminAddLogDialog";

import { formatHours, MISC_PROJECT_ID, getProjectName } from "@/lib/utils";

function getShiftHours(shiftStart: string, shiftEnd: string): number {
  if (!shiftStart || !shiftEnd) return 0;
  const [sh, sm] = shiftStart.split(":").map(Number);
  const [eh, em] = shiftEnd.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const durationMins = eh * 60 + em - sh * 60 - sm;
  return Math.max(0, (durationMins - 60) / 60);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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
  const [modalType, setModalType] = useState<
    "missed" | "added" | "late" | null
  >(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch all projects for editing
  const { data: allProjects = [] } = useQuery({
    queryKey: ["all-projects-for-edit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");
      return data || [];
    },
    enabled: isAdmin,
  });

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");

  const CATEGORIES = [
    "development",
    "meeting",
    "bug_fix",
    "code_review",
    "deployment",
    "documentation",
    "testing",
    "marketing",
    "seo",
    "research",
    "posting",
    "designing",
    "outbound_calls",
    "other",
  ];

  const handleEditLog = async (logId: string) => {
    const { error } = await supabase
      .from("daily_logs")
      .update({
        project_id: editProjectId,
        category: editCategory,
      })
      .eq("id", logId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Log updated");
      setEditingLogId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
    }
  };

  const [logEditDays, setLogEditDays] = useState("");
  const [autoClockoutTime, setAutoClockoutTime] = useState("");
  const [expectedHours, setExpectedHours] = useState("");
  const [utilLow, setUtilLow] = useState("");
  const [utilHigh, setUtilHigh] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Load settings
  const { data: settings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value");
      const map: Record<string, string> = {};
      (data || []).forEach((s) => {
        map[s.key] = s.value;
      });
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
        {
          key: "auto_clockout_display_time",
          value: formatTime12h(autoClockoutTime),
        },
        { key: "expected_daily_hours", value: expectedHours },
        { key: "utilization_low", value: utilLow },
        { key: "utilization_high", value: utilHigh },
      ];
      for (const entry of entries) {
        await supabase
          .from("system_settings")
          .upsert({ ...entry, updated_by: profile?.id }, { onConflict: "key" });
      }
      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "settings.log_rules_updated",
        target_entity: "system_settings",
      });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["system-settings-global"] });
      queryClient.invalidateQueries({
        queryKey: ["system-setting-log-edit-days"],
      });
      queryClient.invalidateQueries({
        queryKey: ["auto-clockout-display-label"],
      });
      queryClient.invalidateQueries({ queryKey: ["user-shift-info"] });
      toast.success("Log Rules saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Fetch logs for selected date
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-logs", selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select(
          "*, users!daily_logs_user_id_fkey(full_name, email, shift_start, shift_end, has_custom_shift, overtime_enabled), projects(name)",
        )
        .eq("log_date", selectedDate)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch all active employees
  const { data: employees = [] } = useQuery({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select(
          "id, full_name, shift_start, shift_end, has_custom_shift, created_at, overtime_enabled, is_oversight, working_days",
        )
        .eq("status", "active")
        .neq("role", "admin")
        .order("full_name");
      return data || [];
    },
  });

  // Fetch attendance for the selected date
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["admin-attendance-for-logs", selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("user_id, clock_in, clock_out, is_late")
        .eq("date", selectedDate);
      return data || [];
    },
  });

  // Fetch standups for the selected date
  const { data: standupRecords = [] } = useQuery({
    queryKey: ["admin-standups", selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_standups")
        .select("*")
        .eq("date", selectedDate);
      return data || [];
    },
  });

  // Fetch approved leaves for the selected date
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

    const allRows = employees
      .filter((emp: any) => {
        // Only show employees whose account existed on the selected date.
        // created_at is used, NOT join_date, because join_date can be backdated by admins.
        const createdAtDate = emp.created_at
          ? emp.created_at.split("T")[0]
          : null;
        if (createdAtDate && selectedDate < createdAtDate) return false;
        return true;
      })
      .map((emp: any) => {
        const empLogs = logsByUser[emp.id] || [];
        const regularLogs = empLogs.filter((l: any) => !l.is_overtime);
        const overtimeLogs = empLogs.filter((l: any) => l.is_overtime);
        const regularHours = regularLogs.reduce(
          (s: number, l: any) => s + Number(l.hours),
          0,
        );
        const overtimeHours = overtimeLogs.reduce(
          (s: number, l: any) => s + Number(l.hours),
          0,
        );
        const totalHours = regularHours; // Only regular hours count for logged/unlogged
        const empShiftStart = emp.has_custom_shift
          ? emp.shift_start
          : globalShiftStart;
        const empShiftEnd = emp.has_custom_shift
          ? emp.shift_end
          : globalShiftEnd;
        const shiftHours = getShiftHours(empShiftStart, empShiftEnd);

        const leave = leavesByUser[emp.id];
        const leaveHours = leave ? leave.hours || 0 : 0;
        const leaveName = leave ? leave.leave_types?.name || "Leave" : "";
        const isFullLeave = leave && !leave.hours;
        const isHalfLeave = leave && !!leave.hours;

        const unloggedHours = isFullLeave
          ? 0
          : Math.max(0, shiftHours - totalHours - leaveHours);

        // Log status: missed / added / late / on_leave / half_day_leave / partial_day
        const hasLogs = empLogs.length > 0;
        const hasLateLog = empLogs.some(
          (l: any) =>
            l.submitted_at &&
            isLogSubmissionLate(l.submitted_at, empShiftEnd, l.log_date),
        );
        const isWeekend =
          new Date(selectedDate + "T00:00:00").getDay() === 0 ||
          (new Date(selectedDate + "T00:00:00").getDay() === 6 &&
            (emp.working_days ?? 5) === 5);

        let logStatus:
          | "missed"
          | "added"
          | "late"
          | "none"
          | "on_leave"
          | "half_day_leave"
          | "partial_day" = "missed";
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

        // Has any flagged log
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

    // Filter
    return allRows
      .filter((r) => {
        const matchEmp =
          employeeFilter === "all" || r.userId === employeeFilter;
        const matchStatus =
          statusFilter === "all" ||
          (statusFilter === "missed" && r.logStatus === "missed") ||
          (statusFilter === "added" &&
            (r.logStatus === "added" || r.logStatus === "partial_day")) ||
          (statusFilter === "late" && r.logStatus === "late");
        if (
          (r.logStatus === "none" ||
            r.logStatus === "on_leave" ||
            r.logStatus === "half_day_leave") &&
          statusFilter !== "all"
        )
          return false;
        const matchSearch =
          !searchQ ||
          r.name.toLowerCase().includes(searchQ.toLowerCase()) ||
          r.logs.some((l: any) =>
            l.description?.toLowerCase().includes(searchQ.toLowerCase()),
          );
        return matchEmp && matchStatus && matchSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    logs,
    employees,
    attendanceRecords,
    standupRecords,
    dayLeaves,
    employeeFilter,
    statusFilter,
    searchQ,
    globalShiftStart,
    globalShiftEnd,
  ]);

  // Stat card counts (unfiltered)
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

    return employees
      .filter((emp: any) => {
        const createdAtDate = emp.created_at
          ? emp.created_at.split("T")[0]
          : null;
        if (createdAtDate && selectedDate < createdAtDate) return false;
        return true;
      })
      .map((emp: any) => {
        const empLogs = logsByUser[emp.id] || [];
        const hasLogs = empLogs.length > 0;
        const empShiftEnd = emp.has_custom_shift
          ? emp.shift_end
          : globalShiftEnd;
        const hasLateLog = empLogs.some(
          (l: any) =>
            l.submitted_at &&
            isLogSubmissionLate(l.submitted_at, empShiftEnd, l.log_date),
        );
        const isWeekend =
          new Date(selectedDate + "T00:00:00").getDay() === 0 ||
          (new Date(selectedDate + "T00:00:00").getDay() === 6 &&
            (emp.working_days ?? 5) === 5);

        const leave = leavesByUser[emp.id];
        const isFullLeave = leave && !leave.hours;
        const isHalfLeave = leave && !!leave.hours;

        let logStatus:
          | "missed"
          | "added"
          | "late"
          | "none"
          | "on_leave"
          | "half_day_leave"
          | "partial_day" = "missed";
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

  const missedList = allUnfilteredRows.filter((r) => r.logStatus === "missed");
  const addedList = allUnfilteredRows.filter(
    (r) =>
      r.logStatus === "added" ||
      r.logStatus === "partial_day" ||
      r.logStatus === "late",
  );
  const lateList = allUnfilteredRows.filter((r) =>
    logs.some((l: any) => {
      if (l.user_id !== r.userId || !l.submitted_at) return false;
      const emp = employees.find((e: any) => e.id === r.userId);
      if (!emp) return false;
      const empShiftEnd = emp.has_custom_shift ? emp.shift_end : globalShiftEnd;
      return empShiftEnd
        ? isLogSubmissionLate(l.submitted_at, empShiftEnd, l.log_date)
        : false;
    }),
  );

  const toggleFlag = async (log: any) => {
    await supabase
      .from("daily_logs")
      .update({ admin_flagged: !log.admin_flagged })
      .eq("id", log.id);
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };

  const toggleStandup = async (
    userId: string,
    date: string,
    currentStatus: boolean,
  ) => {
    const { error } = await supabase.from("daily_standups").upsert(
      {
        user_id: userId,
        date: date,
        is_done: !currentStatus,
      },
      { onConflict: "user_id, date" },
    );

    if (error) {
      toast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin-standups"] });
    }
  };

  const toggleLock = async (log: any) => {
    await supabase
      .from("daily_logs")
      .update({ is_locked: !log.is_locked })
      .eq("id", log.id);
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };

  const saveComment = async (logId: string) => {
    await supabase
      .from("daily_logs")
      .update({ admin_comment: comment })
      .eq("id", logId);
    toast.success("Comment saved");
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };

  const handleDeleteLog = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase
      .from("daily_logs")
      .delete()
      .eq("id", deleteId);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("audit_logs").insert({
      actor_id: profile?.id,
      action: "log.deleted",
      target_entity: "daily_logs",
      target_id: deleteId,
    });
    toast.success("Log deleted");
    setDeleteId(null);
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };

  const filteredLogs = useMemo(() => {
    let list = [...logs];
    if (employeeFilter !== "all") {
      list = list.filter((l: any) => l.user_id === employeeFilter);
    }
    if (statusFilter === "late") {
      list = list.filter((l: any) => {
        const emp = employees.find((e: any) => e.id === l.user_id);
        if (!emp) return false;
        const esEnd = emp.has_custom_shift ? emp.shift_end : globalShiftEnd;
        return (
          l.submitted_at &&
          esEnd &&
          isLogSubmissionLate(l.submitted_at, esEnd, l.log_date)
        );
      });
    }
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(
        (l: any) =>
          l.users?.full_name?.toLowerCase().includes(q) ||
          l.description?.toLowerCase().includes(q),
      );
    }
    return list.sort((a: any, b: any) =>
      (a.users?.full_name || "").localeCompare(b.users?.full_name || ""),
    );
  }, [logs, employeeFilter, statusFilter, searchQ, employees, globalShiftEnd]);

  const exportCSV = () => {
    const header =
      "Employee,Logged Hours,Unlogged Hours,Log Status,Standup Status\n";
    const rows = groupedRows
      .map(
        (r) =>
          `"${r.name}",${r.loggedHours.toFixed(1)},${r.unloggedHours.toFixed(1)},"${r.logStatus}","${r.standupDone ? "Done" : "Missed"}"`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `logs_${selectedDate}.csv`;
    a.click();
  };

  const modalData =
    modalType === "missed"
      ? missedList
      : modalType === "added"
        ? addedList
        : modalType === "late"
          ? lateList
          : [];
  const modalTitle =
    modalType === "missed"
      ? "Logs Missed"
      : modalType === "added"
        ? "Logs Added"
        : "Logs Late";

  return (
    <div className="space-y-0">
      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-bold text-[#09090B] tracking-tight leading-none mb-2">
            Daily Logs
          </h1>
        </div>
        <AdminAddLogDialog employees={employees} />
      </div>

      {/* ── SEGMENTED TABS ── */}
      <Tabs defaultValue="logs">
        <TabsList className="inline-flex items-center bg-white border border-[#E4E4E7] rounded-md p-[6px] gap-1 mb-8 shadow-sm">
          <TabsTrigger
            value="logs"
            className="rounded-md px-5 py-2 text-[13px] font-semibold transition-all duration-200 data-[state=active]:bg-[#1C1C1E] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#6B7280] hover:data-[state=inactive]:bg-[#F4F4F5]"
          >
            All Logs
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="rules"
              className="rounded-md px-5 py-2 text-[13px] font-semibold transition-all duration-200 data-[state=active]:bg-[#1C1C1E] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#6B7280] hover:data-[state=inactive]:bg-[#F4F4F5]"
            >
              Log Rules &amp; Thresholds
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="logs" className="space-y-6">
          {/* ── STAT CARDS ── */}
          <div className="bg-white border border-[#E4E4E7] rounded-[16px] shadow-sm grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E4E4E7]">
            <div
              className="p-6 flex items-center gap-4 cursor-pointer hover:bg-[#FFF4EA] transition-colors first:rounded-l-[16px] last:rounded-r-[16px]"
              onClick={() => setModalType("missed")}
            >
              <div className="h-[46px] w-[46px] rounded-[12px] bg-red-50 flex items-center justify-center shrink-0">
                <FileX className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#71717A] mb-0.5">
                  Logs Missed
                </p>
                <p className="text-[28px] font-bold text-[#09090B] leading-none">
                  {missedList.length}
                </p>
              </div>
            </div>
            <div
              className="p-6 flex items-center gap-4 cursor-pointer hover:bg-[#FFF4EA] transition-colors"
              onClick={() => setModalType("added")}
            >
              <div className="h-[46px] w-[46px] rounded-[12px] bg-green-50 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#71717A] mb-0.5">
                  Logs Added
                </p>
                <p className="text-[28px] font-bold text-[#09090B] leading-none">
                  {addedList.length}
                </p>
              </div>
            </div>
            <div
              className="p-6 flex items-center gap-4 cursor-pointer hover:bg-[#FFF4EA] transition-colors first:rounded-l-[16px] last:rounded-r-[16px]"
              onClick={() => setModalType("late")}
            >
              <div className="h-[46px] w-[46px] rounded-[12px] bg-yellow-50 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#71717A] mb-0.5">
                  Logs Late
                </p>
                <p className="text-[28px] font-bold text-[#09090B] leading-none">
                  {lateList.length}
                </p>
              </div>
            </div>
          </div>

          {/* ── STAT CARD MODAL ── */}
          <Dialog open={!!modalType} onOpenChange={() => setModalType(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {modalTitle} —{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    timeZone: "Asia/Karachi",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(selectedDate + "T00:00:00"))}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[400px]">
                {modalData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No employees
                  </p>
                ) : (
                  <div className="divide-y divide-black/10">
                    {modalData.map((emp) => (
                      <div
                        key={emp.userId}
                        className="flex items-center gap-3 py-3 px-1"
                      >
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {getInitials(emp.name)}
                        </div>
                        <span className="text-sm font-medium">{emp.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* ── FILTER TOOLBAR ── */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 max-w-[480px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1AA]" />
              <Input
                type="text"
                placeholder="Search employees or descriptions…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="pl-10 rounded-md border-[#E4E4E7] bg-white h-10 text-[13px] text-[#09090B] placeholder:text-[#A1A1AA] shadow-sm focus-visible:ring-[#EC6824] focus-visible:ring-1 focus-visible:border-[#EC6824]"
              />
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Date picker */}
            <div className="relative flex items-center">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-md border-[#E4E4E7] bg-white h-10 text-[13px] font-medium text-[#09090B] shadow-sm w-[150px] focus-visible:ring-[#EC6824] focus-visible:ring-1 focus-visible:border-[#EC6824] hover:border-[#EC6824] hover:bg-[#FFF4EA] transition-colors [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full pr-8"
              />
              <Download className="absolute right-3 h-4 w-4 text-[#A1A1AA] pointer-events-none" />
            </div>

            {/* Employee filter */}
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-[155px] h-10 text-[13px] font-medium text-[#09090B] border-[#E4E4E7] bg-white shadow-sm rounded-md hover:border-[#EC6824] hover:bg-[#FFF4EA] focus:border-[#EC6824] focus:ring-[3px] focus:ring-[#EC6824]/20 data-[state=open]:border-[#EC6824] transition-colors">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-10 text-[13px] font-medium text-[#09090B] border-[#E4E4E7] bg-white shadow-sm rounded-md hover:border-[#EC6824] hover:bg-[#FFF4EA] focus:border-[#EC6824] focus:ring-[3px] focus:ring-[#EC6824]/20 data-[state=open]:border-[#EC6824] transition-colors">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="missed">Logs Missed</SelectItem>
                <SelectItem value="added">Logs Added</SelectItem>
                <SelectItem value="late">Logs Late</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── EXPORT CSV ── */}
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              onClick={exportCSV}
              className="rounded-md border-[#E4E4E7] text-[#09090B] font-semibold h-9 px-4 text-[13px] shadow-sm hover:bg-[#FFF4EA] hover:border-[#EC6824] transition-colors"
            >
              <Download className="h-4 w-4 mr-2 text-[#71717A]" />
              Export CSV
            </Button>
          </div>

          {/* ── TABLE ── */}
          {isLoading ? (
            <div className="border border-[#E4E4E7] rounded-[16px] bg-white py-12 text-center text-[#71717A] text-[13px] shadow-sm">
              Loading…
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="border border-[#E4E4E7] rounded-[16px] bg-white py-12 text-center text-[#71717A] text-[13px] shadow-sm">
              No logs found for the selected filters
            </div>
          ) : (
            <div className="border border-[#E4E4E7] rounded-[16px] bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
              {/* Table Header */}
              <div
                className="px-6 py-3 border-b border-[#E4E4E7] grid gap-4 items-center text-[10px] font-bold text-[#A1A1AA] tracking-wider uppercase bg-transparent"
                style={{
                  gridTemplateColumns: "1.8fr 120px 80px 110px 80px 90px 80px",
                }}
              >
                <span>EMPLOYEE</span>
                <span>DATE</span>
                <span>HOURS</span>
                <span>STATUS</span>
                <span>LATE</span>
                <span>FLAGGED</span>
                <span className="text-right">ACTIONS</span>
              </div>

              {/* Table Rows */}
              <div className="flex flex-col bg-white">
                {filteredLogs.map((log: any) => {
                  const emp = employees.find((e: any) => e.id === log.user_id);
                  const esEnd = emp?.has_custom_shift
                    ? emp.shift_end
                    : globalShiftEnd;
                  const isLate =
                    log.submitted_at &&
                    esEnd &&
                    isLogSubmissionLate(log.submitted_at, esEnd, log.log_date);

                  return (
                    <div
                      key={log.id}
                      className="px-6 py-4 border-b border-[#F4F4F5] last:border-b-0 grid gap-4 items-center hover:bg-[#FFF1E6] transition-colors"
                      style={{
                        gridTemplateColumns:
                          "1.8fr 120px 80px 110px 80px 90px 80px",
                      }}
                    >
                      {/* Employee */}
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-[#18181B] truncate tracking-tight">
                          {log.users?.full_name}
                        </p>
                        <p className="text-[12px] text-[#71717A] truncate mt-0.5">
                          {log.projects?.name || "Miscellaneous"} ·{" "}
                          {log.category?.replace(/_/g, " ")}
                        </p>
                      </div>

                      {/* Date */}
                      <div className="text-[13.5px] text-[#52525B]">
                        {format(
                          new Date(log.log_date + "T00:00:00"),
                          "MMM d, yyyy",
                        )}
                      </div>

                      {/* Hours */}
                      <div className="text-[13.5px] font-semibold text-[#EC6824]">
                        {formatHours(log.hours)}
                      </div>

                      {/* Status */}
                      <div>
                        <Badge className="text-[11px] font-bold px-2.5 py-0.5 rounded-md border-transparent bg-[#DCFCE7] text-[#166534]">
                          Submitted
                        </Badge>
                      </div>

                      {/* Late */}
                      <div>
                        {isLate ? (
                          <Badge className="text-[11px] font-bold px-2.5 py-0.5 rounded-md border-transparent bg-yellow-100 text-yellow-800">
                            Late
                          </Badge>
                        ) : (
                          <span className="text-[#A1A1AA] text-[13px]">—</span>
                        )}
                      </div>

                      {/* Flagged */}
                      <div>
                        {log.admin_flagged ? (
                          <Badge className="text-[11px] font-bold px-2.5 py-0.5 rounded-md border-transparent bg-red-100 text-red-700">
                            Flagged
                          </Badge>
                        ) : (
                          <span className="text-[#A1A1AA] text-[13px]">—</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleFlag(log)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#FFF4EA] text-[#EC6824] hover:bg-[#FFEDD5] transition-colors"
                          title={log.admin_flagged ? "Unflag" : "Flag"}
                        >
                          <Flag
                            className={`h-[15px] w-[15px] ${log.admin_flagged ? "fill-[#EC6824]" : ""}`}
                          />
                        </button>
                        <button
                          onClick={() => toggleLock(log)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#F4F4F5] text-[#71717A] hover:bg-[#E4E4E7] transition-colors"
                          title={log.is_locked ? "Unlock" : "Lock"}
                        >
                          <Lock
                            className={`h-[15px] w-[15px] ${log.is_locked ? "text-blue-600" : ""}`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="rules">
            <Card className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium border-b pb-2">
                    Log Submission Rules
                  </h4>
                  <div className="space-y-1">
                    <Label>Log Edit Window (days)</Label>
                    <Input
                      type="number"
                      value={logEditDays}
                      onChange={(e) => setLogEditDays(e.target.value)}
                      min="1"
                      max="30"
                    />
                    <p className="text-xs text-muted-foreground">
                      Employees can submit logs for today and up to this many
                      days in the past
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label>Auto Clock-Out Time</Label>
                    <Input
                      type="time"
                      value={autoClockoutTime}
                      onChange={(e) => setAutoClockoutTime(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Currently: {formatTime12h(autoClockoutTime)}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium border-b pb-2">
                    Reporting Thresholds
                  </h4>
                  <div className="space-y-1">
                    <Label>Expected Daily Hours</Label>
                    <Input
                      type="number"
                      value={expectedHours}
                      onChange={(e) => setExpectedHours(e.target.value)}
                      min="1"
                      max="24"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used to calculate utilization percentages
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label>Underutilized Threshold (%)</Label>
                    <Input
                      type="number"
                      value={utilLow}
                      onChange={(e) => setUtilLow(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Overburdened Threshold (%)</Label>
                    <Input
                      type="number"
                      value={utilHigh}
                      onChange={(e) => setUtilHigh(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end">
                <Button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="bg-[#EC6824] hover:bg-[#c4541a] text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingSettings ? "Saving…" : "Save Rules"}
                </Button>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Log?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this log? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLog}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

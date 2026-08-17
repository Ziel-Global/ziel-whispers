import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkSettings, getPKTDateString, formatPKTTime, getPKTISOString, isLogSubmissionLate } from "@/hooks/useWorkSettings";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Pencil, CheckCircle2, History, Send, ListPlus, AlertCircle, CalendarClock, Lock, Calendar as CalendarIcon } from "lucide-react";
import { DataRow, RowPrimary, RowSecondary, RowDataGrid, RowDataItem, RowActions, TableHeader, editButtonClass } from "@/components/ui/data-row";
import { format, parseISO, startOfDay, subDays, isSameDay } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, formatHours, MISC_PROJECT_ID } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getAllowedTransitions } from "@/lib/workflow";
import { getUnfinishedDependencies, isDependencyWarnTarget } from "@/lib/dependencies";

const CATEGORIES = ["development", "meeting", "bug_fix", "code_review", "deployment", "documentation", "testing", "marketing", "seo", "research", "posting", "designing", "outbound_calls", "other"];
import { PRIORITY_COLORS, getDoneStatusIds, getStatusDisplay, getStatusColor } from "@/lib/workflow";

function getMinDateStr(days: number) {
  const d = new Date(getPKTDateString());
  d.setDate(d.getDate() - days);
  return format(d, "yyyy-MM-dd");
}

function isWithinLogEditWindow(dateStr: string, todayStr: string, windowDays: number, workingDays: number): boolean {
  if (dateStr === todayStr) return true;
  if (windowDays <= 0) return false;

  const checkDate = new Date(dateStr + "T00:00:00");
  const today = new Date(todayStr + "T00:00:00");

  if (checkDate >= today) return false;

  let workingDayCount = 0;
  const cursor = new Date(today);

  while (true) {
    cursor.setDate(cursor.getDate() - 1);
    if (cursor < checkDate) break;

    const day = cursor.getDay();
    const isWorkingDay = day !== 0 && (day !== 6 || workingDays === 6);
    if (isWorkingDay) {
      workingDayCount++;
      if (workingDayCount > windowDays) return false;
    }
  }

  return true;
}

export default function LogSubmitPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { shiftStart, shiftEnd: resolvedShiftEnd, workingDays, expectedDailyHours } = useWorkSettings();
  const overtimeEnabled = profile?.overtime_enabled ?? false;
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDraftOpen, setBulkDeleteDraftOpen] = useState(false);
  const transitionsRef = useRef<any[]>([]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [declareOutcome, setDeclareOutcome] = useState(false);
  const [selectedOutcomeStatusId, setSelectedOutcomeStatusId] = useState<string>("");
  const [dependencyWarning, setDependencyWarning] = useState("");

  const today = getPKTDateString();

  // Fetch draft logs from database (cross-device sync)
  const { data: pendingLogs = [] } = useQuery({
    queryKey: ["my-draft-logs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("*, projects(name), tasks(title)")
        .eq("user_id", user!.id)
        .eq("status", "draft")
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const declaredTaskIds = useMemo(() => {
    const ids: string[] = [];
    pendingLogs.forEach((l: any) => {
      if (l.declared_outcome_status_id && l.task_id && !ids.includes(l.task_id)) ids.push(l.task_id);
    });
    return ids;
  }, [pendingLogs]);

  const { data: declaredMoves = [] } = useQuery({
    queryKey: ["logsubmit-declared-moves", declaredTaskIds.join(",")],
    queryFn: async () => {
      if (declaredTaskIds.length === 0) return [];
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status_id, projects(workflow_template_id)")
        .in("id", declaredTaskIds);
      const templateIds = [...new Set((tasks || []).map((t: any) => t.projects?.workflow_template_id).filter(Boolean))] as string[];
      const { data: statuses } = templateIds.length > 0
        ? await supabase.from("workflow_statuses").select("id, name, color").in("workflow_template_id", templateIds)
        : { data: [] as any[] };
      const targetByTask: Record<string, string> = {};
      pendingLogs.forEach((l: any) => {
        if (l.declared_outcome_status_id && l.task_id && !targetByTask[l.task_id]) targetByTask[l.task_id] = l.declared_outcome_status_id;
      });
      return (tasks || []).map((t: any) => ({
        taskId: t.id,
        title: t.title,
        fromStatusId: t.status_id,
        toStatusId: targetByTask[t.id] || "",
        statuses: statuses || [],
      }));
    },
    enabled: declaredTaskIds.length > 0,
  });

  const { data: perEmployeeLogEditDays } = useQuery({
    queryKey: ["my-log-edit-days", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("log_edit_days").eq("id", user!.id).single();
      return data?.log_edit_days ?? null;
    },
    enabled: !!user?.id,
  });

  const effectiveLogEditDays = perEmployeeLogEditDays ?? 1;

  const minDate = getMinDateStr(10);

  const { data: logsTotals = {} } = useQuery({
    queryKey: ["my-logs-totals-range", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("log_date, hours")
        .eq("user_id", user!.id)
        .eq("status", "submitted")
        .gte("log_date", minDate);
      
      const totals: Record<string, number> = {};
      data?.forEach((l: any) => {
        totals[l.log_date] = (totals[l.log_date] || 0) + Number(l.hours);
      });
      return totals;
    },
    staleTime: 30000,
    enabled: !!user?.id,
  });

  const schema = z.object({
    project_id: z.string().min(1, "Please select a project"),
    category: z.string().min(1, "Category is required"),
    hours: z.number().min(0.25, "Min 0.25 hours").max(24, "Max 24 hours"),
    description: z.string().min(20, "Min 20 characters"),
    log_date: z.string().min(1, "Date is required").refine((v) => {
      const day = new Date(v + "T00:00:00").getDay();
      // Overtime users can log on any day (including weekends)
      if (overtimeEnabled) return true;
      if (day === 0) return false;
      if (day === 6 && workingDays === 5) return false;
      return true;
    }, "Cannot submit logs for this day").refine((v) => {
      return isWithinLogEditWindow(v, today, effectiveLogEditDays, workingDays);
    }, "You are not allowed to edit logs for this date").refine((v) => {
      // Overtime users have no daily cap
      if (overtimeEnabled) return true;
      const total = logsTotals[v] || 0;
      return total < 24;
    }, "This day already has the maximum hours logged"),
    task_id: z.string().nullable().optional(),
  }).refine((data) => {
    if (data.project_id && data.project_id !== MISC_PROJECT_ID) {
      return !!data.task_id;
    }
    return true;
  }, {
    message: "Please select a task (or 'Other')",
    path: ["task_id"],
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["my-projects", user?.id],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("project_members")
        .select("project_id, projects(id, name, status)")
        .eq("user_id", user!.id)
        .is("removed_at", null);
      return (memberships || [])
        .map((m: any) => m.projects)
        .filter((p: any) => p && p.status === "active")
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    enabled: !!user?.id,
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { project_id: "", category: "", hours: 1, description: "", log_date: today, task_id: null },
  });

  const descValue = form.watch("description");
  const selectedDate = form.watch("log_date");
  const selectedProjectId = form.watch("project_id");

  const { data: workflowStatuses } = useQuery({
    queryKey: ["logsubmit-workflow", selectedProjectId],
    queryFn: async () => {
      const { data: proj } = await supabase
        .from("projects")
        .select("workflow_template_id")
        .eq("id", selectedProjectId!)
        .single();
      if (!proj?.workflow_template_id) return null;
      const [statusesRes, transitionsRes] = await Promise.all([
        supabase.from("workflow_statuses").select("*").eq("workflow_template_id", proj.workflow_template_id),
        supabase.from("workflow_transitions").select("*").eq("workflow_template_id", proj.workflow_template_id),
      ]);
      transitionsRef.current = transitionsRes.data || [];
      return statusesRes.data || [];
    },
    enabled: !!selectedProjectId && selectedProjectId !== MISC_PROJECT_ID,
  });

  const { data: availableTasks = [] } = useQuery({
    queryKey: ["my-project-tasks", selectedProjectId, user?.id],
    queryFn: async () => {
      const doneStatusIds = (workflowStatuses || [])
        .filter((s: any) => s.category === "done")
        .map((s: any) => s.id);

      let query = supabase
        .from("tasks")
        .select("id, title, priority, estimated_hours, status, status_id")
        .eq("project_id", selectedProjectId!)
        .eq("assigned_to", user!.id)
        .order("title");

      if (doneStatusIds.length > 0) {
        query = query.not.in("status_id", doneStatusIds);
      }

      const { data: tasks } = await query;
      if (!tasks) return [];
      const taskIds = tasks.map((t: any) => t.id);
      const { data: logs } = await supabase
        .from("daily_logs")
        .select("task_id, hours")
        .in("task_id", taskIds)
        .neq("status", "draft");
      const loggedMap: Record<string, number> = {};
      (logs || []).forEach((l: any) => {
        loggedMap[l.task_id] = (loggedMap[l.task_id] || 0) + Number(l.hours || 0);
      });
      return tasks.map((t: any) => ({
        ...t,
        logged_hours: loggedMap[t.id] || 0,
      }));
    },
    enabled: !!selectedProjectId && selectedProjectId !== MISC_PROJECT_ID && !!user?.id,
  });

  // Fetch submitted logs for the CURRENTLY SELECTED date in the form
  const { data: dateLogs = [] } = useQuery({
    queryKey: ["my-logs-date", user?.id, selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      const { data } = await supabase
        .from("daily_logs")
        .select("*, projects(name)")
        .eq("user_id", user!.id)
        .eq("log_date", selectedDate)
        .eq("status", "submitted")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id && !!selectedDate,
  });

  const submittedHours = useMemo(() => dateLogs.reduce((sum, l) => sum + Number(l.hours), 0), [dateLogs]);
  const pendingHoursForSelectedDate = useMemo(() => 
    pendingLogs.filter((p: any) => p.log_date === selectedDate && p.id !== editId).reduce((sum: number, l: any) => sum + Number(l.hours), 0),
    [pendingLogs, selectedDate, editId]
  );
  
  const totalHoursForSelectedDate = submittedHours + pendingHoursForSelectedDate;
  const remainingFor8 = overtimeEnabled ? 24 : Math.max(0, 24 - totalHoursForSelectedDate);
  const logsAreAllForToday = useMemo(() =>
    pendingLogs.length > 0 && pendingLogs.every((log: any) => log.log_date === today),
    [pendingLogs, today]
  );
  const tasksWithRemaining = useMemo(() => {
    const pendingMap: Record<string, number> = {};
    pendingLogs.forEach((l: any) => {
      if (l.task_id) {
        pendingMap[l.task_id] = (pendingMap[l.task_id] || 0) + Number(l.hours || 0);
      }
    });
    return availableTasks.map((t: any) => ({
      ...t,
      remaining_hours: t.estimated_hours
        ? Math.max(t.estimated_hours - (t.logged_hours || 0) - (pendingMap[t.id] || 0), 0)
        : null,
    }));
  }, [availableTasks, pendingLogs]);
  const selectedTaskId = form.watch("task_id");
  const selectedTask = selectedTaskId ? availableTasks.find((t: any) => t.id === selectedTaskId) : null;
  const allowedTransitions = useMemo(() => {
    if (!selectedTask?.status_id || !workflowStatuses) return [];
    return getAllowedTransitions(workflowStatuses, transitionsRef.current, selectedTask.status_id);
  }, [selectedTask?.status_id, workflowStatuses]);
  useEffect(() => {
    if (declareOutcome && allowedTransitions.length === 1) {
      setSelectedOutcomeStatusId(allowedTransitions[0].id);
    }
  }, [declareOutcome, allowedTransitions]);

  const pendingOutcomeStatusId = declareOutcome
    ? (selectedOutcomeStatusId || (allowedTransitions.length === 1 ? allowedTransitions[0].id : ""))
    : "";
  useEffect(() => {
    if (!pendingOutcomeStatusId || !selectedTask?.id || !workflowStatuses) {
      setDependencyWarning("");
      return;
    }
    const targetStatus = workflowStatuses.find((s: any) => s.id === pendingOutcomeStatusId);
    if (!targetStatus || !isDependencyWarnTarget(targetStatus.category)) {
      setDependencyWarning("");
      return;
    }
    let cancelled = false;
    getUnfinishedDependencies(selectedTask.id, workflowStatuses).then((deps) => {
      if (cancelled) return;
      setDependencyWarning(
        deps.length > 0 ? `Unfinished dependencies: ${deps.map((d) => d.title).join(", ")}` : ""
      );
    });
    return () => {
      cancelled = true;
    };
  }, [pendingOutcomeStatusId, selectedTask?.id, workflowStatuses]);
  // TEMPORARILY COMMENTED OUT FOR TESTING MULTIPLE LOG SUBMISSIONS PER DAY
  // const isLocked = !overtimeEnabled && profile?.role !== "admin" && (
  //   selectedDate === today
  //     ? submittedHours > 0
  //     : submittedHours >= 8
  // );
  const isLocked = false; // Disabled lockout for manual testing

  const onAddLog = async (data: z.infer<typeof schema>) => {
    const currentHours = Number(data.hours);
    const maxDaily = 24;
    if (submittedHours + pendingHoursForSelectedDate + currentHours > maxDaily + 0.01 && profile?.role !== "admin") {
      toast.error(`You can only log up to ${maxDaily} hours per day. You have already logged ${submittedHours}h and have ${pendingHoursForSelectedDate}h pending.`);
      return;
    }
    if (declareOutcome && allowedTransitions.length > 1 && !selectedOutcomeStatusId) {
      toast.error("Select the stage that actually happened before adding the log.");
      return;
    }
    const declaredTarget = declareOutcome
      ? (selectedOutcomeStatusId || (allowedTransitions.length === 1 ? allowedTransitions[0].id : ""))
      : "";

    try {
      const finalTaskId = data.task_id === "other" ? null : (data.task_id || null);

      if (editId) {
        const hoursStatusId = selectedTask?.status_id || null;

        // Update existing draft in database
        const { error } = await supabase.from("daily_logs").update({
          project_id: data.project_id === MISC_PROJECT_ID ? null : data.project_id || null,
          category: data.category,
          hours: data.hours,
          description: data.description,
          log_date: data.log_date,
          task_id: finalTaskId,
          hours_status_id: hoursStatusId,
          declared_transition_to: declaredTarget || null,
          declared_outcome_status_id: declaredTarget || null,
        }).eq("id", editId).eq("status", "draft");
        if (error) throw error;
        setEditId(null);
        toast.success("Log updated");
      } else {
        const hoursStatusId = selectedTask?.status_id || null;

        // Insert new draft into database
        const { error } = await supabase.from("daily_logs").insert({
          user_id: user!.id,
          project_id: data.project_id === MISC_PROJECT_ID ? null : data.project_id || null,
          category: data.category,
          hours: data.hours,
          description: data.description,
          log_date: data.log_date,
          status: "draft",
          is_late: false,
          is_overtime: false,
          task_id: finalTaskId,
          hours_status_id: hoursStatusId,
          declared_transition_to: declaredTarget || null,
          declared_outcome_status_id: declaredTarget || null,
        });
        if (error) throw error;
        toast.success("Log added to list");
      }
      queryClient.invalidateQueries({ queryKey: ["my-draft-logs"] });
      form.reset({ ...form.getValues(), hours: 1, description: "", task_id: null });
      setDeclareOutcome(false);
      setSelectedOutcomeStatusId("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const startEdit = (log: any) => {
    setEditId(log.id);
    setDeclareOutcome(!!log.declared_outcome_status_id);
    setSelectedOutcomeStatusId(log.declared_outcome_status_id || "");
    form.reset({
      project_id: log.project_id || "",
      category: log.category,
      hours: log.hours,
      description: log.description,
      log_date: log.log_date,
      task_id: log.task_id || (log.project_id && log.project_id !== MISC_PROJECT_ID ? "other" : null),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditId(null);
    setDeclareOutcome(false);
    setSelectedOutcomeStatusId("");
    form.reset({ project_id: "", category: "", hours: 1, description: "", log_date: today, task_id: null });
  };

  const removePendingLog = async (logId: string) => {
    try {
      const { error } = await supabase.from("daily_logs").delete().eq("id", logId).eq("status", "draft");
      if (error) throw error;
      if (editId === logId) cancelEdit();
      queryClient.invalidateQueries({ queryKey: ["my-draft-logs"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleBulkDeleteDrafts = async () => {
    const ids = Array.from(selectedDraftIds);
    if (!ids.length) return;
    const { error } = await supabase.from("daily_logs").delete().in("id", ids).eq("status", "draft");
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} draft log${ids.length > 1 ? "s" : ""} deleted`);
    setSelectedDraftIds(new Set());
    setBulkDeleteDraftOpen(false);
    queryClient.invalidateQueries({ queryKey: ["my-draft-logs"] });
  };

  const handleSubmitAll = async () => {
    if (pendingLogs.length === 0) return;
    setSubmitting(true);
    try {
      const nowPKTStr = getPKTISOString();
      const nowPKT = new Date(nowPKTStr);
      const todayStr = getPKTDateString();

      // Compute per-log late flag: if log_date is before today, always late;
      // otherwise compare submission time against today's shift end deadline
      const isLateForDate = (logDate: string): boolean => {
        if (logDate < todayStr) return true;
        if (resolvedShiftEnd && resolvedShiftEnd.includes(":")) {
          const shiftEndTrimmed = resolvedShiftEnd.substring(0, 5);
          const todayDeadline = new Date(`${todayStr}T${shiftEndTrimmed}:00+05:00`);
          if (shiftStart && resolvedShiftEnd < shiftStart) {
            todayDeadline.setDate(todayDeadline.getDate() + 1);
          }
          return nowPKT.getTime() > todayDeadline.getTime();
        }
        return false;
      };

      // Build per-log overtime flags
      const overtimeFlags: Record<string, boolean> = {};
      if (overtimeEnabled) {
        const logsByDate: Record<string, any[]> = {};
        pendingLogs.forEach((log: any) => {
          if (!logsByDate[log.log_date]) logsByDate[log.log_date] = [];
          logsByDate[log.log_date].push(log);
        });
        for (const [date, dLogs] of Object.entries(logsByDate)) {
          const existingTotal = logsTotals[date] || 0;
          let runningTotal = existingTotal;
          for (const log of dLogs) {
            const logHours = Number(log.hours);
            overtimeFlags[log.id] = runningTotal >= 8 || runningTotal + logHours > 8;
            runningTotal += logHours;
          }
        }
      }

      // Build a map of task_id -> current status_id for all touched tasks
      const touchedTaskIds = [...new Set(
        pendingLogs.filter((l: any) => l.task_id).map((l: any) => l.task_id)
      )] as string[];
      const taskStatusMap: Record<string, string | null> = {};
      if (touchedTaskIds.length > 0) {
        const { data: taskStatuses } = await supabase
          .from("tasks")
          .select("id, status_id")
          .in("id", touchedTaskIds);
        (taskStatuses || []).forEach((t: any) => { taskStatusMap[t.id] = t.status_id; });
      }

      // Update each draft to submitted with computed fields + status_id, hours_status_id, and declared_transition_to
      for (const log of pendingLogs) {
        const activeStatusId = log.task_id ? (taskStatusMap[log.task_id] || null) : null;
        const transitionTarget = log.declared_transition_to || log.declared_outcome_status_id || null;

        const { error } = await supabase.from("daily_logs").update({
          status: "submitted",
          is_late: isLateForDate(log.log_date),
          is_overtime: overtimeFlags[log.id] || false,
          submitted_at: nowPKTStr,
          status_id: activeStatusId,
          hours_status_id: log.hours_status_id || activeStatusId,
          declared_transition_to: transitionTarget,
        }).eq("id", log.id).eq("status", "draft");
        if (error) throw error;
      }

      // Declare stage outcome for each draft that carries a stored intent, once per task
      const outcomeErrors: string[] = [];
      const declaredByTask: Record<string, string> = {};
      for (const log of pendingLogs) {
        if (log.declared_outcome_status_id && log.task_id && !declaredByTask[log.task_id]) {
          declaredByTask[log.task_id] = log.declared_outcome_status_id;
        }
      }
      for (const [taskId, toStatusId] of Object.entries(declaredByTask)) {
        const { error } = await supabase.rpc("declare_stage_outcome", {
          p_task_id: taskId,
          p_to_status_id: toStatusId,
          p_changed_by_type: "admin",
        });
        if (error) outcomeErrors.push(error.message);
      }
      const movedTasks = declaredMoves.filter((m: any) => m.toStatusId);
      const outcomeApplied = movedTasks.length > 0 && outcomeErrors.length === 0;

      // Only auto clock out if at least one of today's logs is being submitted AND the open session is from today
      const hasTodayLogs = pendingLogs.some((log: any) => log.log_date === todayStr);

      const { data: openSession } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user!.id)
        .is("clock_out", null)
        .not("clock_in", "is", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      let clockedOut = false;
      if (openSession && hasTodayLogs && openSession.date === todayStr) {
        const { error: clockOutError } = await supabase
          .from("attendance")
          .update({ clock_out: nowPKTStr })
          .eq("id", openSession.id);
        if (clockOutError) throw clockOutError;

        await supabase.from("audit_logs").insert({
          actor_id: user!.id,
          action: "attendance.clocked_out",
          target_entity: "attendance",
          target_id: openSession.id,
          metadata: {
            clock_out: nowPKTStr,
            date: openSession.date,
            trigger: "log_submission",
          },
        });
        clockedOut = true;
      }

      await supabase.from("audit_logs").insert({
        actor_id: user!.id,
        action: "log.bulk_submitted",
        target_entity: "daily_logs",
        metadata: { count: pendingLogs.length }
      });

      setDeclareOutcome(false);
      setSelectedOutcomeStatusId("");

      const movedText = movedTasks.length === 1
        ? ` · moved to ${getStatusDisplay(movedTasks[0].statuses, movedTasks[0].toStatusId).name}`
        : ` · moved ${movedTasks.length} tasks to next stage`;
      const baseMsg = `${pendingLogs.length} log${pendingLogs.length > 1 ? "s" : ""} submitted${clockedOut ? " and clocked out" : ""}${outcomeApplied ? movedText : ""}`;

      if (outcomeErrors.length > 0) {
        toast.warning(`Logs submitted, but the stage move failed: ${outcomeErrors.join("; ")}`);
      } else {
        toast.success(`${baseMsg} successfully`);
      }

      form.reset({ project_id: "", category: "", hours: 1, description: "", log_date: today, task_id: null });
      queryClient.invalidateQueries({ queryKey: ["my-draft-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["my-logs-date"] });
      await queryClient.invalidateQueries({ queryKey: ["my-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["my-logs-totals-range"] });
      await queryClient.invalidateQueries({ queryKey: ["my-project-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["missing-log-check"] });
      await queryClient.invalidateQueries({ queryKey: ["my-day-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["my-month-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      if (clockedOut) {
        await queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
        await queryClient.invalidateQueries({ queryKey: ["attendance-month"] });
        await queryClient.invalidateQueries({ queryKey: ["attendance-open-session"] });
        await queryClient.invalidateQueries({ queryKey: ["dashboard-team-today"] });
      }
      setShowSubmitConfirm(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const progressPercentage = Math.min((totalHoursForSelectedDate / expectedDailyHours) * 100, 100);
  const remainingHoursForTarget = Math.max(expectedDailyHours - totalHoursForSelectedDate, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Logs</h1>
          <p className="text-muted-foreground mt-1">{new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date())}</p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="text-xs font-mono">PKT Time</Badge>
        </div>
      </div>

      <Card className="p-6 border-2 border-primary/5 shadow-lg bg-card/50 backdrop-blur-sm">
        {/* Daily Progress Bar */}
        <div className="mb-8 p-4 bg-muted rounded-xl border border-primary/10">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-black" />
              <span className="text-md font-semibold">Logging Progress for {format(parseISO(selectedDate), "MMM d")}</span>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 bg-primary rounded-full">Target: {expectedDailyHours} Hours</span>
          </div>
          <Progress value={progressPercentage} className="h-2 bg-gray-200" />
          <div className="flex justify-between items-center mt-2 text-xs">
            <div>
              <p className="font-medium text-black">{totalHoursForSelectedDate} of {expectedDailyHours} hours total</p>
              {submittedHours > 0 && <p className="text-[10px] text-muted-foreground">({submittedHours}h already submitted)</p>}
            </div>
            {remainingHoursForTarget > 0 ? (
              <p className="text-muted-foreground">{remainingHoursForTarget}h remaining</p>
            ) : (
              <p className="text-green-600 font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Day Limit Reached</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-primary rounded-lg text-primary">
            <ListPlus className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold">{editId ? "Edit Log Entry" : "Add New Log Entry"}</h2>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onAddLog)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="project_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLocked}>
                    <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      <SelectItem value={MISC_PROJECT_ID}>Miscellaneous</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLocked}>
                    <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hours" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Duration (Hours)</FormLabel>
                  <FormControl>
                  <Input type="number" step="0.25" min="0.25" className="bg-background" {...field} onChange={e => field.onChange(Number(e.target.value))} disabled={isLocked} max={24} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="log_date" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Log Date</FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal bg-background h-10",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isLocked}
                        >
                          {field.value ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? parseISO(field.value) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            field.onChange(format(date, "yyyy-MM-dd"));
                            setIsCalendarOpen(false);
                          }
                        }}
                        disabled={(date) => {
                          const dateStr = format(date, "yyyy-MM-dd");
                          const day = date.getDay();
                          
                          // Overtime users can log on any day
                          if (!overtimeEnabled) {
                            // Disable Sunday
                            if (day === 0) return true;
                            // Disable Saturday if 5-day worker
                            if (day === 6 && workingDays === 5) return true;
                          }
                          
                          // Enforce per-employee log edit window (working days only)
                          if (!isWithinLogEditWindow(dateStr, today, effectiveLogEditDays, workingDays)) return true;
                          
                          // Disable if already has 24+ hours (hard cap)
                          if ((logsTotals[dateStr] || 0) >= 24) return true;
                          
                          // Future dates (just in case)
                          if (date > new Date()) return true;

                          return false;
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {selectedProjectId && selectedProjectId !== MISC_PROJECT_ID && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Task (Required) *</span>
                <div className="space-y-1">
                  {tasksWithRemaining.map((t: any) => (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between p-2.5 border rounded-md cursor-pointer transition-colors ${
                        form.watch("task_id") === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => form.setValue("task_id", form.watch("task_id") === t.id ? null : t.id, { shouldDirty: true, shouldValidate: true })}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          form.watch("task_id") === t.id ? "border-primary" : "border-muted-foreground"
                        }`}>
                          {form.watch("task_id") === t.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <span className="text-sm font-medium truncate">{t.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {t.remaining_hours !== null && <span className="text-xs text-muted-foreground">{t.remaining_hours}h left</span>}
                        <Badge className={PRIORITY_COLORS[t.priority] || ""}>{t.priority}</Badge>
                      </div>
                    </div>
                  ))}
                  <div
                    key="other-task-option"
                    className={`flex items-center justify-between p-2.5 border rounded-md cursor-pointer transition-colors ${
                      form.watch("task_id") === "other" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => form.setValue("task_id", form.watch("task_id") === "other" ? null : "other", { shouldDirty: true, shouldValidate: true })}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        form.watch("task_id") === "other" ? "border-primary" : "border-muted-foreground"
                      }`}>
                        {form.watch("task_id") === "other" && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <span className="text-sm font-medium truncate">Other</span>
                    </div>
                  </div>
                </div>
                {form.formState.errors.task_id && (
                  <p className="text-xs font-medium text-destructive mt-1">{form.formState.errors.task_id.message as string}</p>
                )}
              </div>
            )}

            {selectedTask && selectedTask.id !== "other" && selectedTask.status_id && workflowStatuses && allowedTransitions.length > 0 && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-start gap-3">
                  <input type="checkbox" id="declare-outcome" checked={declareOutcome}
                    onChange={(e) => { setDeclareOutcome(e.target.checked); if (!e.target.checked) setSelectedOutcomeStatusId(""); }}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                  <label htmlFor="declare-outcome" className="text-sm cursor-pointer select-none">
                    <span className="font-medium">Change Task Status</span>
                    <span className="block text-xs text-muted-foreground">
                      Tick this to move the task to its next stage when you submit this log.
                    </span>
                  </label>
                </div>
                {declareOutcome && (
                  <div className="ml-7 space-y-2">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Your log will move</span>{" "}
                      <span className="font-medium">{selectedTask.title}</span>{" "}
                      <span className="text-muted-foreground">to the next stage:</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(workflowStatuses, selectedTask.status_id)}>
                        {getStatusDisplay(workflowStatuses, selectedTask.status_id).name}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      {allowedTransitions.length === 1 ? (
                        <Badge className={getStatusColor(workflowStatuses, allowedTransitions[0].id)}>
                          {getStatusDisplay(workflowStatuses, allowedTransitions[0].id).name}
                        </Badge>
                      ) : (
                        <Select value={selectedOutcomeStatusId} onValueChange={setSelectedOutcomeStatusId}>
                          <SelectTrigger className="w-[220px] h-9">
                            <SelectValue placeholder="Which stage actually happened?" />
                          </SelectTrigger>
                          <SelectContent>
                            {allowedTransitions.map((s: any) => (
                              <SelectItem key={s.id} value={s.id}>{s.name.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                )}
                {dependencyWarning && (
                  <div className="ml-7 bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                    <span className="font-medium">⚠ {dependencyWarning}</span>
                  </div>
                )}
              </div>
            )}

            {(selectedProjectId === MISC_PROJECT_ID || Boolean(form.watch("task_id"))) && (
              <>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</FormLabel>
                    <FormControl><Textarea {...field} rows={3} className="bg-background resize-none" placeholder="Explain your progress..." disabled={isLocked} /></FormControl>
                    <div className="flex justify-between items-center px-1">
                      <FormMessage />
                      <span className={`text-[10px] font-mono ${descValue?.length < 20 ? "text-destructive" : "text-muted-foreground"}`}>{descValue?.length || 0} / 20 chars min</span>
                    </div>
                  </FormItem>
                )} />

                {isLocked ? (
                  <div className="bg-muted p-6 rounded-xl border-2 border-dashed flex flex-col items-center text-center space-y-3">
                    <div className="p-3 bg-primary/10 rounded-full"><Lock className="h-6 w-6 text-primary" /></div>
                    <div>
                      <p className="font-bold">Daily Limit Reached</p>
                      <p className="text-sm text-muted-foreground">You have already submitted logs for {format(parseISO(selectedDate), "MMM do")}.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => navigate("/logs/my")} className="rounded-button">Go to My Logs</Button>
                  </div>
                ) : (
                  <div className="flex justify-end gap-3 pt-2">
                    {editId && (
                      <Button type="button" variant="ghost" onClick={cancelEdit} className="rounded-button">Cancel Edit</Button>
                    )}
                    <Button type="submit" className="rounded-button px-8" disabled={!overtimeEnabled && totalHoursForSelectedDate >= 24 && !editId}>
                      {editId ? "Update Log Entry" : "Add Log Entry"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </form>
        </Form>
      </Card>

      {/* Pending Section */}
      {pendingLogs.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1 pt-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-black" />
              <h2 className="text-lg font-semibold">Unsubmitted Logs</h2>
              <Badge variant="secondary" className="ml-1 bg-primary">{pendingLogs.length}</Badge>
            </div>
            <Button onClick={() => setShowSubmitConfirm(true)} disabled={submitting} className="rounded-button bg-primary hover:bg-primary/90 text-white px-6">
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Submitting..." : "Submit All Logs"}
            </Button>
          </div>
          <div>
            <TableHeader gridCols="40px 1fr 112px 80px 200px 80px">
              <div className="flex items-center justify-center">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                  checked={selectedDraftIds.size === pendingLogs.length && pendingLogs.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedDraftIds(new Set(pendingLogs.map((log: any) => log.id)));
                    else setSelectedDraftIds(new Set());
                  }} />
              </div>
              <span>PROJECT</span>
              <span>DATE</span>
              <span>HOURS</span>
              <span>DESCRIPTION</span>
              <span className="text-right">ACTIONS</span>
            </TableHeader>
            {selectedDraftIds.size > 0 && (
              <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
                <span className="text-sm text-blue-700">{selectedDraftIds.size} draft{selectedDraftIds.size > 1 ? "s" : ""} selected</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedDraftIds(new Set())} className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg bg-white">Clear selection</button>
                  <button onClick={() => setBulkDeleteDraftOpen(true)} className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> Delete selected
                  </button>
                </div>
              </div>
            )}
            {pendingLogs.map((log: any) => (
              <DataRow key={log.id} gridCols="40px 1fr 112px 80px 200px 80px">
                <div className="flex items-center justify-center">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                    checked={selectedDraftIds.has(log.id)}
                    onChange={(e) => {
                      const next = new Set(selectedDraftIds);
                      if (e.target.checked) next.add(log.id); else next.delete(log.id);
                      setSelectedDraftIds(next);
                    }} />
                </div>
                <div className="min-w-0">
                  <RowPrimary>{log.projects?.name || "Project"}</RowPrimary>
                  <RowSecondary>{log.category.replace(/_/g, " ")} · {log.tasks?.title || "No task"}{log.declared_outcome_status_id && <span className="text-blue-600 font-medium"> · will move to next stage</span>}</RowSecondary>
                </div>
                <RowDataItem label="DATE">{format(parseISO(log.log_date), "MMM d, yyyy")}</RowDataItem>
                <RowDataItem label="HOURS">{formatHours(log.hours)}</RowDataItem>
                <RowDataItem label="DESCRIPTION" className="truncate">{log.description}</RowDataItem>
                <RowActions className="justify-self-end">
                  <button onClick={() => startEdit(log)} className={editButtonClass} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDeleteConfirmId(log.id)} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-destructive" title="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </RowActions>
              </DataRow>
            ))}
          </div>
        </div>
      )}

      {/* History Section for the SELECTED date */}
      {dateLogs.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 px-1">
            <History className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-muted-foreground">Submitted Logs for {format(parseISO(selectedDate), "MMM d")}</h2>
          </div>
          <div className="grid gap-3 opacity-75">
            {dateLogs.map((log: any) => (
              <Card key={log.id} className={`p-4 border-none shadow-none ${log.is_overtime ? "bg-purple-50 border-l-4 border-purple-400" : "bg-muted"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap gap-2 items-center">
                      {log.projects?.name && <Badge variant="secondary" className="text-sm tracking-tighter bg-primary">{log.projects.name}</Badge>}
                      <Badge variant="secondary" className="text-sm tracking-tighter bg-primary">{log.category}</Badge>
                      <span className="text-sm font-medium">{formatHours(log.hours)}</span>
                      {log.is_overtime && <Badge className="bg-purple-100 text-purple-700 text-[10px]">Overtime</Badge>}
                      {log.submitted_at && isLogSubmissionLate(log.submitted_at, resolvedShiftEnd, log.log_date) && <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Late</Badge>}
                    </div>
                    <p className="text-sm text-black">{log.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[12px] text-muted-foreground font-mono">{formatPKTTime(log.submitted_at)}</span>
                    <Badge variant="secondary" className="text-[12px] bg-primary">Submitted</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Help Info */}
      <div className="flex items-center gap-3 p-4 bg-muted/40 rounded-xl border-black border border-2 border-dashed text-muted-foreground">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-xs">
          {overtimeEnabled
            ? "Tip: Overtime is enabled for your account. You can log hours beyond 8h and submit logs on weekends. Hours above 8h per day are tracked as overtime."
            : "Tip: You can select a past date to submit logs you might have missed. You can submit multiple logs for the same day until you reach the daily limit."}
        </p>
      </div>

      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary"><Send className="h-5 w-5" />Final Submission</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p className="font-semibold text-foreground">Are you sure you want to submit all {pendingLogs.length} logs?</p>
              {declaredMoves.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-md text-blue-900 text-xs flex gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {declaredMoves.length === 1
                        ? "This will also move the task to its next stage:"
                        : `This will also move ${declaredMoves.length} tasks to their next stages:`}
                    </p>
                    {declaredMoves.map((m: any) => (
                      <p key={m.taskId}>
                        <span className="font-medium">{m.title}:</span>{" "}
                        <Badge className={getStatusColor(m.statuses, m.fromStatusId)}>
                          {getStatusDisplay(m.statuses, m.fromStatusId).name}
                        </Badge>{" "}
                        →{" "}
                        <Badge className={getStatusColor(m.statuses, m.toStatusId)}>
                          {getStatusDisplay(m.statuses, m.toStatusId).name}
                        </Badge>
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {logsAreAllForToday && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-md text-amber-800 text-xs flex gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div className="space-y-1">
                    <p><strong>Warning:</strong> This action is irreversible.</p>
                    <p>You will be automatically clocked out from your current attendance session when these logs are submitted.</p>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmitAll} className="rounded-button bg-primary hover:bg-primary/90 text-white">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This unsubmitted log will be removed from your list.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && removePendingLog(deleteConfirmId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDraftOpen} onOpenChange={setBulkDeleteDraftOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedDraftIds.size} Draft Log{selectedDraftIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This unsubmitted log will be removed from your list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteDrafts} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

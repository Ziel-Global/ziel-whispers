import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkSettings, getPKTDateString, getPKTISOString } from "@/hooks/useWorkSettings";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { MISC_PROJECT_ID } from "@/lib/utils";
import { getAllowedTransitions, getStatusDisplay } from "@/lib/workflow";
import { getUnfinishedDependencies, isDependencyWarnTarget } from "@/lib/dependencies";
import { getMinDateStr, isWithinLogEditWindow } from "@/utils/logDateUtils";

export function useLogSubmitData() {
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

  // 1. Fetch draft logs from database
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

  // 2. Fetch declared moves for tasks
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

  // 3. Per-employee log edit days override
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

  // 4. Log totals for recent range
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

  // 5. Form schema
  const schema = z.object({
    project_id: z.string().min(1, "Please select a project"),
    category: z.string().min(1, "Category is required"),
    hours: z.number().min(0.25, "Min 0.25 hours").max(24, "Max 24 hours"),
    description: z.string().min(20, "Min 20 characters"),
    log_date: z.string().min(1, "Date is required").refine((v) => {
      const day = new Date(v + "T00:00:00").getDay();
      if (overtimeEnabled) return true;
      if (day === 0) return false;
      if (day === 6 && workingDays === 5) return false;
      return true;
    }, "Cannot submit logs for this day").refine((v) => {
      return isWithinLogEditWindow(v, today, effectiveLogEditDays, workingDays);
    }, "You are not allowed to edit logs for this date").refine((v) => {
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

  // 6. User projects query
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

  // 7. Workflow statuses query
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

  // 8. User project role query
  const { data: logSubmitUserRoleId } = useQuery({
    queryKey: ["logsubmit-user-project-role", selectedProjectId, user?.id],
    queryFn: async () => {
      if (!user?.id || !selectedProjectId) return null;
      const { data } = await supabase
        .from("project_members")
        .select("project_role_id")
        .eq("project_id", selectedProjectId)
        .eq("user_id", user.id)
        .is("removed_at", null)
        .maybeSingle();
      return data?.project_role_id ?? null;
    },
    enabled: !!user?.id && !!selectedProjectId && selectedProjectId !== MISC_PROJECT_ID,
  });

  const isLogSubmitSystemAdmin = profile?.role === "admin" || profile?.role === "manager";

  // 9. Available tasks query
  const { data: availableTasks = [] } = useQuery({
    queryKey: ["my-project-tasks", selectedProjectId, user?.id],
    queryFn: async () => {
      const doneStatusIds = (workflowStatuses || [])
        .filter((s: any) => s.category === "done")
        .map((s: any) => s.id);

      let query = supabase
        .from("tasks")
        .select("id, title, priority, estimated_hours, status, status_id, is_flagged")
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

  // 10. Date logs query for currently selected date
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
    return getAllowedTransitions(
      workflowStatuses,
      transitionsRef.current,
      selectedTask.status_id,
      logSubmitUserRoleId ?? null,
      isLogSubmitSystemAdmin
    );
  }, [selectedTask?.status_id, workflowStatuses, logSubmitUserRoleId, isLogSubmitSystemAdmin]);

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

  const isLocked = !overtimeEnabled && profile?.role !== "admin" && (
    selectedDate === today
      ? submittedHours > 0
      : submittedHours >= 8
  );

  const onAddLog = async (data: any) => {
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
    if (declareOutcome && selectedTask?.is_flagged) {
      toast.error(`Cannot declare stage outcome for "${selectedTask.title}" — it is blocked by an active blocker.`);
      return;
    }
    const declaredTarget = declareOutcome
      ? (selectedOutcomeStatusId || (allowedTransitions.length === 1 ? allowedTransitions[0].id : ""))
      : "";

    try {
      const finalTaskId = data.task_id === "other" ? null : (data.task_id || null);

      if (editId) {
        const hoursStatusId = selectedTask?.status_id || null;
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

  return {
    navigate,
    user,
    profile,
    shiftStart,
    resolvedShiftEnd,
    workingDays,
    expectedDailyHours,
    overtimeEnabled,
    submitting,
    deleteConfirmId,
    setDeleteConfirmId,
    selectedDraftIds,
    setSelectedDraftIds,
    bulkDeleteDraftOpen,
    setBulkDeleteDraftOpen,
    isCalendarOpen,
    setIsCalendarOpen,
    deleteId,
    setDeleteId,
    editId,
    showSubmitConfirm,
    setShowSubmitConfirm,
    declareOutcome,
    setDeclareOutcome,
    selectedOutcomeStatusId,
    setSelectedOutcomeStatusId,
    dependencyWarning,
    today,
    pendingLogs,
    declaredMoves,
    effectiveLogEditDays,
    logsTotals,
    projects,
    form,
    descValue,
    selectedDate,
    selectedProjectId,
    workflowStatuses,
    availableTasks,
    dateLogs,
    submittedHours,
    pendingHoursForSelectedDate,
    totalHoursForSelectedDate,
    logsAreAllForToday,
    tasksWithRemaining,
    selectedTask,
    allowedTransitions,
    isLocked,
    onAddLog,
    startEdit,
    cancelEdit,
    removePendingLog,
    handleBulkDeleteDrafts,
    handleSubmitAll,
    progressPercentage,
    remainingHoursForTarget,
  };
}

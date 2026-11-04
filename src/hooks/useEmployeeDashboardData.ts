import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkSettings, getPKTDateString, isAttendanceLate } from "@/hooks/useWorkSettings";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  format,
  parseISO,
} from "date-fns";
import {
  calculateWorkingDaysInPeriod,
  calculateShiftHoursPerDay,
  calculateGrossCapacity,
  calculateLeaveHours,
  calculateNetCapacity,
  calculateUtilizationPercentage,
  calculateAttendanceRate,
  calculatePunctualityRate,
  calculateEstimateAccuracy,
  calculateOnTimeDeliveryRate,
  classifyUtilization,
  getUtilizationRAGColor,
} from "@/lib/metrics";
import { toast } from "sonner";

export function useEmployeeDashboardData() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const today = getPKTDateString();
  const {
    shiftStart,
    shiftEnd,
    workingDays,
    graceMinutes,
    annualLeaveEntitlement,
  } = useWorkSettings();

  const userId = user?.id;

  // Month and Week boundaries in PKT
  const now = useMemo(() => new Date(), []);
  const monthStartStr = useMemo(
    () => format(startOfMonth(now), "yyyy-MM-dd"),
    [now]
  );
  const monthEndStr = useMemo(
    () => format(endOfMonth(now), "yyyy-MM-dd"),
    [now]
  );
  const weekStartStr = useMemo(
    () => format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    [now]
  );
  const weekEndStr = useMemo(
    () => format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    [now]
  );

  // 1. Fetch Company Holidays for current year
  const { data: holidays = [] } = useQuery({
    queryKey: ["employee-holidays", now.getFullYear()],
    queryFn: async () => {
      const yearStart = `${now.getFullYear()}-01-01`;
      const yearEnd = `${now.getFullYear()}-12-31`;
      const { data, error } = await supabase
        .from("holidays")
        .select("date, name")
        .gte("date", yearStart)
        .lte("date", yearEnd);
      if (error) {
        console.warn("Could not fetch holidays:", error);
        return [];
      }
      return data || [];
    },
  });

  const holidayDateStrings = useMemo(
    () => holidays.map((h) => h.date),
    [holidays]
  );

  // 2. Fetch Today's Attendance Record
  const { data: todayAttendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ["employee-attendance-today", userId, today],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // 3. Fetch Month's Attendance Records
  const { data: monthAttendance = [] } = useQuery({
    queryKey: ["employee-attendance-month", userId, monthStartStr],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("date, clock_in, clock_out, is_late, minutes_late, work_mode")
        .eq("user_id", userId)
        .gte("date", monthStartStr)
        .lte("date", monthEndStr);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // 4. Fetch Today's Daily Standup Record
  const { data: todayStandup } = useQuery({
    queryKey: ["employee-standup-today", userId, today],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("daily_standups")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // 5. Fetch Daily Work Logs (Draft + Submitted for Today, Submitted for Month)
  const { data: todayLogs = [] } = useQuery({
    queryKey: ["employee-logs-today", userId, today],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*, projects(name)")
        .eq("user_id", userId)
        .eq("log_date", today);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: monthLogs = [] } = useQuery({
    queryKey: ["employee-logs-month", userId, monthStartStr],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("daily_logs")
        .select("id, hours, category, log_date, project_id, task_id, is_late, status, submitted_at, projects(name)")
        .eq("user_id", userId)
        .gte("log_date", monthStartStr)
        .lte("log_date", monthEndStr)
        .eq("status", "submitted");
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // 6. Fetch User Tasks & Collaborations
  const { data: myTasks = [] } = useQuery({
    queryKey: ["employee-my-tasks", userId],
    queryFn: async () => {
      if (!userId) return [];
      // Primary assignee tasks
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, priority, due_date, estimated_hours, created_at, completed_at, status_id, project_id, is_flagged, projects(name), workflow_statuses(id, name, category, color)")
        .eq("assigned_to", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // 7. Fetch Project Memberships & Allocations
  const { data: myProjects = [] } = useQuery({
    queryKey: ["employee-my-projects", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("project_members")
        .select("id, allocation_percentage, project_id, project_roles(name), projects(id, name, status, start_date, end_date, clients(name))")
        .eq("user_id", userId)
        .is("removed_at", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const projectIds = useMemo(
    () => myProjects.map((p: any) => p.project_id).filter(Boolean),
    [myProjects]
  );

  // Check if employee has teammates across active projects (determines solo vs team workflow)
  const { data: hasTeammates = false } = useQuery({
    queryKey: ["employee-has-teammates", userId, projectIds],
    queryFn: async () => {
      if (!userId || projectIds.length === 0) return false;
      const { count, error } = await supabase
        .from("project_members")
        .select("id", { count: "exact", head: true })
        .in("project_id", projectIds)
        .neq("user_id", userId)
        .is("removed_at", null);
      if (error) return false;
      return (count || 0) > 0;
    },
    enabled: !!userId && projectIds.length > 0,
  });

  // 8. Fetch Leave Balances & Approved Leaves this Month
  const { data: approvedLeavesMonth = [] } = useQuery({
    queryKey: ["employee-leaves-month", userId, monthStartStr],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, days_count, hours, start_date, end_date, leave_types(name)")
        .eq("user_id", userId)
        .eq("status", "approved")
        .lte("start_date", monthEndStr)
        .gte("end_date", monthStartStr);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: leaveBalances = [] } = useQuery({
    queryKey: ["employee-leave-balances", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("leave_balances")
        .select("allocated, used, leave_types(name)")
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // 9. Fetch Unacknowledged Auto Clock-Out
  const { data: unacknowledgedAutoClockout } = useQuery({
    queryKey: ["employee-auto-clockout-ack", userId],
    queryFn: async () => {
      if (!userId) return null;
      const yesterdayStr = format(subDays(now, 1), "yyyy-MM-dd");
      const { data: att } = await supabase
        .from("attendance")
        .select("id, date")
        .eq("user_id", userId)
        .eq("date", yesterdayStr)
        .eq("auto_clocked_out", true)
        .maybeSingle();

      if (!att) return null;

      const { data: ack } = await supabase
        .from("auto_clockout_acks")
        .select("id")
        .eq("attendance_id", att.id)
        .maybeSingle();

      return ack ? null : att;
    },
    enabled: !!userId,
  });

  // Standup Toggle Mutation
  const standupMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase.from("daily_standups").upsert(
        {
          user_id: userId,
          date: today,
          is_done: true,
        },
        { onConflict: "user_id, date" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-standup-today", userId, today] });
      toast.success("Standup completed for today!");
    },
    onError: (err: any) => {
      if (err.code === "42501" || err.message?.includes("row-level security")) {
        toast.error("Database permission error: Please run the 20271028000000_daily_standups_employee_rls.sql migration in Supabase SQL editor.");
      } else {
        toast.error(err.message || "Failed to mark standup");
      }
    },
  });

  // Auto-Clockout Ack Mutation
  const acknowledgeAutoClockoutMutation = useMutation({
    mutationFn: async (attendanceId: string) => {
      if (!userId) return;
      const { error } = await supabase.from("auto_clockout_acks").insert({
        user_id: userId,
        attendance_id: attendanceId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-auto-clockout-ack", userId] });
      toast.success("Auto clock-out acknowledged.");
    },
  });

  // ————— Derived Metrics Computation —————
  const shiftHours = useMemo(
    () => calculateShiftHoursPerDay(shiftStart, shiftEnd, 60),
    [shiftStart, shiftEnd]
  );

  // Month working days
  const monthWorkingDays = useMemo(() => {
    return calculateWorkingDaysInPeriod(
      { start: monthStartStr, end: monthEndStr },
      {
        workingDaysPerWeek: workingDays,
        holidays: holidayDateStrings,
        joinDate: profile?.join_date,
      }
    );
  }, [monthStartStr, monthEndStr, workingDays, holidayDateStrings, profile?.join_date]);

  // Gross and Net Capacity for Month
  const grossMonthCapacity = useMemo(
    () => calculateGrossCapacity(monthWorkingDays, shiftHours),
    [monthWorkingDays, shiftHours]
  );

  const leaveHoursMonth = useMemo(() => {
    return approvedLeavesMonth.reduce((sum: number, l: any) => {
      return sum + calculateLeaveHours(Number(l.days_count) || 0, Number(l.hours) || 0, shiftHours);
    }, 0);
  }, [approvedLeavesMonth, shiftHours]);

  const netMonthCapacity = useMemo(
    () => calculateNetCapacity(grossMonthCapacity, leaveHoursMonth),
    [grossMonthCapacity, leaveHoursMonth]
  );

  // Month Logged Hours
  const monthLoggedHours = useMemo(() => {
    return monthLogs.reduce((sum, l) => sum + (Number(l.hours) || 0), 0);
  }, [monthLogs]);

  // Today Logged Hours
  const todaySubmittedHours = useMemo(() => {
    return todayLogs
      .filter((l) => l.status === "submitted")
      .reduce((sum, l) => sum + (Number(l.hours) || 0), 0);
  }, [todayLogs]);

  const todayDraftCount = useMemo(() => {
    return todayLogs.filter((l) => l.status === "draft").length;
  }, [todayLogs]);

  // Month Utilization %
  const monthUtilizationPct = useMemo(() => {
    return calculateUtilizationPercentage(monthLoggedHours, netMonthCapacity);
  }, [monthLoggedHours, netMonthCapacity]);

  // Attendance & Punctuality
  const attendanceDaysCount = useMemo(() => {
    return monthAttendance.filter((a) => a.clock_in).length;
  }, [monthAttendance]);

  const onTimeAttendanceDaysCount = useMemo(() => {
    return monthAttendance.filter((a) => a.clock_in && !a.is_late).length;
  }, [monthAttendance]);

  const attendanceRate = useMemo(() => {
    return calculateAttendanceRate(attendanceDaysCount, monthWorkingDays);
  }, [attendanceDaysCount, monthWorkingDays]);

  const punctualityRate = useMemo(() => {
    return calculatePunctualityRate(onTimeAttendanceDaysCount, attendanceDaysCount);
  }, [onTimeAttendanceDaysCount, attendanceDaysCount]);

  // Completed Tasks & On-time Delivery (Last 30 Days)
  const completedTasks = useMemo(() => {
    return myTasks.filter((t: any) => t.workflow_statuses?.category === "done");
  }, [myTasks]);

  const onTimeDeliveryRate = useMemo(() => {
    const withDueDate = completedTasks.filter((t: any) => !!t.due_date && !!t.completed_at);
    if (!withDueDate.length) return 100;
    const onTime = withDueDate.filter(
      (t: any) => parseISO(t.completed_at.slice(0, 10)) <= parseISO(t.due_date)
    ).length;
    return calculateOnTimeDeliveryRate(onTime, withDueDate.length);
  }, [completedTasks]);

  // Estimate Accuracy
  const estimateAccuracy = useMemo(() => {
    const valid = completedTasks.filter(
      (t: any) => Number(t.estimated_hours) > 0
    );
    if (!valid.length) return 1.0;
    // Map tasks to logged hours
    const taskLoggedHoursMap: Record<string, number> = {};
    monthLogs.forEach((l) => {
      if (l.task_id) {
        taskLoggedHoursMap[l.task_id] = (taskLoggedHoursMap[l.task_id] || 0) + Number(l.hours);
      }
    });

    const ratios = valid
      .map((t) => {
        const logged = taskLoggedHoursMap[t.id] || Number(t.estimated_hours);
        return calculateEstimateAccuracy(logged, Number(t.estimated_hours));
      })
      .filter((r): r is number => r !== null);

    if (!ratios.length) return 1.0;
    return Math.round((ratios.reduce((s, r) => s + r, 0) / ratios.length) * 100) / 100;
  }, [completedTasks, monthLogs]);

  // Tasks Due buckets
  const tasksDueCounts = useMemo(() => {
    let dueToday = 0;
    let dueThisWeek = 0;
    let overdue = 0;

    myTasks.forEach((t: any) => {
      if (t.workflow_statuses?.category === "done" || !t.due_date) return;
      if (t.due_date < today) overdue++;
      else if (t.due_date === today) dueToday++;
      else if (t.due_date <= weekEndStr) dueThisWeek++;
    });

    return { dueToday, dueThisWeek, overdue };
  }, [myTasks, today, weekEndStr]);

  // Log Streak Calculation
  const logStreak = useMemo(() => {
    const datesWithLogs = new Set(monthLogs.map((l) => l.log_date));
    let streak = 0;
    let d = new Date();
    // Count backward consecutively
    for (let i = 0; i < 30; i++) {
      const dateStr = format(d, "yyyy-MM-dd");
      const dayOfWeek = d.getDay();
      // Skip weekends from breaking streak
      if (dayOfWeek === 0 || (dayOfWeek === 6 && workingDays === 5)) {
        d = subDays(d, 1);
        continue;
      }
      if (datesWithLogs.has(dateStr)) {
        streak++;
      } else if (dateStr < today) {
        break;
      }
      d = subDays(d, 1);
    }
    return streak;
  }, [monthLogs, workingDays, today]);

  // Hours by Category
  const hoursByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthLogs.forEach((l) => {
      const cat = l.category || "General";
      map[cat] = (map[cat] || 0) + Number(l.hours);
    });
    return Object.entries(map).map(([category, hours]) => ({
      category: category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      hours: Math.round(hours * 10) / 10,
    }));
  }, [monthLogs]);

  // Hours by Project
  const hoursByProject = useMemo(() => {
    const map: Record<string, number> = {};
    monthLogs.forEach((l: any) => {
      const projName = l.projects?.name || "General / Unlinked";
      map[projName] = (map[projName] || 0) + Number(l.hours);
    });
    return Object.entries(map).map(([project, hours]) => ({
      project,
      hours: Math.round(hours * 10) / 10,
    }));
  }, [monthLogs]);

  return {
    today,
    shiftStart,
    shiftEnd,
    shiftHours,
    todayAttendance,
    loadingAttendance,
    todayStandup,
    todayLogs,
    todaySubmittedHours,
    todayDraftCount,
    monthWorkingDays,
    monthLoggedHours,
    netMonthCapacity,
    monthUtilizationPct,
    utilizationBand: classifyUtilization(monthUtilizationPct),
    utilizationColors: getUtilizationRAGColor(classifyUtilization(monthUtilizationPct)),
    attendanceRate,
    punctualityRate,
    logStreak,
    tasksDueCounts,
    onTimeDeliveryRate,
    estimateAccuracy,
    leaveBalances,
    annualLeaveEntitlement,
    myTasks,
    myProjects,
    hasTeammates,
    hoursByCategory,
    hoursByProject,
    unacknowledgedAutoClockout,
    standupMutation,
    acknowledgeAutoClockoutMutation,
  };
}

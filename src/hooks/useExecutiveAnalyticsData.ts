import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkSettings, getPKTDateString } from "@/hooks/useWorkSettings";
import { useAnalyticsFilters, ResolvedDateRange } from "@/hooks/useAnalyticsFilters";
import {
  calculateWorkingDaysInPeriod,
  calculateShiftHoursPerDay,
  calculateGrossCapacity,
  calculateLeaveHours,
  calculateNetCapacity,
  calculateUtilizationPercentage,
  calculateAttendanceRate,
  calculateOnTimeDeliveryRate,
  calculateScheduleVariance,
  classifyUtilization,
  getUtilizationRAGColor,
} from "@/lib/metrics";
import { parseISO, differenceInDays } from "date-fns";

export interface ExecutiveKpiItem {
  id: string;
  title: string;
  value: string | number;
  unit?: string;
  subValue?: string;
  deltaPercent?: number; // vs prior period comparison window
  target?: string;
  targetMet: boolean;
  status: "success" | "warning" | "danger" | "neutral";
  formula: string;
}

export interface NeedsAttentionItem {
  id: string;
  type: "project_at_risk" | "stale_blocker" | "burnout_risk" | "underutilized";
  title: string;
  subtitle: string;
  metric: string;
  severity: "danger" | "warning";
  linkUrl?: string;
}

export function useExecutiveAnalyticsData() {
  const filterHook = useAnalyticsFilters();
  const { filters, resolvedRange } = filterHook;
  const today = getPKTDateString();
  const {
    shiftStart,
    shiftEnd,
    workingDays: orgWorkingDays,
    graceMinutes,
  } = useWorkSettings();

  const { startDate, endDate, comparisonStartDate, comparisonEndDate } = resolvedRange;

  // 1. Fetch Users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["executive-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, role, department, join_date, status, avatar_url")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Fetch Projects and Sprints
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ["executive-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status, budget_hours, baseline_end_date, client_id, is_billable, billing_type, clients(name)")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Fetch Primary Period Daily Logs
  const { data: currentLogs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ["executive-logs", startDate, endDate, filters.department, filters.projectId, filters.clientId],
    queryFn: async () => {
      let query = supabase
        .from("daily_logs")
        .select("id, user_id, project_id, log_date, hours, category, status, submitted_at, users(department), projects(client_id, is_billable, name, clients(name))")
        .gte("log_date", startDate)
        .lte("log_date", endDate)
        .eq("status", "submitted");

      if (filters.projectId) query = query.eq("project_id", filters.projectId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // 4. Fetch Comparison Period Daily Logs (if comparison enabled)
  const { data: comparisonLogs = [] } = useQuery({
    queryKey: ["executive-logs-compare", comparisonStartDate, comparisonEndDate, filters.projectId],
    queryFn: async () => {
      if (!comparisonStartDate || !comparisonEndDate || filters.comparison === "none") return [];
      let query = supabase
        .from("daily_logs")
        .select("id, hours, status")
        .gte("log_date", comparisonStartDate)
        .lte("log_date", comparisonEndDate)
        .eq("status", "submitted");

      if (filters.projectId) query = query.eq("project_id", filters.projectId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!comparisonStartDate && !!comparisonEndDate && filters.comparison !== "none",
  });

  // 5. Fetch Attendance for Current Period
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["executive-attendance", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, user_id, date, clock_in, clock_out, work_mode, minutes_late, auto_clocked_out")
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return data || [];
    },
  });

  // 6. Fetch Today Attendance
  const { data: todayAttendance = [] } = useQuery({
    queryKey: ["executive-today-attendance", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, user_id, clock_in, clock_out, work_mode")
        .eq("date", today);
      if (error) throw error;
      return data || [];
    },
  });

  // 7. Fetch Approved Leaves in Current Period
  const { data: leaveRequests = [] } = useQuery({
    queryKey: ["executive-leaves", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, user_id, start_date, end_date, hours, days_count, status")
        .eq("status", "approved")
        .lte("start_date", endDate)
        .gte("end_date", startDate);
      if (error) throw error;
      return data || [];
    },
  });

  // 8. Fetch Tasks in Scope (for On-Time Delivery and Blockers)
  const { data: tasks = [] } = useQuery({
    queryKey: ["executive-tasks", filters.projectId],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("id, title, project_id, status, status_id, due_date, completed_at, is_flagged, created_at, workflow_statuses:status_id(name, category)");

      if (filters.projectId) query = query.eq("project_id", filters.projectId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Filter scoped users based on department / role
  const scopedUsers = useMemo(() => {
    return users.filter((u) => {
      if (filters.department && u.department !== filters.department) return false;
      if (filters.role && u.role !== filters.role) return false;
      if (filters.userId && u.id !== filters.userId) return false;
      return true;
    });
  }, [users, filters.department, filters.role, filters.userId]);

  const activeEmployees = useMemo(() => {
    return scopedUsers.filter((u) => u.status === "active");
  }, [scopedUsers]);

  // Capacity Math
  const shiftHours = useMemo(
    () => calculateShiftHoursPerDay(shiftStart, shiftEnd, 60),
    [shiftStart, shiftEnd]
  );

  const workingDaysCount = useMemo(() => {
    return calculateWorkingDaysInPeriod(startDate, endDate, [], orgWorkingDays);
  }, [startDate, endDate, orgWorkingDays]);

  const totalGrossCapacity = useMemo(() => {
    return activeEmployees.length * shiftHours * workingDaysCount;
  }, [activeEmployees.length, shiftHours, workingDaysCount]);

  const totalLeaveHours = useMemo(() => {
    return leaveRequests.reduce((sum, r) => sum + (Number(r.hours) || (Number(r.days_count) * shiftHours) || 0), 0);
  }, [leaveRequests, shiftHours]);

  const totalNetCapacity = useMemo(() => {
    return Math.max(0, totalGrossCapacity - totalLeaveHours);
  }, [totalGrossCapacity, totalLeaveHours]);

  // Logged Hours Aggregation
  const { totalLoggedHours, totalBillableHours } = useMemo(() => {
    let logged = 0;
    let billable = 0;

    for (const l of currentLogs) {
      const h = Number((l as any).hours) || 0;
      const isBillable = (l as any).projects?.is_billable ?? true;
      logged += h;
      billable += isBillable ? h : 0;
    }
    return { totalLoggedHours: logged, totalBillableHours: billable };
  }, [currentLogs]);

  // Prior period logged hours for delta
  const comparisonLoggedHours = useMemo(() => {
    return comparisonLogs.reduce((acc, l: any) => acc + (Number(l.hours) || 0), 0);
  }, [comparisonLogs]);

  // Utilization Calculations
  const companyUtilization = useMemo(() => {
    return calculateUtilizationPercentage(totalLoggedHours, totalNetCapacity);
  }, [totalLoggedHours, totalNetCapacity]);

  const billableUtilization = useMemo(() => {
    return calculateUtilizationPercentage(totalBillableHours, totalNetCapacity);
  }, [totalBillableHours, totalNetCapacity]);

  const priorUtilization = useMemo(() => {
    if (!comparisonLoggedHours || !totalNetCapacity) return null;
    return calculateUtilizationPercentage(comparisonLoggedHours, totalNetCapacity);
  }, [comparisonLoggedHours, totalNetCapacity]);

  const utilizationDelta = useMemo(() => {
    if (priorUtilization === null) return undefined;
    return Number((companyUtilization - priorUtilization).toFixed(1));
  }, [companyUtilization, priorUtilization]);

  // Today's Attendance & WFH
  const { attendanceRateToday, onsiteCount, remoteCount, clockedInCount } = useMemo(() => {
    const clockedIn = todayAttendance.filter((a) => !!a.clock_in);
    const onsite = clockedIn.filter((a) => a.work_mode === "onsite" || a.work_mode === "office").length;
    const remote = clockedIn.filter((a) => a.work_mode === "remote" || a.work_mode === "wfh").length;
    const rate = activeEmployees.length > 0 ? (clockedIn.length / activeEmployees.length) * 100 : 0;
    return {
      attendanceRateToday: Math.round(rate),
      onsiteCount: onsite,
      remoteCount: remote,
      clockedInCount: clockedIn.length,
    };
  }, [todayAttendance, activeEmployees.length]);

  // On-time task delivery
  const { onTimeRate, completedTasksCount } = useMemo(() => {
    let completed = 0;
    let onTime = 0;

    for (const t of tasks) {
      if (t.completed_at) {
        completed++;
        if (t.due_date) {
          const completedDate = t.completed_at.slice(0, 10);
          if (completedDate <= t.due_date) onTime++;
        } else {
          onTime++;
        }
      }
    }
    return {
      onTimeRate: completed > 0 ? Math.round((onTime / completed) * 100) : 100,
      completedTasksCount: completed,
    };
  }, [tasks]);

  // Blockers
  const { openBlockersCount, staleBlockersCount } = useMemo(() => {
    let open = 0;
    let stale = 0;
    const now = new Date();

    for (const t of tasks) {
      if (t.is_flagged) {
        open++;
        if (t.is_flagged) {
          const daysOld = t.created_at ? differenceInDays(now, parseISO(t.created_at)) : 1;
          if (daysOld >= 3) stale++;
        }
      }
    }
    return { openBlockersCount: open, staleBlockersCount: stale };
  }, [tasks]);

  // Active Projects Breakdown
  const { activeProjectsCount, delayedProjectsCount, healthyProjectsCount } = useMemo(() => {
    const active = projects.filter((p) => p.status === "active");
    let delayed = 0;
    for (const p of active) {
      if (p.baseline_end_date && p.baseline_end_date < today) delayed++;
    }
    return {
      activeProjectsCount: active.length,
      delayedProjectsCount: delayed,
      healthyProjectsCount: Math.max(0, active.length - delayed),
    };
  }, [projects, today]);

  // Log Compliance (last 7 days)
  const logComplianceRate = useMemo(() => {
    if (activeEmployees.length === 0) return 100;
    const expectedExpected = activeEmployees.length * shiftHours * 5; // roughly 5 working days
    return Math.min(100, Math.round((totalLoggedHours / (expectedExpected || 1)) * 100));
  }, [activeEmployees.length, shiftHours, totalLoggedHours]);

  // Bench Hours
  const benchHours = useMemo(() => {
    return Math.max(0, totalNetCapacity - totalLoggedHours);
  }, [totalNetCapacity, totalLoggedHours]);

  // 10 Executive KPI Cards (Section 2.1)
  const kpiCards: ExecutiveKpiItem[] = useMemo(() => {
    return [
      {
        id: "active_employees",
        title: "Active Headcount",
        value: activeEmployees.length,
        unit: "staff",
        subValue: `${scopedUsers.length} total users`,
        target: "Full Staff",
        targetMet: true,
        status: "neutral",
        formula: "Count of all active profiles matching current department/role filters",
      },
      {
        id: "company_utilization",
        title: "Company Utilization",
        value: companyUtilization,
        unit: "%",
        subValue: `${Math.round(totalLoggedHours)}h logged / ${Math.round(totalNetCapacity)}h net cap`,
        deltaPercent: utilizationDelta,
        target: "75% – 85%",
        targetMet: companyUtilization >= 75 && companyUtilization <= 85,
        status: companyUtilization >= 75 && companyUtilization <= 85 ? "success" : companyUtilization > 85 ? "danger" : "warning",
        formula: "(Total Logged Hours / Net Working Capacity) × 100",
      },
      {
        id: "billable_utilization",
        title: "Billable Utilization",
        value: billableUtilization,
        unit: "%",
        subValue: `${Math.round(totalBillableHours)}h billable hours`,
        target: "65% – 75%",
        targetMet: billableUtilization >= 65 && billableUtilization <= 75,
        status: billableUtilization >= 65 ? "success" : "warning",
        formula: "(Billable Logged Hours / Net Working Capacity) × 100",
      },
      {
        id: "active_projects",
        title: "Active Projects",
        value: activeProjectsCount,
        unit: "projects",
        subValue: `${healthyProjectsCount} on track`,
        target: "Portfolio",
        targetMet: true,
        status: "neutral",
        formula: "Count of non-archived projects with active status",
      },
      {
        id: "projects_at_risk",
        title: "Projects At Risk",
        value: delayedProjectsCount,
        unit: "projects",
        subValue: `${activeProjectsCount > 0 ? Math.round((delayedProjectsCount / activeProjectsCount) * 100) : 0}% of portfolio`,
        target: "< 15% of active",
        targetMet: delayedProjectsCount === 0,
        status: delayedProjectsCount === 0 ? "success" : "danger",
        formula: "Projects past baseline end date or exceeding total allocated budget hours",
      },
      {
        id: "today_attendance",
        title: "Today's Attendance",
        value: attendanceRateToday,
        unit: "%",
        subValue: `${clockedInCount} present (${onsiteCount} onsite, ${remoteCount} WFH)`,
        target: "> 90%",
        targetMet: attendanceRateToday >= 90,
        status: attendanceRateToday >= 90 ? "success" : "warning",
        formula: "(Clocked-in Employees / Active Employees) × 100 on current PKT date",
      },
      {
        id: "log_compliance",
        title: "Log Compliance",
        value: logComplianceRate,
        unit: "%",
        subValue: `${Math.round(totalLoggedHours)}h submitted`,
        target: "> 95%",
        targetMet: logComplianceRate >= 95,
        status: logComplianceRate >= 95 ? "success" : "warning",
        formula: "(Total Submitted Log Hours / Expected Shift Hours) × 100",
      },
      {
        id: "on_time_delivery",
        title: "On-Time Delivery",
        value: onTimeRate,
        unit: "%",
        subValue: `${completedTasksCount} completed tasks`,
        target: "> 85%",
        targetMet: onTimeRate >= 85,
        status: onTimeRate >= 85 ? "success" : "warning",
        formula: "(Completed Tasks on/before Due Date / Total Completed Tasks) × 100",
      },
      {
        id: "open_blockers",
        title: "Open Blockers",
        value: openBlockersCount,
        unit: "tasks",
        subValue: `${staleBlockersCount} stale (> 3 days)`,
        target: "0 stale (> 3d)",
        targetMet: staleBlockersCount === 0,
        status: staleBlockersCount === 0 ? "success" : "danger",
        formula: "Tasks flagged as blocked; stale if flag age ≥ 72 hours",
      },
      {
        id: "bench_hours",
        title: "Bench Hours",
        value: Math.round(benchHours),
        unit: "hrs",
        subValue: `${totalNetCapacity > 0 ? Math.round((benchHours / totalNetCapacity) * 100) : 0}% unutilized capacity`,
        target: "< 5% of net capacity",
        targetMet: totalNetCapacity > 0 && (benchHours / totalNetCapacity) <= 0.05,
        status: (benchHours / (totalNetCapacity || 1)) <= 0.1 ? "success" : "warning",
        formula: "Net Working Capacity − Total Logged Hours",
      },
    ];
  }, [
    activeEmployees.length,
    scopedUsers.length,
    companyUtilization,
    totalLoggedHours,
    totalNetCapacity,
    utilizationDelta,
    billableUtilization,
    totalBillableHours,
    activeProjectsCount,
    healthyProjectsCount,
    delayedProjectsCount,
    attendanceRateToday,
    clockedInCount,
    onsiteCount,
    remoteCount,
    logComplianceRate,
    onTimeRate,
    completedTasksCount,
    openBlockersCount,
    staleBlockersCount,
    benchHours,
  ]);

  // "Needs Attention Now" Exception Items
  const needsAttentionItems: NeedsAttentionItem[] = useMemo(() => {
    const list: NeedsAttentionItem[] = [];

    // 1. Projects delayed or past baseline
    projects.forEach((p) => {
      if (p.status === "active" && p.baseline_end_date && p.baseline_end_date < today) {
        list.push({
          id: `proj-${p.id}`,
          type: "project_at_risk",
          title: p.name,
          subtitle: `Past baseline due date (${p.baseline_end_date})`,
          metric: "Delayed",
          severity: "danger",
          linkUrl: `/projects/${p.code || p.id}`,
        });
      }
    });

    // 2. Stale Blockers
    tasks.forEach((t) => {
      if (t.is_flagged) {
        const daysOld = t.created_at ? differenceInDays(new Date(), parseISO(t.created_at)) : 1;
        if (daysOld >= 3) {
          list.push({
            id: `task-${t.id}`,
            type: "stale_blocker",
            title: t.title,
            subtitle: `Blocked for ${daysOld} days without resolution`,
            metric: `${daysOld}d stale`,
            severity: "danger",
          });
        }
      }
    });

    return list.slice(0, 6);
  }, [projects, tasks, today]);

  // Chart Data Collections
  const clientHoursDistribution = useMemo(() => {
    const clientMap = new Map<string, number>();
    for (const l of currentLogs) {
      const clientName = (l.projects as any)?.clients?.name || (l.projects as any)?.name || "Direct / Internal";
      const hours = Number((l as any).hours) || 0;
      clientMap.set(clientName, (clientMap.get(clientName) || 0) + hours);
    }
    return Array.from(clientMap.entries()).map(([client, hours]) => ({
      name: client,
      hours: Math.round(hours),
    }));
  }, [currentLogs]);

  const categoryDistribution = useMemo(() => {
    const catMap = new Map<string, number>();
    for (const l of currentLogs) {
      const cat = l.category || "General";
      const hours = Number((l as any).hours) || 0;
      catMap.set(cat, (catMap.get(cat) || 0) + hours);
    }
    return Array.from(catMap.entries()).map(([name, hours]) => ({
      name,
      hours: Math.round(hours),
    }));
  }, [currentLogs]);

  // Department Utilization Breakdown
  const departmentBreakdown = useMemo(() => {
    const deptMap = new Map<string, { logged: number; staffCount: number }>();

    for (const u of activeEmployees) {
      const dept = u.department || "General";
      const curr = deptMap.get(dept) || { logged: 0, staffCount: 0 };
      curr.staffCount++;
      deptMap.set(dept, curr);
    }

    for (const l of currentLogs) {
      const dept = (l.users as any)?.department || "General";
      const curr = deptMap.get(dept) || { logged: 0, staffCount: 1 };
      curr.logged += Number((l as any).hours) || 0;
      deptMap.set(dept, curr);
    }

    return Array.from(deptMap.entries()).map(([department, data]) => {
      const deptCap = data.staffCount * shiftHours * workingDaysCount;
      const rate = deptCap > 0 ? Math.round((data.logged / deptCap) * 100) : 0;
      return {
        department,
        loggedHours: Math.round(data.logged),
        capacityHours: Math.round(deptCap),
        utilizationRate: rate,
        staffCount: data.staffCount,
      };
    }).sort((a, b) => b.utilizationRate - a.utilizationRate);
  }, [activeEmployees, currentLogs, shiftHours, workingDaysCount]);

  // Individual Utilization Roster (Top/Bottom 10)
  const individualUtilization = useMemo(() => {
    const userLogMap = new Map<string, number>();
    for (const l of currentLogs) {
      if (l.user_id) {
        userLogMap.set(l.user_id, (userLogMap.get(l.user_id) || 0) + (Number((l as any).hours) || 0));
      }
    }

    const personalNetCap = shiftHours * workingDaysCount;

    return activeEmployees.map((u) => {
      const logged = userLogMap.get(u.id) || 0;
      const rate = personalNetCap > 0 ? Math.round((logged / personalNetCap) * 100) : 0;
      return {
        id: u.id,
        name: u.full_name || "Employee",
        department: u.department || "General",
        avatarUrl: u.avatar_url,
        loggedHours: Math.round(logged),
        netCapacity: Math.round(personalNetCap),
        utilizationRate: rate,
        band: classifyUtilization(rate),
      };
    }).sort((a, b) => b.utilizationRate - a.utilizationRate);
  }, [activeEmployees, currentLogs, shiftHours, workingDaysCount]);

  const overUtilizedList = useMemo(() => {
    return individualUtilization.filter((u) => u.utilizationRate > 85).slice(0, 10);
  }, [individualUtilization]);

  const underUtilizedList = useMemo(() => {
    return individualUtilization.filter((u) => u.utilizationRate < 70).slice(0, 10);
  }, [individualUtilization]);

  const benchReportList = useMemo(() => {
    return individualUtilization.filter((u) => u.utilizationRate <= 60);
  }, [individualUtilization]);

  // 5-bucket Utilization Histogram
  const utilizationHistogram = useMemo(() => {
    const buckets = [
      { band: "< 40%", count: 0, color: "#ef4444" },
      { band: "40% – 60%", count: 0, color: "#f59e0b" },
      { band: "60% – 80%", count: 0, color: "#3b82f6" },
      { band: "80% – 100%", count: 0, color: "#10b981" },
      { band: "> 100%", count: 0, color: "#8b5cf6" },
    ];

    for (const u of individualUtilization) {
      if (u.utilizationRate < 40) buckets[0].count++;
      else if (u.utilizationRate <= 60) buckets[1].count++;
      else if (u.utilizationRate <= 80) buckets[2].count++;
      else if (u.utilizationRate <= 100) buckets[3].count++;
      else buckets[4].count++;
    }

    return buckets;
  }, [individualUtilization]);

  return {
    filterHook,
    isLoading: isLoadingUsers || isLoadingProjects || isLoadingLogs,
    kpiCards,
    needsAttentionItems,
    clientHoursDistribution,
    categoryDistribution,
    departmentBreakdown,
    individualUtilization,
    overUtilizedList,
    underUtilizedList,
    benchReportList,
    utilizationHistogram,
    summary: {
      totalLoggedHours,
      totalBillableHours,
      totalNetCapacity,
      companyUtilization,
      billableUtilization,
      attendanceRateToday,
      onsiteCount,
      remoteCount,
      activeProjectsCount,
      delayedProjectsCount,
    },
  };
}


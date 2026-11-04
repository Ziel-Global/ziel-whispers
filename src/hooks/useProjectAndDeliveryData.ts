import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsFilters } from "@/hooks/useAnalyticsFilters";
import { getPKTDateString } from "@/hooks/useWorkSettings";
import {
  calculateProjectBurnPercentage,
  calculateScheduleVariance,
  calculateCycleTimeHours,
  calculateLeadTimeHours,
  calculateEstimateAccuracy,
  calculateOnTimeDeliveryRate,
} from "@/lib/metrics";
import { differenceInDays, parseISO, format, startOfWeek } from "date-fns";

export interface ProjectPortfolioItem {
  id: string;
  name: string;
  code: string;
  clientName: string;
  pmName: string;
  status: string;
  startDate: string;
  endDate: string | null;
  baselineEndDate: string | null;
  budgetHours: number;
  loggedHours: number;
  burnPercentage: number;
  progressPercentage: number;
  scheduleVarianceDays: number;
  scheduleHealth: "healthy" | "at_risk" | "delayed";
  budgetHealth: "under_budget" | "on_budget" | "over_budget";
  openBlockersCount: number;
  overdueTasksCount: number;
  totalTasksCount: number;
  completedTasksCount: number;
  allocatedFTE: number;
  loggedFTE: number;
}

export function useProjectAndDeliveryData() {
  const { filters, resolvedRange } = useAnalyticsFilters();
  const today = getPKTDateString();
  const { startDate, endDate } = resolvedRange;

  // 1. Fetch Projects & Client Info
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ["module5-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          id, name, status, start_date, end_date, baseline_end_date, budget_hours,
          client_id, is_billable, billing_type, created_by,
          clients (id, name),
          creator:created_by (id, full_name)
        `)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Fetch Project Members & Allocations
  const { data: projectMembers = [] } = useQuery({
    queryKey: ["module5-project-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("id, project_id, user_id, allocation_percentage, users (full_name)");
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Fetch Tasks
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ["module5-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id, project_id, title, status, status_id, priority, due_date,
          created_at, started_at, completed_at, estimated_hours,
          is_flagged, sprint_id, assigned_to,
          sprints (id, name, sprint_number, status, start_date, end_date)
        `);
      if (error) throw error;
      return data || [];
    },
  });

  // 4. Fetch Daily Logs for Logged Hours
  const { data: dailyLogs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ["module5-logs", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("id, project_id, hours, log_date, category, status")
        .eq("status", "submitted");
      if (error) throw error;
      return data || [];
    },
  });

  // 5. Fetch Workflow Statuses for Status History & CFD
  const { data: workflowStatuses = [] } = useQuery({
    queryKey: ["module5-statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_statuses")
        .select("id, name, category, color, sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  // 6. Fetch Task Status History (for bug rework & cycle calculations)
  const { data: statusHistory = [] } = useQuery({
    queryKey: ["module5-status-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_status_history")
        .select("id, task_id, from_status_id, to_status_id, changed_at, changed_by")
        .order("changed_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

  // 7. Fetch Project Status Updates (Live Feed)
  const { data: projectStatusUpdates = [] } = useQuery({
    queryKey: ["module5-status-updates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_status_updates")
        .select("id, project_id, summary, created_at, author_id, users:author_id (full_name), projects (name)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // 8. Fetch Goals (OKRs)
  const { data: goals = [] } = useQuery({
    queryKey: ["module5-goals"],
    queryFn: async () => {
      return [];
    },
  });

  // 9. Fetch Task Dependencies
  const { data: taskDependencies = [] } = useQuery({
    queryKey: ["module5-task-dependencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_dependencies")
        .select("id, task_id, depends_on_task_id, dependency_type");
      if (error) throw error;
      return data || [];
    },
  });

  // Build Project Portfolio Master Table & Aggregate Items
  const portfolioItems = useMemo<ProjectPortfolioItem[]>(() => {
    // Map project total logged hours
    const projectHoursMap = new Map<string, number>();
    for (const log of dailyLogs) {
      if (log.project_id) {
        projectHoursMap.set(
          log.project_id,
          (projectHoursMap.get(log.project_id) || 0) + (Number(log.hours) || 0)
        );
      }
    }

    // Map project tasks
    const projectTasksMap = new Map<string, typeof tasks>();
    for (const task of tasks) {
      const list = projectTasksMap.get(task.project_id) || [];
      list.push(task);
      projectTasksMap.set(task.project_id, list);
    }

    // Map allocations
    const projectAllocationsMap = new Map<string, number>();
    for (const m of projectMembers) {
      projectAllocationsMap.set(
        m.project_id,
        (projectAllocationsMap.get(m.project_id) || 0) + (Number(m.allocation_percentage) || 100)
      );
    }

    return projects.map((p) => {
      const loggedHours = Math.round((projectHoursMap.get(p.id) || 0) * 10) / 10;
      const budgetHours = Number(p.budget_hours) || 0;
      const burnPct = calculateProjectBurnPercentage(loggedHours, budgetHours);

      const pTasks = projectTasksMap.get(p.id) || [];
      const totalTasks = pTasks.length;
      const completedTasks = pTasks.filter((t) => !!t.completed_at).length;
      const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Overdue tasks
      const overdueTasks = pTasks.filter(
        (t) => !t.completed_at && t.due_date && t.due_date < today
      ).length;

      // Blockers
      const blockers = pTasks.filter((t) => t.is_flagged).length;

      // Schedule Variance (days)
      const scheduleVariance = calculateScheduleVariance(
        p.baseline_end_date,
        p.end_date,
        p.status === "completed" ? today : null
      );

      // Schedule Health
      let scheduleHealth: "healthy" | "at_risk" | "delayed" = "healthy";
      if (scheduleVariance < -5) {
        scheduleHealth = "delayed";
      } else if (scheduleVariance < 0 || overdueTasks > 2) {
        scheduleHealth = "at_risk";
      }

      // Budget Health
      let budgetHealth: "under_budget" | "on_budget" | "over_budget" = "on_budget";
      if (budgetHours > 0) {
        if (burnPct > 100) budgetHealth = "over_budget";
        else if (burnPct > 85 && progressPct < 70) budgetHealth = "over_budget";
        else if (burnPct < 80) budgetHealth = "under_budget";
      }

      const allocatedTotalPct = projectAllocationsMap.get(p.id) || 0;
      const allocatedFTE = Math.round((allocatedTotalPct / 100) * 10) / 10;
      const loggedFTE = Math.round((loggedHours / 160) * 10) / 10; // rough monthly FTE

      return {
        id: p.id,
        name: p.name,
        code: p.code || p.name.substring(0, 4).toUpperCase(),
        clientName: (p.clients as any)?.name || "Direct / Internal",
        pmName: (p.creator as any)?.full_name || "Unassigned",
        status: p.status,
        startDate: p.start_date,
        endDate: p.end_date,
        baselineEndDate: p.baseline_end_date,
        budgetHours,
        loggedHours,
        burnPercentage: burnPct,
        progressPercentage: progressPct,
        scheduleVarianceDays: scheduleVariance,
        scheduleHealth,
        budgetHealth,
        openBlockersCount: blockers,
        overdueTasksCount: overdueTasks,
        totalTasksCount: totalTasks,
        completedTasksCount: completedTasks,
        allocatedFTE,
        loggedFTE,
      };
    });
  }, [projects, dailyLogs, tasks, projectMembers, today]);

  // Delivery & Quality Metrics
  const deliveryMetrics = useMemo(() => {
    // 1. Throughput by category/week
    const weeklyThroughputMap = new Map<string, { week: string; features: number; bugs: number; chores: number; other: number }>();
    const cycleTimes: number[] = [];
    const leadTimes: number[] = [];
    let completedOnTime = 0;
    let completedTotal = 0;

    for (const t of tasks) {
      if (t.completed_at) {
        completedTotal++;
        const weekKey = format(startOfWeek(parseISO(t.completed_at)), "MMM d");
        const entry = weeklyThroughputMap.get(weekKey) || { week: weekKey, features: 0, bugs: 0, chores: 0, other: 0 };

        const titleLower = t.title.toLowerCase();
        if (titleLower.includes("bug") || titleLower.includes("fix")) entry.bugs++;
        else if (titleLower.includes("chore") || titleLower.includes("refactor")) entry.chores++;
        else if (titleLower.includes("feat") || titleLower.includes("add") || titleLower.includes("implement")) entry.features++;
        else entry.other++;

        weeklyThroughputMap.set(weekKey, entry);

        // Cycle time & Lead time
        const cycle = calculateCycleTimeHours(t.started_at, t.completed_at);
        if (cycle !== null && cycle >= 0) cycleTimes.push(cycle);

        const lead = calculateLeadTimeHours(t.created_at, t.completed_at);
        if (lead !== null && lead >= 0) leadTimes.push(lead);

        if (t.due_date) {
          const compDate = t.completed_at.slice(0, 10);
          if (compDate <= t.due_date) completedOnTime++;
        } else {
          completedOnTime++;
        }
      }
    }

    // Median cycle time
    cycleTimes.sort((a, b) => a - b);
    leadTimes.sort((a, b) => a - b);
    const medianCycleHours = cycleTimes.length > 0 ? cycleTimes[Math.floor(cycleTimes.length / 2)] : 0;
    const medianLeadHours = leadTimes.length > 0 ? leadTimes[Math.floor(leadTimes.length / 2)] : 0;

    const onTimeDeliveryRate = completedTotal > 0 ? Math.round((completedOnTime / completedTotal) * 100) : 100;

    // 2. Work in Progress (WIP) by Status Category
    const statusCategoryMap = new Map<string, string>();
    for (const s of workflowStatuses) {
      statusCategoryMap.set(s.id, s.category || s.name);
    }

    const wipByStatus = [
      { status: "Backlog", count: 0, limit: 50 },
      { status: "In Progress", count: 0, limit: 25 },
      { status: "In Review / QA", count: 0, limit: 15 },
      { status: "Completed", count: 0, limit: 100 },
    ];

    for (const t of tasks) {
      const category = (t.status_id ? statusCategoryMap.get(t.status_id) : t.status)?.toLowerCase() || "";
      if (t.completed_at || category.includes("done") || category.includes("complete")) {
        wipByStatus[3].count++;
      } else if (category.includes("review") || category.includes("qa") || category.includes("test")) {
        wipByStatus[2].count++;
      } else if (category.includes("progress") || category.includes("doing") || category.includes("active")) {
        wipByStatus[1].count++;
      } else {
        wipByStatus[0].count++;
      }
    }

    // 3. Rework / Reopen Rate (backward transitions in statusHistory)
    let totalTransitions = 0;
    let reworkTransitions = 0;
    for (const h of statusHistory) {
      totalTransitions++;
      // If moving back to in_progress from QA/done
      const fromCat = (statusCategoryMap.get(h.from_status_id || "") || "").toLowerCase();
      const toCat = (statusCategoryMap.get(h.to_status_id || "") || "").toLowerCase();
      if ((fromCat.includes("review") || fromCat.includes("qa") || fromCat.includes("done")) &&
          (toCat.includes("progress") || toCat.includes("todo") || toCat.includes("backlog"))) {
        reworkTransitions++;
      }
    }
    const reworkRate = totalTransitions > 0 ? Math.round((reworkTransitions / totalTransitions) * 100) : 0;

    // 4. Goals / OKRs Progress
    const totalGoals = goals.length;
    const completedGoals = goals.filter((g) => g.status === "completed" || g.status === "achieved").length;
    const goalsProgressPct = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 100;

    return {
      weeklyThroughput: Array.from(weeklyThroughputMap.values()).slice(-8),
      medianCycleHours,
      medianLeadHours,
      onTimeDeliveryRate,
      wipByStatus,
      reworkRate,
      goalsProgressPct,
      totalGoals,
      completedGoals,
    };
  }, [tasks, workflowStatuses, statusHistory, goals]);

  return {
    isLoading: isLoadingProjects || isLoadingTasks || isLoadingLogs,
    portfolioItems,
    deliveryMetrics,
    projectStatusUpdates,
    goals,
    taskDependencies,
  };
}


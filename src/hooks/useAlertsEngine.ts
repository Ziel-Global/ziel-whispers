import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPKTDateString, useWorkSettings } from "@/hooks/useWorkSettings";
import {
  ALERT_RULES_REGISTRY,
  SystemAlertItem,
  evaluateOverutilizationRule,
  evaluateUnderutilizationRule,
  evaluateMissingLogsRule,
  evaluateRepeatedLatenessRule,
  evaluateBudgetBurnRule,
  evaluateScheduleSlipRule,
  evaluateBlockerAgingRule,
  evaluateApprovalAgingRule,
  evaluateCapacityCrunchRule,
} from "@/lib/alerts/alertEngine";
import { createNotification } from "@/lib/notification-helpers";
import { format, subDays, addDays } from "date-fns";
import { toast } from "sonner";

const SNOOZE_STORAGE_KEY = "ziel_alerts_snoozed_map_v1";
const DISMISSED_STORAGE_KEY = "ziel_alerts_dismissed_ids_v1";

export function useAlertsEngine() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { shiftHours } = useWorkSettings();

  const todayStr = getPKTDateString();
  const fourteenDaysAgoStr = format(subDays(new Date(), 14), "yyyy-MM-dd");
  const thirtyDaysAgoStr = format(subDays(new Date(), 30), "yyyy-MM-dd");

  // Filter states
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Snoozed & Dismissed state stored in localStorage
  const [snoozeMap, setSnoozeMap] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(SNOOZE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [dismissedSet, setDismissedSet] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Persist snooze changes
  const saveSnooze = useCallback((map: Record<string, string>) => {
    setSnoozeMap(map);
    try {
      localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Persist dismissal changes
  const saveDismissed = useCallback((set: Set<string>) => {
    setDismissedSet(set);
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 1. Fetch Users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["alerts-engine-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, role, department, designation, status")
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Fetch Projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ["alerts-engine-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status, budget_hours, baseline_end_date, is_billable");
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Fetch 30-day Daily Logs
  const { data: dailyLogs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ["alerts-engine-logs", thirtyDaysAgoStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("id, user_id, project_id, log_date, hours, status, is_late")
        .gte("log_date", thirtyDaysAgoStr)
        .eq("status", "submitted");
      if (error) throw error;
      return data || [];
    },
  });

  // 4. Fetch 30-day Attendance
  const { data: attendanceRecords = [], isLoading: isLoadingAttendance } = useQuery({
    queryKey: ["alerts-engine-attendance", thirtyDaysAgoStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, user_id, date, minutes_late")
        .gte("date", thirtyDaysAgoStr);
      if (error) throw error;
      return data || [];
    },
  });

  // 5. Fetch Flagged / Blocked Tasks
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ["alerts-engine-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, assigned_to, status, priority, is_flagged, created_at, projects (name)")
        .or("is_flagged.eq.true,status.ilike.%block%,status.ilike.%review%");
      if (error) throw error;
      return data || [];
    },
  });

  // 6. Fetch Pending Leaves
  const { data: pendingLeaves = [], isLoading: isLoadingLeaves } = useQuery({
    queryKey: ["alerts-engine-leaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, user_id, created_at, status, hours, users (full_name)")
        .eq("status", "pending");
      if (error) throw error;
      return data || [];
    },
  });

  // 7. Fetch Project Allocations
  const { data: projectMembers = [] } = useQuery({
    queryKey: ["alerts-engine-memberships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("id, user_id, project_id, allocation_percentage");
      if (error) throw error;
      return data || [];
    },
  });

  // Run Alert Rule Evaluations
  const allGeneratedAlerts = useMemo(() => {
    const list: SystemAlertItem[] = [];
    const now = new Date();

    // Map: User 14-day utilization
    const util14Map = new Map<string, number>();
    const leave14Map = new Map<string, number>();
    const expected14h = 10 * shiftHours; // ~10 working days in 14 calendar days

    users.forEach((u) => {
      const userLogs = dailyLogs.filter((l) => l.user_id === u.id && l.log_date >= fourteenDaysAgoStr);
      const totalLogged = userLogs.reduce((acc, l) => acc + (Number(l.hours) || 0), 0);
      const util = expected14h > 0 ? Math.round((totalLogged / expected14h) * 100) : 0;
      util14Map.set(u.id, util);
      leave14Map.set(u.id, 0);
    });

    // Rule 1: Overutilization
    list.push(...evaluateOverutilizationRule(users, util14Map));

    // Rule 2: Underutilization
    list.push(...evaluateUnderutilizationRule(users, util14Map, leave14Map));

    // Rule 3: Missing Logs (Yesterday)
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const yesterdaySubmitters = new Set<string>();
    dailyLogs.forEach((l) => {
      if (l.log_date === yesterday && l.status === "submitted") {
        yesterdaySubmitters.add(l.user_id);
      }
    });
    list.push(...evaluateMissingLogsRule(users, yesterdaySubmitters, yesterday));

    // Rule 4: Repeated Lateness (>= 3 in 30 days)
    const lateCountMap = new Map<string, number>();
    attendanceRecords.forEach((a) => {
      if ((a.minutes_late || 0) > 0) {
        lateCountMap.set(a.user_id, (lateCountMap.get(a.user_id) || 0) + 1);
      }
    });
    list.push(...evaluateRepeatedLatenessRule(users, lateCountMap));

    // Rule 5: Project Budget Burn (75% and 90%)
    const projectLoggedHoursMap = new Map<string, number>();
    dailyLogs.forEach((l) => {
      if (l.project_id) {
        projectLoggedHoursMap.set(
          l.project_id,
          (projectLoggedHoursMap.get(l.project_id) || 0) + (Number(l.hours) || 0)
        );
      }
    });
    list.push(...evaluateBudgetBurnRule(projects, projectLoggedHoursMap));

    // Rule 6: Project Schedule Slippage
    list.push(...evaluateScheduleSlipRule(projects, todayStr));

    // Rule 7: Blocker Aging (>3 days)
    list.push(...evaluateBlockerAgingRule(tasks, now));

    // Rule 9: Approval Aging (>48h)
    list.push(...evaluateApprovalAgingRule(pendingLeaves, now));

    // Rule 11: Department Capacity Crunch
    const deptMemberCountMap = new Map<string, number>();
    const deptAllocMap = new Map<string, number>();

    users.forEach((u) => {
      const dept = u.department || "General";
      deptMemberCountMap.set(dept, (deptMemberCountMap.get(dept) || 0) + 1);
    });

    projectMembers.forEach((pm) => {
      const u = users.find((user) => user.id === pm.user_id);
      if (u) {
        const dept = u.department || "General";
        deptAllocMap.set(dept, (deptAllocMap.get(dept) || 0) + (Number(pm.allocation_percentage) || 0));
      }
    });

    const deptCrunchInput = Array.from(deptMemberCountMap.entries()).map(([name, count]) => ({
      name,
      memberCount: count,
      totalAllocationPct: deptAllocMap.get(name) || 0,
    }));
    list.push(...evaluateCapacityCrunchRule(deptCrunchInput));

    // Attach snooze status
    const nowIso = now.toISOString();
    return list.map((item) => {
      const snoozedUntil = snoozeMap[item.id];
      const isSnoozed = snoozedUntil ? snoozedUntil > nowIso : false;
      return {
        ...item,
        isSnoozed,
        snoozedUntil: isSnoozed ? snoozedUntil : null,
      };
    });
  }, [
    users,
    projects,
    dailyLogs,
    attendanceRecords,
    tasks,
    pendingLeaves,
    projectMembers,
    fourteenDaysAgoStr,
    shiftHours,
    todayStr,
    snoozeMap,
  ]);

  // Filter by user role, severity, category, and search
  const visibleAlerts = useMemo(() => {
    const userRole = profile?.role || "admin";

    return allGeneratedAlerts.filter((alert) => {
      // 1. Exclude dismissed
      if (dismissedSet.has(alert.id)) return false;

      // 2. Role visibility (admins see everything; managers see manager+project alerts)
      if (userRole !== "admin") {
        if (!alert.recipientRoles.includes(userRole)) return false;
      }

      // 3. Severity filter
      if (severityFilter !== "all" && alert.severity !== severityFilter) return false;

      // 4. Category filter
      if (categoryFilter !== "all" && alert.category !== categoryFilter) return false;

      // 5. Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesTitle = alert.title.toLowerCase().includes(term);
        const matchesDesc = alert.description.toLowerCase().includes(term);
        const matchesEntity = alert.entityName.toLowerCase().includes(term);
        if (!matchesTitle && !matchesDesc && !matchesEntity) return false;
      }

      return true;
    });
  }, [allGeneratedAlerts, dismissedSet, profile?.role, severityFilter, categoryFilter, searchTerm]);

  // Summary counts
  const summary = useMemo(() => {
    const active = visibleAlerts.filter((a) => !a.isSnoozed);
    const critical = active.filter((a) => a.severity === "critical").length;
    const warning = active.filter((a) => a.severity === "warning").length;
    const info = active.filter((a) => a.severity === "info").length;
    const snoozed = visibleAlerts.filter((a) => a.isSnoozed).length;

    return {
      totalActive: active.length,
      critical,
      warning,
      info,
      snoozed,
    };
  }, [visibleAlerts]);

  // Actions
  const snoozeAlert = (alertId: string, durationDays: number) => {
    const until = addDays(new Date(), durationDays).toISOString();
    const updated = { ...snoozeMap, [alertId]: until };
    saveSnooze(updated);
    toast.success(`Alert snoozed for ${durationDays} ${durationDays === 1 ? "day" : "days"}`);
  };

  const unsnoozeAlert = (alertId: string) => {
    const updated = { ...snoozeMap };
    delete updated[alertId];
    saveSnooze(updated);
    toast.success("Alert restored to active feed");
  };

  const dismissAlert = (alertId: string) => {
    const updated = new Set(dismissedSet);
    updated.add(alertId);
    saveDismissed(updated);
    toast.info("Alert dismissed");
  };

  const clearAllDismissed = () => {
    saveDismissed(new Set());
    toast.success("Dismissed alerts cleared");
  };

  // Dispatch In-App Notification trigger
  const dispatchAlertToInApp = async (alert: SystemAlertItem) => {
    try {
      if (profile?.id) {
        await createNotification({
          userId: profile.id,
          type: "project_update",
          title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
          message: alert.description,
        });
        toast.success(`In-app notification created for ${alert.title}`);
      }
    } catch (err: any) {
      toast.error(`Dispatch failed: ${err.message}`);
    }
  };

  // Simulate Slack Webhook dispatch
  const dispatchToSlack = (alert: SystemAlertItem) => {
    toast.success(`[Slack Webhook Dispatched] Alert sent to #ops-alerts channel!`, {
      description: `${alert.title} — ${alert.suggestedAction}`,
    });
  };

  const isLoading =
    isLoadingUsers ||
    isLoadingProjects ||
    isLoadingLogs ||
    isLoadingAttendance ||
    isLoadingTasks ||
    isLoadingLeaves;

  return {
    rulesRegistry: ALERT_RULES_REGISTRY,
    alerts: visibleAlerts,
    summary,
    isLoading,
    severityFilter,
    setSeverityFilter,
    categoryFilter,
    setCategoryFilter,
    searchTerm,
    setSearchTerm,
    snoozeAlert,
    unsnoozeAlert,
    dismissAlert,
    clearAllDismissed,
    dispatchAlertToInApp,
    dispatchToSlack,
  };
}


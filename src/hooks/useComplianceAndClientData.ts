import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnalyticsFilters } from "@/hooks/useAnalyticsFilters";
import { getPKTDateString } from "@/hooks/useWorkSettings";
import { differenceInDays, parseISO, format } from "date-fns";

export interface RepeatLateEmployee {
  userId: string;
  name: string;
  department: string;
  avatarUrl: string | null;
  lateDaysCount: number;
  totalMinutesLate: number;
  lastLateDate: string;
}

export interface ClientPortfolioItem {
  id: string;
  name: string;
  status: string;
  activeProjectsCount: number;
  periodHours: number;
  totalHours: number;
  concentrationPercent: number;
  pendingActionItems: number;
  isHighConcentration: boolean; // > 25% of company hours
}

export function useComplianceAndClientData() {
  const { filters, resolvedRange } = useAnalyticsFilters();
  const today = getPKTDateString();
  const { startDate, endDate } = resolvedRange;

  // 1. Fetch Users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["compliance-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, department, role, status, avatar_url")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Fetch Attendance for Period
  const { data: attendanceRecords = [], isLoading: isLoadingAttendance } = useQuery({
    queryKey: ["compliance-attendance", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, user_id, date, clock_in, clock_out, minutes_late, auto_clocked_out, work_mode, edited_by")
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Fetch Daily Logs for Compliance
  const { data: dailyLogs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ["compliance-logs", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("id, user_id, project_id, log_date, hours, status, is_late, is_missed, submitted_at, projects (client_id)")
        .gte("log_date", startDate)
        .lte("log_date", endDate);
      if (error) throw error;
      return data || [];
    },
  });

  // 4. Fetch Clients & Active Projects
  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ["compliance-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, status, contact_name, contact_email, industry")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["compliance-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, client_id, status");
      if (error) throw error;
      return data || [];
    },
  });

  // 5. Fetch Client Action Items
  const { data: clientActionItems = [] } = useQuery({
    queryKey: ["compliance-client-action-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_action_items")
        .select("id, project_id, title, status, due_date, created_at, projects (client_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // 6. Fetch Standup Submissions
  const { data: standups = [] } = useQuery({
    queryKey: ["compliance-standups", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_standups")
        .select("id, user_id, date, is_done")
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return data || [];
    },
  });

  // 7. Fetch Security / Login Attempts
  const { data: loginAttempts = [] } = useQuery({
    queryKey: ["compliance-logins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("login_attempts")
        .select("id, email, success, attempted_at, ip_address")
        .order("attempted_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // ─── COMPUTATIONS ─────────────────────────────────────────────────────────────

  // Repeat Late Attendance (Repeat Offenders >= 3 late days)
  const repeatLateOffenders = useMemo<RepeatLateEmployee[]>(() => {
    const userLateMap = new Map<string, { count: number; totalMinutes: number; lastDate: string }>();

    for (const rec of attendanceRecords) {
      if ((rec.minutes_late && rec.minutes_late > 0) || (rec.clock_in && !rec.minutes_late)) {
        if (rec.minutes_late && rec.minutes_late > 0) {
          const curr = userLateMap.get(rec.user_id) || { count: 0, totalMinutes: 0, lastDate: rec.date };
          curr.count++;
          curr.totalMinutes += Number(rec.minutes_late);
          if (rec.date > curr.lastDate) curr.lastDate = rec.date;
          userLateMap.set(rec.user_id, curr);
        }
      }
    }

    const userMap = new Map(users.map((u) => [u.id, u]));

    const list: RepeatLateEmployee[] = [];
    userLateMap.forEach((val, userId) => {
      const u = userMap.get(userId);
      if (u) {
        list.push({
          userId,
          name: u.full_name,
          department: u.department || "General",
          avatarUrl: u.avatar_url,
          lateDaysCount: val.count,
          totalMinutesLate: val.totalMinutes,
          lastLateDate: val.lastDate,
        });
      }
    });

    return list.sort((a, b) => b.lateDaysCount - a.lateDaysCount);
  }, [attendanceRecords, users]);

  // Auto Clock-Out Summary
  const autoClockOutCount = useMemo(() => {
    return attendanceRecords.filter((a) => a.auto_clocked_out).length;
  }, [attendanceRecords]);

  // Log Compliance & Late Submissions Share
  const { lateLogsCount, missedLogsCount, onTimeLogsCount } = useMemo(() => {
    let late = 0;
    let missed = 0;
    let onTime = 0;

    for (const l of dailyLogs) {
      if (l.is_missed) missed++;
      else if (l.is_late) late++;
      else onTime++;
    }

    return { lateLogsCount: late, missedLogsCount: missed, onTimeLogsCount: onTime };
  }, [dailyLogs]);

  // WFH Usage vs Office Mix
  const { wfhCount, officeCount } = useMemo(() => {
    let wfh = 0;
    let office = 0;
    for (const a of attendanceRecords) {
      const mode = (a.work_mode || "").toLowerCase();
      if (mode === "remote" || mode === "wfh") wfh++;
      else if (mode === "onsite" || mode === "office") office++;
    }
    return { wfhCount: wfh, officeCount: office };
  }, [attendanceRecords]);

  // Standup Adherence %
  const standupAdherenceRate = useMemo(() => {
    if (standups.length === 0) return 100;
    const done = standups.filter((s) => s.is_done).length;
    return Math.round((done / standups.length) * 100);
  }, [standups]);

  // Security Events (failed logins)
  const failedLogins = useMemo(() => {
    return loginAttempts.filter((l) => !l.success);
  }, [loginAttempts]);

  // Client Portfolio & Concentration Pareto Analysis
  const clientPortfolio = useMemo<ClientPortfolioItem[]>(() => {
    // 1. Total period hours logged across company
    let totalCompanyHours = 0;
    const clientHoursMap = new Map<string, number>();

    for (const log of dailyLogs) {
      const hours = Number(log.hours) || 0;
      totalCompanyHours += hours;
      const clientId = (log.projects as any)?.client_id;
      if (clientId) {
        clientHoursMap.set(clientId, (clientHoursMap.get(clientId) || 0) + hours);
      }
    }

    // 2. Count active projects per client
    const clientProjectsMap = new Map<string, number>();
    for (const p of projects) {
      if (p.client_id && p.status === "active") {
        clientProjectsMap.set(p.client_id, (clientProjectsMap.get(p.client_id) || 0) + 1);
      }
    }

    // 3. Count pending action items per client
    const clientActionsMap = new Map<string, number>();
    for (const a of clientActionItems) {
      const clientId = (a.projects as any)?.client_id;
      if (clientId && a.status === "pending") {
        clientActionsMap.set(clientId, (clientActionsMap.get(clientId) || 0) + 1);
      }
    }

    return clients.map((c) => {
      const periodHours = Math.round((clientHoursMap.get(c.id) || 0) * 10) / 10;
      const concentration = totalCompanyHours > 0 ? Math.round((periodHours / totalCompanyHours) * 100) : 0;
      const activeProjs = clientProjectsMap.get(c.id) || 0;
      const pendingItems = clientActionsMap.get(c.id) || 0;

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        activeProjectsCount: activeProjs,
        periodHours,
        totalHours: periodHours,
        concentrationPercent: concentration,
        pendingActionItems: pendingItems,
        isHighConcentration: concentration > 25,
      };
    }).sort((a, b) => b.periodHours - a.periodHours);
  }, [clients, dailyLogs, projects, clientActionItems]);

  return {
    isLoading: isLoadingUsers || isLoadingAttendance || isLoadingLogs || isLoadingClients,
    repeatLateOffenders,
    autoClockOutCount,
    lateLogsCount,
    missedLogsCount,
    onTimeLogsCount,
    wfhCount,
    officeCount,
    standupAdherenceRate,
    failedLogins,
    clientPortfolio,
    attendanceRecords,
  };
}


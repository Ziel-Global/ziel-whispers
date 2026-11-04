import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPKTDateString, useWorkSettings } from "@/hooks/useWorkSettings";
import { createNotification } from "@/lib/notification-helpers";
import { toast } from "sonner";
import { format, subDays, isWeekend } from "date-fns";

export interface TeamMemberLiveStatus {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  designation: string;
  department: string;
  // Today's attendance
  isClockedIn: boolean;
  clockInTime?: string;
  clockOutTime?: string;
  workMode?: string;
  minutesLate: number;
  // Today's logs
  loggedTodayHours: number;
  // Yesterday's logs
  loggedYesterdayHours: number;
  hasLoggedYesterday: boolean;
  // Active task
  activeTask?: {
    id: string;
    title: string;
    priority: string;
    status: string;
    projectName: string;
  };
}

export interface ReviewOrBlockedTask {
  id: string;
  title: string;
  projectName: string;
  assigneeName: string;
  assigneeAvatar?: string | null;
  status: string;
  priority: string;
  isFlagged: boolean;
  dueDate?: string | null;
  estimatedHours?: number | null;
}

export interface MemberPerformancePack {
  memberId: string;
  fullName: string;
  designation: string;
  avatarUrl?: string | null;
  totalLoggedHours: number;
  expectedCapacity: number;
  utilizationRate: number;
  onTimeAttendanceRate: number;
  daysPresent: number;
  completedTasksCount: number;
  recentDeliverables: { id: string; title: string; projectName: string; completedAt: string }[];
}

export function useTeamLeadData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { shiftHours } = useWorkSettings();

  const todayStr = getPKTDateString();

  // Compute yesterday (skip weekend if Monday -> Friday)
  const yesterdayStr = useMemo(() => {
    const todayDate = new Date();
    let d = subDays(todayDate, 1);
    while (isWeekend(d)) {
      d = subDays(d, 1);
    }
    return format(d, "yyyy-MM-dd");
  }, []);

  // 30 days ago for 1:1 prep pack
  const thirtyDaysAgoStr = useMemo(() => {
    return format(subDays(new Date(), 30), "yyyy-MM-dd");
  }, []);

  const [selectedDept, setSelectedDept] = useState<string>("Engineering");

  // 1. Fetch Users
  const { data: allUsers = [] } = useQuery({
    queryKey: ["team-lead-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, department, designation, role, status, avatar_url")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    allUsers.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    return Array.from(set).sort();
  }, [allUsers]);

  const activeDepartment = selectedDept || (user as any)?.department || availableDepartments[0] || "Engineering";

  const teamMembers = useMemo(() => {
    return allUsers.filter((u) => u.department === activeDepartment);
  }, [allUsers, activeDepartment]);

  const memberIds = useMemo(() => teamMembers.map((m) => m.id), [teamMembers]);

  // 2. Fetch Today's Attendance
  const { data: todayAttendance = [] } = useQuery({
    queryKey: ["team-lead-attendance-today", todayStr, memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("id, user_id, clock_in, clock_out, work_mode, minutes_late")
        .in("user_id", memberIds)
        .eq("date", todayStr);
      if (error) throw error;
      return data || [];
    },
    enabled: memberIds.length > 0,
  });

  // 3. Fetch Yesterday's Daily Logs
  const { data: yesterdayLogs = [] } = useQuery({
    queryKey: ["team-lead-logs-yesterday", yesterdayStr, memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("daily_logs")
        .select("id, user_id, hours, status")
        .in("user_id", memberIds)
        .eq("log_date", yesterdayStr)
        .eq("status", "submitted");
      if (error) throw error;
      return data || [];
    },
    enabled: memberIds.length > 0,
  });

  // 4. Fetch Today's Daily Logs
  const { data: todayLogs = [] } = useQuery({
    queryKey: ["team-lead-logs-today", todayStr, memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("daily_logs")
        .select("id, user_id, hours, status")
        .in("user_id", memberIds)
        .eq("log_date", todayStr)
        .eq("status", "submitted");
      if (error) throw error;
      return data || [];
    },
    enabled: memberIds.length > 0,
  });

  // 5. Fetch Team Active Tasks & Blockers
  const { data: teamTasks = [] } = useQuery({
    queryKey: ["team-lead-tasks", memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, assigned_to, status, status_id, priority, estimated_hours, due_date, is_flagged, projects (name)")
        .in("assigned_to", memberIds);
      if (error) throw error;
      return data || [];
    },
    enabled: memberIds.length > 0,
  });

  // 6. Fetch 30-day Logs for 1:1 performance dossiers
  const { data: pastMonthLogs = [] } = useQuery({
    queryKey: ["team-lead-past-month-logs", thirtyDaysAgoStr, memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("daily_logs")
        .select("id, user_id, hours, log_date")
        .in("user_id", memberIds)
        .gte("log_date", thirtyDaysAgoStr)
        .eq("status", "submitted");
      if (error) throw error;
      return data || [];
    },
    enabled: memberIds.length > 0,
  });

  // 7. Fetch 30-day Attendance for 1:1 performance dossiers
  const { data: pastMonthAttendance = [] } = useQuery({
    queryKey: ["team-lead-past-month-attendance", thirtyDaysAgoStr, memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("attendance")
        .select("id, user_id, date, minutes_late")
        .in("user_id", memberIds)
        .gte("date", thirtyDaysAgoStr);
      if (error) throw error;
      return data || [];
    },
    enabled: memberIds.length > 0,
  });

  // 8. Fetch Completed deliverables for 1:1 packs
  const { data: completedTasks = [] } = useQuery({
    queryKey: ["team-lead-completed-tasks", memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, assigned_to, completed_at, projects (name)")
        .in("assigned_to", memberIds)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: memberIds.length > 0,
  });

  // Structure Live Status for each member
  const liveTeamStatuses: TeamMemberLiveStatus[] = useMemo(() => {
    return teamMembers.map((m) => {
      const att = todayAttendance.find((a) => a.user_id === m.id);
      const todayUserLogs = todayLogs.filter((l) => l.user_id === m.id);
      const todayHours = todayUserLogs.reduce((acc, l) => acc + (Number(l.hours) || 0), 0);

      const yesterdayUserLogs = yesterdayLogs.filter((l) => l.user_id === m.id);
      const yesterdayHours = yesterdayUserLogs.reduce((acc, l) => acc + (Number(l.hours) || 0), 0);

      const inProgressTask = teamTasks.find(
        (t) => t.assigned_to === m.id && (t.status === "in_progress" || t.status === "In Progress")
      );

      return {
        id: m.id,
        fullName: m.full_name,
        email: m.email,
        avatarUrl: m.avatar_url,
        designation: (m as any).designation || "Software Engineer",
        department: m.department || "Engineering",
        isClockedIn: !!att?.clock_in && !att?.clock_out,
        clockInTime: att?.clock_in || undefined,
        clockOutTime: att?.clock_out || undefined,
        workMode: att?.work_mode || undefined,
        minutesLate: att?.minutes_late || 0,
        loggedTodayHours: todayHours,
        loggedYesterdayHours: yesterdayHours,
        hasLoggedYesterday: yesterdayHours > 0,
        activeTask: inProgressTask
          ? {
              id: inProgressTask.id,
              title: inProgressTask.title,
              priority: inProgressTask.priority,
              status: inProgressTask.status,
              projectName: (inProgressTask.projects as any)?.name || "Project",
            }
          : undefined,
      };
    });
  }, [teamMembers, todayAttendance, todayLogs, yesterdayLogs, teamTasks]);

  // Yesterday Strip Counts
  const yesterdayTotalCount = teamMembers.length;
  const yesterdaySubmittedCount = liveTeamStatuses.filter((m) => m.hasLoggedYesterday).length;
  const yesterdayMissingCount = yesterdayTotalCount - yesterdaySubmittedCount;

  // Blocked and Review Queue
  const blockedAndReviewQueue: ReviewOrBlockedTask[] = useMemo(() => {
    const list: ReviewOrBlockedTask[] = [];

    teamTasks.forEach((t) => {
      const statusLower = (t.status || "").toLowerCase();
      const isReview = statusLower.includes("review") || statusLower.includes("qa") || statusLower.includes("testing");
      const isBlocked = !!t.is_flagged || statusLower.includes("block");

      if (isReview || isBlocked) {
        const assignee = teamMembers.find((m) => m.id === t.assigned_to);
        list.push({
          id: t.id,
          title: t.title,
          projectName: (t.projects as any)?.name || "Project",
          assigneeName: assignee ? assignee.full_name : "Unassigned",
          assigneeAvatar: assignee?.avatar_url,
          status: t.status,
          priority: t.priority,
          isFlagged: isBlocked,
          dueDate: t.due_date,
          estimatedHours: t.estimated_hours,
        });
      }
    });

    return list;
  }, [teamTasks, teamMembers]);

  // Function to build 30-day dossier for 1:1 prep
  const getMemberPerformancePack = (memberId: string): MemberPerformancePack | null => {
    const member = teamMembers.find((m) => m.id === memberId);
    if (!member) return null;

    const userLogs = pastMonthLogs.filter((l) => l.user_id === memberId);
    const totalLogged = userLogs.reduce((acc, l) => acc + (Number(l.hours) || 0), 0);

    const userAtt = pastMonthAttendance.filter((a) => a.user_id === memberId);
    const daysPresent = userAtt.length;
    const onTimeDays = userAtt.filter((a) => (a.minutes_late || 0) === 0).length;
    const punctuality = daysPresent > 0 ? Math.round((onTimeDays / daysPresent) * 100) : 100;

    // Approximate expected 22 working days * shiftHours
    const expectedCap = 22 * shiftHours;
    const utilRate = expectedCap > 0 ? Math.round((totalLogged / expectedCap) * 100) : 0;

    const userCompletedTasks = completedTasks.filter((t) => t.assigned_to === memberId);
    const recentDeliverables = userCompletedTasks.slice(0, 5).map((t) => ({
      id: t.id,
      title: t.title,
      projectName: (t.projects as any)?.name || "Project",
      completedAt: t.completed_at || "",
    }));

    return {
      memberId: member.id,
      fullName: member.full_name,
      designation: (member as any).designation || "Engineer",
      avatarUrl: member.avatar_url,
      totalLoggedHours: Math.round(totalLogged),
      expectedCapacity: expectedCap,
      utilizationRate: utilRate,
      onTimeAttendanceRate: punctuality,
      daysPresent,
      completedTasksCount: userCompletedTasks.length,
      recentDeliverables,
    };
  };

  // Nudge mutation (creates notification)
  const nudgeMutation = useMutation({
    mutationFn: async ({ userId, memberName }: { userId: string; memberName: string }) => {
      await createNotification({
        userId,
        type: "project_update",
        title: "Daily Work Log Reminder",
        message: `Hi ${memberName}, your team lead noticed your work log for yesterday (${yesterdayStr}) is missing. Please submit your daily log.`,
      });
    },
    onSuccess: (_, vars) => {
      toast.success(`Nudge reminder sent to ${vars.memberName}`);
    },
    onError: (err) => {
      toast.error(`Failed to send reminder: ${(err as any).message}`);
    },
  });

  // Nudge All Missing
  const nudgeAllMissing = async () => {
    const missingMembers = liveTeamStatuses.filter((m) => !m.hasLoggedYesterday);
    if (missingMembers.length === 0) {
      toast.info("Everyone has submitted yesterday's log!");
      return;
    }

    try {
      for (const m of missingMembers) {
        await createNotification({
          userId: m.id,
          type: "project_update",
          title: "Daily Work Log Reminder",
          message: `Hi ${m.fullName}, your daily work log for yesterday (${yesterdayStr}) is pending. Please log your hours to keep sprint velocity accurate.`,
        });
      }
      toast.success(`Nudge sent to ${missingMembers.length} team members!`);
    } catch (err: any) {
      toast.error(`Error sending nudges: ${err.message}`);
    }
  };

  return {
    todayStr,
    yesterdayStr,
    selectedDepartment: activeDepartment,
    setSelectedDepartment: setSelectedDept,
    availableDepartments,
    liveTeamStatuses,
    yesterdayTotalCount,
    yesterdaySubmittedCount,
    yesterdayMissingCount,
    blockedAndReviewQueue,
    getMemberPerformancePack,
    nudgeMember: (userId: string, name: string) => nudgeMutation.mutate({ userId, memberName: name }),
    nudgeAllMissing,
    isNudging: nudgeMutation.isPending,
  };
}


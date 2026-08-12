import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useWorkSettings,
  formatShiftTime,
  formatLateness,
  getPKTDateString,
  isAttendanceLate,
  isLogSubmissionLate,
} from "@/hooks/useWorkSettings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DataRow,
  RowPrimary,
  RowSecondary,
  RowDataGrid,
  RowDataItem,
  RowActions,
  TableHeader,
} from "@/components/ui/data-row";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  AlertTriangle,
  Users,
  FileText,
  Calendar,
  FolderKanban,
  Plus,
  Building2,
  BarChart3,
  CheckCircle,
  XCircle,
  MapPin,
  Monitor,
  ArrowRight,
  Info,
  Filter,
  Download,
  Settings2,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow, subDays } from "date-fns";
import {
  getAvatarUrl,
  getLeaveTypeName,
  getCurrentLeaveYear,
  toSlug,
} from "@/lib/utils";

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [requestBannerDismissTick, setRequestBannerDismissTick] = useState(0);
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const isClient =
    profile?.role === "client" ||
    profile?.role === "client member" ||
    profile?.role === "client portal";
  const hasProfile = !!profile?.id;
  const today = getPKTDateString();
  const {
    annualLeaveEntitlement,
    shiftStart,
    shiftEnd,
    workingDays,
    graceMinutes,
  } = useWorkSettings();

  const dayOfWeek = new Date(today + "T00:00:00").getDay();
  const isWeekendDay =
    dayOfWeek === 0 || (dayOfWeek === 6 && workingDays === 5);

  // ——— Shared queries ———
  const { data: todayRecord } = useQuery({
    queryKey: ["dashboard-attendance", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user!.id)
        .eq("date", today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: hasProfile && !!user?.id,
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  // ——— Admin queries ———
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [
        activeEmployeesResult,
        todayAttendanceResult,
        pendingLeavesResult,
        activeProjectsResult,
      ] = await Promise.all([
        supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
          .lte("join_date", today),
        supabase
          .from("attendance")
          .select("user_id")
          .eq("date", today)
          .not("clock_in", "is", null),
        supabase
          .from("leave_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
      ]);
      return {
        activeEmployees: activeEmployeesResult.count || 0,
        todayClockedIn: todayAttendanceResult.data?.length || 0,
        pendingLeaves: pendingLeavesResult.count || 0,
        activeProjects: activeProjectsResult.count || 0,
      };
    },
    enabled: isAdmin && hasProfile,
    refetchInterval: 60000,
  });

  const { data: lateLogs } = useQuery({
    queryKey: ["dashboard-late-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*, users!daily_logs_user_id_fkey(full_name)")
        .eq("log_date", today)
        .eq("status", "submitted")
        .limit(50);
      if (error) throw error;
      return (data || [])
        .filter(
          (l: any) =>
            l.submitted_at &&
            isLogSubmissionLate(l.submitted_at, shiftEnd, l.log_date),
        )
        .slice(0, 10);
    },
    enabled: isAdmin && hasProfile,
  });

  const { data: pendingLeaveList } = useQuery({
    queryKey: ["dashboard-pending-leaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(
          "*, users!leave_requests_user_id_fkey(full_name), leave_types(name)",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && hasProfile,
  });

  const { data: recentAudit } = useQuery({
    queryKey: ["dashboard-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, users:actor_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && hasProfile,
  });

  // ——— Admin dashboard new queries ———
  const [adminTab, setAdminTab] = useState<"overview" | "team" | "projects">(
    "overview",
  );

  const { data: workforceSplit } = useQuery({
    queryKey: ["dashboard-workforce-split"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("work_mode")
        .eq("date", today)
        .not("clock_in", "is", null);
      if (error) throw error;
      const rows = data || [];
      const onsite = rows.filter((r: any) => r.work_mode === "onsite").length;
      const remote = rows.filter((r: any) => r.work_mode === "remote").length;
      return { onsite, remote, total: onsite + remote };
    },
    enabled: isAdmin && hasProfile,
  });

  const { data: attendanceTrend } = useQuery({
    queryKey: ["dashboard-attendance-trend"],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sept",
        "Okt",
        "Nov",
        "Dec",
      ];
      const results = [];
      for (let m = 0; m < 12; m++) {
        const startDate = `${year}-${String(m + 1).padStart(2, "0")}-01`;
        const endMonth = m === 11 ? 1 : m + 2;
        const endYear = m === 11 ? year + 1 : year;
        const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
        const { count } = await supabase
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .gte("date", startDate)
          .lt("date", endDate)
          .not("clock_in", "is", null);
        const { count: lateCount } = await supabase
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .gte("date", startDate)
          .lt("date", endDate)
          .not("clock_in", "is", null)
          .eq("is_late", true);
        const total = count || 0;
        const late = lateCount || 0;
        const pct =
          total > 0 ? Math.round(((total - late) / total) * 100) : 100;
        results.push({ month: months[m], attendance: pct, lateLogs: late });
      }
      return results;
    },
    enabled: isAdmin && hasProfile,
  });

  const { data: attendanceScore } = useQuery({
    queryKey: ["dashboard-attendance-score"],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const startDate = sevenDaysAgo.toISOString().split("T")[0];
      const { count: totalLogs } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .gte("date", startDate)
        .not("clock_in", "is", null);
      const { count: lateLogs } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .gte("date", startDate)
        .not("clock_in", "is", null)
        .eq("is_late", true);
      const total = totalLogs || 0;
      const late = lateLogs || 0;
      const score =
        total > 0
          ? Math.max(0, Math.round(((total - late) / total) * 100))
          : 100;
      const prevWeekScore = Math.min(100, score + 1);
      return { score, change: score - prevWeekScore, lateCount: late };
    },
    enabled: isAdmin && hasProfile,
  });

  const { data: dailyLogsHeatmap } = useQuery({
    queryKey: ["dashboard-daily-logs-heatmap"],
    queryFn: async () => {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const slots = ["12 AM - 8 AM", "8 AM - 4 PM", "4 PM - 12 AM"];
      const result: any[] = [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      for (const slot of slots) {
        const row: any = { slot };
        for (let d = 0; d < 7; d++) {
          const date = new Date(sevenDaysAgo);
          date.setDate(date.getDate() + d);
          const dateStr = date.toISOString().split("T")[0];
          let startHour = 0,
            endHour = 8;
          if (slot === "8 AM - 4 PM") {
            startHour = 8;
            endHour = 16;
          } else if (slot === "4 PM - 12 AM") {
            startHour = 16;
            endHour = 24;
          }
          const { count } = await supabase
            .from("daily_logs")
            .select("*", { count: "exact", head: true })
            .eq("log_date", dateStr)
            .gte(
              "created_at",
              new Date(date.setHours(startHour)).toLocaleString("sv-SE"),
            )
            .lt(
              "created_at",
              new Date(date.setHours(endHour)).toLocaleString("sv-SE"),
            );
          row[days[d]] = count || 0;
        }
        result.push(row);
      }
      return result;
    },
    enabled: isAdmin && hasProfile,
  });

  // ——— Employee queries (Bundled into 1 query to prevent 9-stage flickering) ———
  const currentLeaveYear = getCurrentLeaveYear();

  const { data: employeeData } = useQuery({
    queryKey: [
      "dashboard-employee-bundle",
      user?.id,
      today,
      currentLeaveYear.startYear,
    ],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const [
        todayLogsRes,
        leaveRequestsRes,
        myProjectsRes,
        recentLogsRes,
        announcementsRes,
        unnotifiedProjectsRes,
        recentLeavesRes,
        recentWfhRes,
      ] = await Promise.all([
        supabase
          .from("daily_logs")
          .select("*, projects(name)")
          .eq("user_id", user!.id)
          .eq("log_date", today)
          .eq("status", "submitted"),
        supabase
          .from("leave_requests")
          .select("days_count, hours")
          .eq("user_id", user!.id)
          .eq("status", "approved")
          .gte("start_date", currentLeaveYear.start)
          .lte("start_date", currentLeaveYear.end),
        supabase
          .from("project_members")
          .select(
            "project_id, project_roles(name), projects(id, name, status, clients(name))",
          )
          .eq("user_id", user!.id)
          .is("removed_at", null),
        supabase
          .from("daily_logs")
          .select("*, projects(name)")
          .eq("user_id", user!.id)
          .eq("status", "submitted")
          .order("log_date", { ascending: false })
          .limit(5),
        supabase
          .from("announcements")
          .select("*, announcement_reads(user_id, dismissed)")
          .eq("priority", "urgent")
          .lte("publish_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("project_members")
          .select("project_id, projects(name)")
          .eq("user_id", user!.id)
          .eq("notified", false)
          .is("removed_at", null),
        supabase
          .from("leave_requests")
          .select("id, status, start_date, end_date, hours, leave_types(name)")
          .eq("user_id", user!.id)
          .in("status", ["approved", "rejected"])
          .gte("reviewed_at", thirtyDaysAgo),
        supabase
          .from("remote_work_requests")
          .select("id, status, start_date, end_date")
          .eq("user_id", user!.id)
          .in("status", ["approved", "rejected"])
          .gte("reviewed_at", thirtyDaysAgo),
      ]);

      const leaveData = leaveRequestsRes.data || [];
      const usedLeaveDays = leaveData.reduce(
        (sum, r) => sum + (r.days_count || 0),
        0,
      );
      const halfDayHours =
        leaveData.reduce((sum, r) => sum + Number(r.hours || 0), 0) % 8;

      const announcements = announcementsRes.data || [];
      const urgentAnnouncements = announcements.filter((a: any) => {
        const reads = a.announcement_reads as any[];
        return !reads?.some(
          (r: any) => r.user_id === user!.id && r.dismissed,
        );
      });

      return {
        todayLogs: todayLogsRes.data || [],
        usedLeaveDays,
        halfDayHours,
        myProjects: myProjectsRes.data || [],
        recentLogs: recentLogsRes.data || [],
        urgentAnnouncements,
        unnotifiedProjects: unnotifiedProjectsRes.data || [],
        recentLeaves: recentLeavesRes.data || [],
        recentWfh: recentWfhRes.data || [],
      };
    },
    enabled: !isAdmin && hasProfile && !!user?.id,
  });

  const todayLogs = employeeData?.todayLogs ?? [];
  const usedLeaveDays = employeeData?.usedLeaveDays ?? 0;
  const halfDayHours = employeeData?.halfDayHours ?? 0;
  const annualRemaining = Math.max(0, annualLeaveEntitlement - usedLeaveDays);
  const myProjects = employeeData?.myProjects ?? [];
  const recentLogs = employeeData?.recentLogs ?? [];
  const urgentAnnouncements = employeeData?.urgentAnnouncements ?? [];
  const unnotifiedProjects = employeeData?.unnotifiedProjects ?? [];
  const recentLeaves = employeeData?.recentLeaves ?? [];
  const recentWfh = employeeData?.recentWfh ?? [];

  const visibleProjectNotifications = useMemo(() => {
    if (!unnotifiedProjects || !user?.id) return [];
    return unnotifiedProjects.filter((p: any) => {
      const key = `project_notified_${user.id}_${p.project_id}`;
      return !localStorage.getItem(key);
    });
  }, [unnotifiedProjects, user?.id]);

  const visibleRequestNotifications = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _tick = requestBannerDismissTick;
    if (!user?.id) return [];
    const notifications: any[] = [];

    if (recentLeaves) {
      recentLeaves.forEach((r: any) => {
        const key = `request_notified_${user.id}_leave_${r.id}_${r.status}`;
        if (!localStorage.getItem(key)) {
          notifications.push({ type: "leave", data: r });
        }
      });
    }

    if (recentWfh) {
      recentWfh.forEach((r: any) => {
        const key = `request_notified_${user.id}_wfh_${r.id}_${r.status}`;
        if (!localStorage.getItem(key)) {
          notifications.push({ type: "wfh", data: r });
        }
      });
    }

    return notifications;
  }, [recentLeaves, recentWfh, user?.id, requestBannerDismissTick]);

  const { data: teamStatus } = useQuery({
    queryKey: ["dashboard-team-today"],
    queryFn: async () => {
      const [{ data: users }, { data: attendance }, { data: todayLeaves }] =
        await Promise.all([
          supabase
            .from("users")
            .select(
              "id, full_name, designation, avatar_url, role, is_on_leave, is_on_leave_from, is_on_leave_to",
            )
            .eq("role", "employee")
            .eq("status", "active"),
          supabase
            .from("attendance")
            .select("user_id, work_mode, clock_in, clock_out")
            .eq("date", today),
          supabase
            .from("leave_requests")
            .select("user_id, leave_types(name)")
            .lte("start_date", today)
            .gte("end_date", today)
            .eq("status", "approved"),
        ]);

      const attendanceMap = (attendance || []).reduce((acc: any, curr) => {
        const existing = acc[curr.user_id];
        if (!existing) {
          acc[curr.user_id] = curr;
        } else {
          const isCurrActive = !curr.clock_out && !!curr.clock_in;
          const isExistActive = !existing.clock_out && !!existing.clock_in;
          if (isCurrActive && !isExistActive) {
            acc[curr.user_id] = curr;
          } else if (isCurrActive === isExistActive) {
            if (new Date(curr.clock_in) > new Date(existing.clock_in)) {
              acc[curr.user_id] = curr;
            }
          }
        }
        return acc;
      }, {});

      const leaveMap = (todayLeaves || []).reduce((acc: any, curr: any) => {
        acc[curr.user_id] = (curr.leave_types as any)?.name || "Leave";
        return acc;
      }, {});

      (users || []).forEach((u: any) => {
        if (!leaveMap[u.id] && u.is_on_leave) {
          const fromOk = !u.is_on_leave_from || u.is_on_leave_from <= today;
          const toOk = !u.is_on_leave_to || u.is_on_leave_to >= today;
          if (fromOk && toOk) {
            leaveMap[u.id] = "On Leave";
          }
        }
      });

      const team = (users || []).map((u) => ({
        ...u,
        attendance: attendanceMap[u.id] || null,
        onLeave: leaveMap[u.id] || null,
      }));

      return team.sort((a, b) => {
        const aClocked = !!a.attendance?.clock_in;
        const bClocked = !!b.attendance?.clock_in;
        const aLeave = !!a.onLeave;
        const bLeave = !!b.onLeave;
        if (aClocked && !bClocked) return -1;
        if (!aClocked && bClocked) return 1;
        if (aLeave && !bLeave) return -1;
        if (!aLeave && bLeave) return 1;
        return a.full_name.localeCompare(b.full_name);
      });
    },
    enabled: hasProfile,
    refetchInterval: 30000,
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const dismissAnnouncement = async (announcementId: string) => {
    await supabase
      .from("announcement_reads")
      .upsert(
        { announcement_id: announcementId, user_id: user!.id, dismissed: true },
        { onConflict: "announcement_id,user_id" as any },
      );
    queryClient.invalidateQueries({ queryKey: ["dashboard-urgent"] });
  };

  const dismissProjectNotification = async () => {
    if (
      !visibleProjectNotifications ||
      visibleProjectNotifications.length === 0
    )
      return;

    // Track in localStorage as requested
    visibleProjectNotifications.forEach((p: any) => {
      const key = `project_notified_${user.id}_${p.project_id}`;
      localStorage.setItem(key, "true");
    });

    const projectIds = visibleProjectNotifications.map(
      (p: any) => p.project_id,
    );
    const { error } = await supabase
      .from("project_members")
      .update({ notified: true })
      .in("project_id", projectIds)
      .eq("user_id", user!.id);

    if (!error) {
      queryClient.invalidateQueries({
        queryKey: ["dashboard-unnotified-projects"],
      });
      toast.success("Notification dismissed");
    }
  };

  const dismissRequestNotifications = () => {
    if (
      !visibleRequestNotifications ||
      visibleRequestNotifications.length === 0
    )
      return;

    visibleRequestNotifications.forEach((n) => {
      const key = `request_notified_${user!.id}_${n.type}_${n.data.id}_${n.data.status}`;
      localStorage.setItem(key, "true");
    });

    setRequestBannerDismissTick((t) => t + 1);
    queryClient.invalidateQueries({ queryKey: ["dashboard-recent-leaves"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-recent-wfh"] });
  };

  const handleLeaveAction = async (
    requestId: string,
    action: "approved" | "rejected",
  ) => {
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: action,
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["dashboard-pending-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["pending-leave-count"] });
    }
  };

  const isClockedIn = !!todayRecord?.clock_in && !todayRecord?.clock_out;
  const hasClockedOut = !!todayRecord?.clock_in && !!todayRecord?.clock_out;

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const todayDurationSeconds =
    todayRecord?.clock_in && todayRecord?.clock_out
      ? Math.floor(
          (new Date(todayRecord.clock_out).getTime() -
            new Date(todayRecord.clock_in).getTime()) /
            1000,
        )
      : 0;

  const hasSubmittedLog = (todayLogs?.length || 0) > 0;

  // ——— ADMIN DASHBOARD ———
  if (isAdmin) {
    const avatarColors = [
      "#EC6824",
      "#3B82F6",
      "#8B5CF6",
      "#10B981",
      "#F59E0B",
      "#EF4444",
    ];
    const getAvatarColor = (name: string) => {
      let hash = 0;
      for (let i = 0; i < name.length; i++)
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      return avatarColors[Math.abs(hash) % avatarColors.length];
    };

    return (
      <div style={{ padding: "0", background: "transparent" }}>
        {/* 1. Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: "700",
                color: "#09090B",
                margin: 0,
                fontFamily: "Inter, sans-serif",
              }}
            >
              Admin Dashboard
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#71717A",
                marginTop: "4px",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Welcome back, {profile?.full_name ?? "User"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Small icon buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  border: "1px solid #E4E4E7",
                  background: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#71717A",
                }}
              >
                <Download style={{ width: "16px", height: "16px" }} />
              </button>
              <button
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  border: "1px solid #E4E4E7",
                  background: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#71717A",
                }}
              >
                <AlertTriangle style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
            {/* User avatar circles */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#EC6824",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "600",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                BF
              </div>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#3B82F6",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "600",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                KK
              </div>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#E4E4E7",
                  color: "#71717A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "600",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                +3
              </div>
            </div>
            {/* User icon button */}
            <button
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                border: "1px solid #E4E4E7",
                background: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#71717A",
              }}
            >
              <Users style={{ width: "16px", height: "16px" }} />
            </button>
            {/* Customize Widgets button */}
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                border: "none",
                borderRadius: "8px",
                background: "#09090B",
                color: "white",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              <Settings2 style={{ width: "16px", height: "16px" }} />
              Customize Widgets
            </button>
          </div>
        </div>

        {/* 2. Tab bar + Filter/Export */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button
              onClick={() => setAdminTab("overview")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                background: adminTab === "overview" ? "#09090B" : "transparent",
                color: adminTab === "overview" ? "white" : "#71717A",
                transition: "all 0.15s ease",
              }}
            >
              Overview
            </button>
            <button
              onClick={() => setAdminTab("team")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                background: adminTab === "team" ? "#09090B" : "transparent",
                color: adminTab === "team" ? "white" : "#71717A",
                transition: "all 0.15s ease",
              }}
            >
              Team
            </button>
            <button
              onClick={() => setAdminTab("projects")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                background: adminTab === "projects" ? "#09090B" : "transparent",
                color: adminTab === "projects" ? "white" : "#71717A",
                transition: "all 0.15s ease",
              }}
            >
              Projects
            </button>
            <button
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                background: "transparent",
                color: "#71717A",
              }}
            >
              + Add Widget
            </button>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                border: "1px solid #E4E4E7",
                borderRadius: "8px",
                background: "white",
                color: "#09090B",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              <Filter style={{ width: "14px", height: "14px" }} />
              Filter
            </button>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                border: "none",
                borderRadius: "8px",
                background: "#09090B",
                color: "white",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              <Download style={{ width: "14px", height: "14px" }} />
              Export
            </button>
          </div>
        </div>

        {/* 3. Stats cards row - single container with dividers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            background: "white",
            border: "1px solid #E4E4E7",
            borderRadius: "16px",
            marginBottom: "24px",
            overflow: "hidden",
          }}
        >
          {/* Active Employees */}
          <div
            onClick={() => navigate("/employees")}
            style={{
              padding: "20px",
              cursor: "pointer",
              borderRight: "1px solid #E4E4E7",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "14px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  color: "#71717A",
                  fontWeight: "500",
                }}
              >
                Active Employees
              </span>
              <Info style={{ width: "14px", height: "14px", opacity: 0.4 }} />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "34px",
                    fontWeight: "700",
                    color: "#09090B",
                    lineHeight: "1",
                    marginBottom: "10px",
                  }}
                >
                  {stats?.activeEmployees ?? "—"}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#A1A1AA",
                    fontWeight: "500",
                  }}
                >
                  vs last week{" "}
                  <span
                    style={{
                      color: "#22C55E",
                      fontWeight: "600",
                      marginLeft: "6px",
                    }}
                  >
                    ↑ 2
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "6px",
                  marginBottom: "4px",
                }}
              >
                <div
                  style={{
                    width: "5px",
                    borderRadius: "2px 2px 0 0",
                    background: "rgba(236,104,36,0.4)",
                    height: "14px",
                  }}
                ></div>
                <div
                  style={{
                    width: "5px",
                    borderRadius: "2px 2px 0 0",
                    background: "rgba(236,104,36,0.7)",
                    height: "22px",
                  }}
                ></div>
                <div
                  style={{
                    width: "5px",
                    borderRadius: "2px 2px 0 0",
                    background: "#EC6824",
                    height: "34px",
                  }}
                ></div>
              </div>
            </div>
            <div
              style={{
                borderTop: "1px solid #F4F4F5",
                marginTop: "16px",
                paddingTop: "14px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#09090B",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                See Details{" "}
                <ArrowRight
                  style={{
                    width: "14px",
                    height: "14px",
                    marginLeft: "6px",
                    color: "#EC6824",
                  }}
                />
              </span>
            </div>
          </div>

          {/* Active Projects */}
          <div
            onClick={() => navigate("/projects")}
            style={{
              padding: "20px",
              cursor: "pointer",
              borderRight: "1px solid #E4E4E7",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "14px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  color: "#71717A",
                  fontWeight: "500",
                }}
              >
                Active Projects
              </span>
              <Info style={{ width: "14px", height: "14px", opacity: 0.4 }} />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "34px",
                    fontWeight: "700",
                    color: "#09090B",
                    lineHeight: "1",
                    marginBottom: "10px",
                  }}
                >
                  {stats?.activeProjects ?? "—"}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#A1A1AA",
                    fontWeight: "500",
                  }}
                >
                  vs last week{" "}
                  <span
                    style={{
                      color: "#22C55E",
                      fontWeight: "600",
                      marginLeft: "6px",
                    }}
                  >
                    ↑ 1
                  </span>
                </div>
              </div>
              <div
                style={{
                  width: "52px",
                  height: "36px",
                  color: "#EC6824",
                  marginBottom: "4px",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ width: "100%", height: "100%", opacity: 0.9 }}
                >
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                  <polyline points="16 7 22 7 22 13"></polyline>
                </svg>
              </div>
            </div>
            <div
              style={{
                borderTop: "1px solid #F4F4F5",
                marginTop: "16px",
                paddingTop: "14px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#09090B",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                See Details{" "}
                <ArrowRight
                  style={{
                    width: "14px",
                    height: "14px",
                    marginLeft: "6px",
                    color: "#EC6824",
                  }}
                />
              </span>
            </div>
          </div>

          {/* Today's Attendance */}
          <div
            onClick={() => navigate("/attendance")}
            style={{
              padding: "20px",
              cursor: "pointer",
              borderRight: "1px solid #E4E4E7",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "14px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  color: "#71717A",
                  fontWeight: "500",
                }}
              >
                Today's Attendance
              </span>
              <Info style={{ width: "14px", height: "14px", opacity: 0.4 }} />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "34px",
                    fontWeight: "700",
                    color: "#09090B",
                    lineHeight: "1",
                    marginBottom: "10px",
                  }}
                >
                  {stats?.todayClockedIn ?? 0}
                  <span
                    style={{
                      fontSize: "22px",
                      color: "#A1A1AA",
                      fontWeight: "600",
                    }}
                  >
                    /{stats?.activeEmployees ?? 0}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#A1A1AA",
                    fontWeight: "500",
                  }}
                >
                  vs yesterday{" "}
                  <span
                    style={{
                      color: "#71717A",
                      fontWeight: "600",
                      marginLeft: "6px",
                    }}
                  >
                    - 0%
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  marginBottom: "4px",
                  paddingRight: "4px",
                }}
              >
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    border: "3px solid rgba(253,186,116,0.5)",
                  }}
                ></div>
              </div>
            </div>
            <div
              style={{
                borderTop: "1px solid #F4F4F5",
                marginTop: "16px",
                paddingTop: "14px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#09090B",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                See Details{" "}
                <ArrowRight
                  style={{
                    width: "14px",
                    height: "14px",
                    marginLeft: "6px",
                    color: "#EC6824",
                  }}
                />
              </span>
            </div>
          </div>

          {/* Pending Leave */}
          <div
            onClick={() => navigate("/leave/requests")}
            style={{ padding: "20px", cursor: "pointer" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "14px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  color: "#71717A",
                  fontWeight: "500",
                }}
              >
                Pending Leave
              </span>
              <Info style={{ width: "14px", height: "14px", opacity: 0.4 }} />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "34px",
                    fontWeight: "700",
                    color: "#09090B",
                    lineHeight: "1",
                    marginBottom: "10px",
                  }}
                >
                  {stats?.pendingLeaves ?? "—"}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#A1A1AA",
                    fontWeight: "500",
                  }}
                >
                  vs last week{" "}
                  <span
                    style={{
                      color: "#EF4444",
                      fontWeight: "600",
                      marginLeft: "6px",
                    }}
                  >
                    ↓ 3
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "6px",
                  marginBottom: "4px",
                }}
              >
                <div
                  style={{
                    width: "5px",
                    borderRadius: "2px 2px 0 0",
                    background: "#FDBA74",
                    height: "18px",
                  }}
                ></div>
                <div
                  style={{
                    width: "5px",
                    borderRadius: "2px 2px 0 0",
                    background: "#FDBA74",
                    height: "12px",
                  }}
                ></div>
                <div
                  style={{
                    width: "5px",
                    borderRadius: "2px 2px 0 0",
                    background: "#FDBA74",
                    height: "26px",
                  }}
                ></div>
                <div
                  style={{
                    width: "5px",
                    borderRadius: "2px 2px 0 0",
                    background: "#FDBA74",
                    height: "16px",
                  }}
                ></div>
              </div>
            </div>
            <div
              style={{
                borderTop: "1px solid #F4F4F5",
                marginTop: "16px",
                paddingTop: "14px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#09090B",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                See Details{" "}
                <ArrowRight
                  style={{
                    width: "14px",
                    height: "14px",
                    marginLeft: "6px",
                    color: "#EC6824",
                  }}
                />
              </span>
            </div>
          </div>
        </div>

        {/* 4. Attendance Score + Attendance Trend */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {/* Attendance Score */}
          <div
            style={{
              background: "white",
              border: "1px solid #E4E4E7",
              borderRadius: "16px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "20px",
              }}
            >
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "#09090B",
                }}
              >
                Attendance Score
              </span>
              <Info
                style={{ width: "14px", height: "14px", color: "#A1A1AA" }}
              />
            </div>
            {/* Semi-circular gauge */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <svg
                width="180"
                height="108"
                viewBox="0 0 180 108"
                style={{ overflow: "visible" }}
              >
                {(() => {
                  const cx = 90,
                    cy = 98,
                    r = 72;
                  const strokeWidth = 14;
                  const score = attendanceScore?.score ?? 0;
                  const endAngleDeg = 180 - (score / 100) * 180;
                  const endAngleRad = (endAngleDeg * Math.PI) / 180;
                  const startX = cx - r;
                  const startY = cy;
                  const endX = cx + r * Math.cos(endAngleRad);
                  const endY = cy - r * Math.sin(endAngleRad);
                  const largeArc = score > 50 ? 1 : 0;
                  const bgPath = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
                  const progressPath =
                    score > 0
                      ? `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`
                      : "";
                  return (
                    <>
                      <path
                        d={bgPath}
                        fill="none"
                        stroke="#F0F0F0"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                      />
                      {score > 0 && (
                        <path
                          d={progressPath}
                          fill="none"
                          stroke="#EC6824"
                          strokeWidth={strokeWidth}
                          strokeLinecap="round"
                        />
                      )}
                    </>
                  );
                })()}
              </svg>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "4px",
                  marginTop: "-6px",
                }}
              >
                <span
                  style={{
                    fontSize: "36px",
                    fontWeight: "700",
                    color: "#09090B",
                    lineHeight: "1",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {attendanceScore?.score ?? 0}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#DCFCE7",
                    color: "#16A34A",
                    fontSize: "11px",
                    fontWeight: "700",
                    marginTop: "2px",
                  }}
                >
                  +1
                </span>
              </div>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "#A1A1AA",
                textAlign: "center",
                marginBottom: "14px",
                marginTop: "2px",
              }}
            >
              of 100 points
            </p>
            <div
              style={{
                background: "#F4F4F5",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "14px",
              }}
            >
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#09090B",
                  margin: 0,
                }}
              >
                Great attendance this week ✓
              </p>
              <p
                style={{
                  fontSize: "12px",
                  color: "#6B7280",
                  marginTop: "6px",
                  marginBottom: 0,
                  lineHeight: "1.5",
                }}
              >
                Attendance is trending above target with only{" "}
                {attendanceScore?.lateCount ?? 1} late log across the whole team
                this week.
              </p>
            </div>
            <div style={{ borderTop: "1px solid #E4E4E7", paddingTop: "12px" }}>
              <a
                href="#"
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#EC6824",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Improve Score{" "}
                <ArrowRight
                  style={{ width: "14px", height: "14px", marginLeft: "4px" }}
                />
              </a>
            </div>
          </div>

          {/* Attendance Trend */}
          <div
            style={{
              background: "white",
              border: "1px solid #E4E4E7",
              borderRadius: "16px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: "600",
                    color: "#09090B",
                  }}
                >
                  Attendance Trend
                </span>
                <Info
                  style={{ width: "14px", height: "14px", color: "#A1A1AA" }}
                />
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <button
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    border: "1px solid #E4E4E7",
                    borderRadius: "6px",
                    background: "white",
                    color: "#09090B",
                    fontSize: "12px",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  <Filter style={{ width: "12px", height: "12px" }} /> Filter
                </button>
                <button
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    border: "1px solid #E4E4E7",
                    borderRadius: "6px",
                    background: "white",
                    color: "#09090B",
                    fontSize: "12px",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  This Year{" "}
                  <ChevronDown style={{ width: "12px", height: "12px" }} />
                </button>
              </div>
            </div>
            <div style={{ height: "220px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={attendanceTrend || []}
                  margin={{ top: 5, right: 5, left: -15, bottom: 0 }}
                >
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#A1A1AA" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#A1A1AA" }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "#09090B",
                      border: "none",
                      borderRadius: "8px",
                      color: "white",
                      fontSize: "12px",
                      padding: "10px 14px",
                      lineHeight: "1.6",
                    }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0]?.payload;
                      return (
                        <div
                          style={{
                            background: "#09090B",
                            border: "none",
                            borderRadius: "8px",
                            color: "white",
                            fontSize: "12px",
                            padding: "10px 14px",
                            lineHeight: "1.6",
                          }}
                        >
                          <div
                            style={{ fontWeight: "600", marginBottom: "2px" }}
                          >
                            {label}, {new Date().getFullYear()}
                          </div>
                          <div>
                            Attendance{" "}
                            <span
                              style={{
                                float: "right",
                                fontWeight: "600",
                                marginLeft: "16px",
                              }}
                            >
                              {item?.attendance ?? 0}%
                            </span>
                          </div>
                          <div>
                            Late logs{" "}
                            <span
                              style={{
                                float: "right",
                                fontWeight: "600",
                                marginLeft: "16px",
                              }}
                            >
                              {item?.lateLogs ?? 0}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                    cursor={false}
                  />
                  <Bar
                    dataKey="attendance"
                    fill="#EC6824"
                    radius={[4, 4, 0, 0]}
                    barSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 5. Daily Logs Activity + Workforce Split */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {/* Daily Logs Activity */}
          <div
            style={{
              background: "white",
              border: "1px solid #E4E4E7",
              borderRadius: "16px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "#09090B",
                }}
              >
                Daily Logs Activity
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  color: "#A1A1AA",
                }}
              >
                <span>Low</span>
                <div
                  style={{
                    width: "20px",
                    height: "12px",
                    borderRadius: "3px",
                    background: "#FFF7ED",
                  }}
                ></div>
                <div
                  style={{
                    width: "20px",
                    height: "12px",
                    borderRadius: "3px",
                    background: "#FDBA74",
                  }}
                ></div>
                <div
                  style={{
                    width: "20px",
                    height: "12px",
                    borderRadius: "3px",
                    background: "#EC6824",
                  }}
                ></div>
                <div
                  style={{
                    width: "20px",
                    height: "12px",
                    borderRadius: "3px",
                    background: "#C2410C",
                  }}
                ></div>
                <span>High</span>
              </div>
            </div>
            {/* Heatmap grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "80px repeat(7, 1fr)",
                gap: "8px",
              }}
            >
              {/* Header row */}
              <div></div>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div
                  key={d}
                  style={{
                    fontSize: "12px",
                    color: "#71717A",
                    fontWeight: "500",
                    textAlign: "center",
                    padding: "4px 0",
                  }}
                >
                  {d}
                </div>
              ))}
              {/* Data rows */}
              {(
                dailyLogsHeatmap || [
                  {
                    slot: "12 AM - 8 AM",
                    Mon: 12,
                    Tue: 8,
                    Wed: 15,
                    Thu: 10,
                    Fri: 14,
                    Sat: 6,
                    Sun: 3,
                  },
                  {
                    slot: "8 AM - 4 PM",
                    Mon: 45,
                    Tue: 38,
                    Wed: 52,
                    Thu: 48,
                    Fri: 42,
                    Sat: 20,
                    Sun: 10,
                  },
                  {
                    slot: "4 PM - 12 AM",
                    Mon: 8,
                    Tue: 12,
                    Wed: 18,
                    Thu: 15,
                    Fri: 10,
                    Sat: 5,
                    Sun: 2,
                  },
                ]
              ).map((row: any, idx: number) => {
                const getHeatColor = (val: number) => {
                  if (val < 1) return "#FFF7ED";
                  if (val < 3) return "#FED7AA";
                  if (val < 5) return "#FDBA74";
                  if (val < 8) return "#EC6824";
                  return "#C2410C";
                };
                return (
                  <React.Fragment key={idx}>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#71717A",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {row.slot.replace(" - ", "–")}
                    </div>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (d) => (
                        <div
                          key={d}
                          style={{
                            height: "52px",
                            borderRadius: "10px",
                            background: getHeatColor(row[d] || 0),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0px",
                            fontWeight: "500",
                          }}
                        >
                          {row[d] || 0}
                        </div>
                      ),
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Workforce Split */}
          <div
            style={{
              background: "white",
              border: "1px solid #E4E4E7",
              borderRadius: "16px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "#09090B",
                }}
              >
                Workforce Split
              </span>
              <Info
                style={{ width: "14px", height: "14px", color: "#A1A1AA" }}
              />
            </div>
            <div
              style={{
                fontSize: "32px",
                fontWeight: "700",
                color: "#09090B",
                marginBottom: "4px",
              }}
            >
              {workforceSplit?.total ?? stats?.activeEmployees ?? 99}
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "#71717A",
                marginBottom: "20px",
              }}
            >
              Total employees{" "}
              <span style={{ color: "#22C55E", fontWeight: "600" }}>
                ↑ 8.5%
              </span>
            </div>
            {/* Donut chart */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "20px",
              }}
            >
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "On-site", value: workforceSplit?.onsite ?? 67 },
                      { name: "Remote", value: workforceSplit?.remote ?? 32 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    <Cell fill="#EC6824" />
                    <Cell fill="#FDBA74" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#EC6824",
                    }}
                  ></div>
                  <span style={{ fontSize: "13px", color: "#71717A" }}>
                    On-site
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#09090B",
                  }}
                >
                  {workforceSplit?.onsite ?? 67}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#FDBA74",
                    }}
                  ></div>
                  <span style={{ fontSize: "13px", color: "#71717A" }}>
                    Remote
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#09090B",
                  }}
                >
                  {workforceSplit?.remote ?? 32}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Recent Activity */}
        <div
          style={{
            background: "white",
            border: "1px solid #E4E4E7",
            borderRadius: "16px",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <span
              style={{ fontSize: "15px", fontWeight: "600", color: "#09090B" }}
            >
              Recent Activity
            </span>
            <a
              href="#"
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "#EC6824",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              View All{" "}
              <ArrowRight
                style={{ width: "14px", height: "14px", marginLeft: "4px" }}
              />
            </a>
          </div>
          {!recentAudit || recentAudit.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#A1A1AA" }}>
              No recent activity
            </p>
          ) : (
            <div>
              {recentAudit.map((a: any) => {
                const actorName = a.users?.full_name || "System";
                const initials = getInitials(actorName);
                const color = getAvatarColor(actorName);
                const actionParts = a.action.replace(/\./g, " → ").split(" → ");
                return (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 0",
                      borderBottom: "1px solid #F4F4F5",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: color,
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                          fontWeight: "600",
                          fontFamily: "Inter, sans-serif",
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div>
                        <span
                          style={{
                            fontSize: "14px",
                            fontWeight: "600",
                            color: "#09090B",
                          }}
                        >
                          {actorName}
                        </span>
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#71717A",
                            marginLeft: "6px",
                          }}
                        >
                          {a.action.replace(/\./g, " → ")}
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#A1A1AA",
                        flexShrink: 0,
                      }}
                    >
                      {formatDistanceToNow(new Date(a.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ——— CLIENT DASHBOARD ———
  if (isClient) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.full_name ?? "User"}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card
            className="p-5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/projects")}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-50">
                <FolderKanban className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projects</p>
                <p className="text-2xl font-bold">—</p>
              </div>
            </div>
          </Card>
          <Card
            className="p-5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/announcements")}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-50">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Announcements</p>
                <p className="text-2xl font-bold">—</p>
              </div>
            </div>
          </Card>
          <Card
            className="p-5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/profile")}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-50">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Profile</p>
                <p className="text-2xl font-bold">—</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ——— EMPLOYEE DASHBOARD ———
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {profile?.full_name ?? "User"}
        </p>
      </div>

      {urgentAnnouncements && urgentAnnouncements.length > 0 && (
        <div className="space-y-2">
          {urgentAnnouncements.map((a) => (
            <div
              key={a.id}
              className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start justify-between"
            >
              <div>
                <p className="text-sm font-medium text-red-800">{a.title}</p>
                <p className="text-xs text-red-600 mt-0.5 line-clamp-1">
                  {a.body.replace(/<[^>]*>/g, "")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs shrink-0"
                onClick={() => dismissAnnouncement(a.id)}
              >
                Dismiss
              </Button>
            </div>
          ))}
        </div>
      )}

      {visibleProjectNotifications &&
        visibleProjectNotifications.length > 0 && (
          <div className="bg-black border border-black/10 rounded-xl p-5 flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top duration-500">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-md">
                <FolderKanban className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white tracking-tight">
                  New Project Assignment
                </p>
                <p className="text-xs text-white/70 mt-0.5">
                  You've been added to:{" "}
                  <span className="font-bold text-white uppercase tracking-wider">
                    {visibleProjectNotifications
                      .map((p: any) => p.projects?.name)
                      .join(", ")}
                  </span>
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-button bg-white text-black hover:bg-white/90 border-none font-bold px-6 shadow-sm"
              onClick={dismissProjectNotification}
            >
              <CheckCircle className="h-4 w-4 mr-2" /> Got it
            </Button>
          </div>
        )}

      {visibleRequestNotifications &&
        visibleRequestNotifications.length > 0 && (
          <div className="bg-black border border-black/10 rounded-xl p-5 flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top duration-500">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-md">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white tracking-tight">
                  Request Update
                </p>
                <div className="text-xs text-white/70 mt-0.5 space-y-0.5">
                  {visibleRequestNotifications.map((n, idx) => {
                    if (n.type === "leave") {
                      const l = n.data;
                      const typeName = l.leave_types?.name || "Leave";
                      const dates =
                        l.start_date === l.end_date
                          ? format(
                              new Date(l.start_date + "T00:00:00"),
                              "MMM d, yyyy",
                            )
                          : `${format(new Date(l.start_date + "T00:00:00"), "MMM d")} - ${format(new Date(l.end_date + "T00:00:00"), "MMM d, yyyy")}`;

                      return (
                        <p key={idx}>
                          <span
                            className={`font-bold uppercase tracking-wider ${l.status === "approved" ? "text-green-400" : "text-red-400"}`}
                          >
                            {l.status}
                          </span>
                          : {typeName} for{" "}
                          <span className="font-bold text-white tracking-wider">
                            {dates}
                          </span>{" "}
                          {l.hours ? `(${l.hours} hrs)` : ""}
                        </p>
                      );
                    } else {
                      const w = n.data;
                      const date =
                        w.start_date === w.end_date
                          ? format(
                              new Date(w.start_date + "T00:00:00"),
                              "MMM d, yyyy",
                            )
                          : `${format(new Date(w.start_date + "T00:00:00"), "MMM d")} - ${format(new Date(w.end_date + "T00:00:00"), "MMM d, yyyy")}`;
                      return (
                        <p key={idx}>
                          <span
                            className={`font-bold uppercase tracking-wider ${w.status === "approved" ? "text-green-400" : "text-red-400"}`}
                          >
                            {w.status}
                          </span>
                          : Work From Home for{" "}
                          <span className="font-bold text-white tracking-wider">
                            {date}
                          </span>
                        </p>
                      );
                    }
                  })}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-button bg-white text-black hover:bg-white/90 border-none font-bold px-6 shadow-sm"
              onClick={dismissRequestNotifications}
            >
              <CheckCircle className="h-4 w-4 mr-2" /> Got it
            </Button>
          </div>
        )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <Clock
              className={`h-5 w-5 ${isClockedIn ? "text-green-600" : "text-muted-foreground"}`}
            />
            <span className="text-sm font-medium">Attendance</span>
          </div>
          {isClockedIn ? (
            <>
              <p className="text-sm">
                Clocked in since{" "}
                <strong>
                  {format(new Date(todayRecord!.clock_in!), "h:mm a")}
                </strong>{" "}
                ({todayRecord!.work_mode})
              </p>
              {todayRecord?.clock_in &&
                isAttendanceLate(
                  todayRecord.clock_in,
                  shiftStart,
                  graceMinutes,
                  workingDays,
                ).isLate && (
                  <p className="text-xs text-yellow-700 mt-1">
                    ⚠️ Late by{" "}
                    {formatLateness(
                      isAttendanceLate(
                        todayRecord.clock_in,
                        shiftStart,
                        graceMinutes,
                        workingDays,
                      ).minutesLate,
                    )}
                    .
                  </p>
                )}
            </>
          ) : hasClockedOut ? (
            <div className="space-y-1">
              <p className="text-sm text-green-700 font-medium">Clocked Out</p>
              {todayDurationSeconds > 0 && (
                <p className="text-xs text-muted-foreground">
                  Worked {formatDuration(todayDurationSeconds)} today
                </p>
              )}
            </div>
          ) : isWeekendDay ? (
            <p className="text-sm text-muted-foreground">Weekend (Off)</p>
          ) : (
            <p className="text-sm text-muted-foreground">Not clocked in</p>
          )}
          <Button
            size="sm"
            className="mt-3 rounded-button w-full"
            onClick={() => navigate("/attendance/my")}
          >
            {isClockedIn ? "View Session" : "Clock In"}
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <FileText
              className={`h-5 w-5 ${hasSubmittedLog ? "text-green-600" : "text-red-500"}`}
            />
            <span className="text-sm font-medium">Today's Log</span>
          </div>
          <p className="text-sm">
            {hasSubmittedLog ? (
              <span className="text-green-700">
                Submitted ({todayLogs!.length}{" "}
                {todayLogs!.length === 1 ? "entry" : "entries"})
              </span>
            ) : profile?.created_at &&
              today <= profile.created_at.split("T")[0] ? (
              <span className="text-muted-foreground">Not yet started</span>
            ) : isWeekendDay ? (
              <span className="text-muted-foreground">Weekend (Off)</span>
            ) : (
              <span className="text-red-600">Not submitted yet</span>
            )}
          </p>
          <Button
            size="sm"
            variant={hasSubmittedLog ? "outline" : "default"}
            disabled={!hasSubmittedLog && isWeekendDay}
            className="mt-3 rounded-button w-full"
            onClick={() => navigate("/logs/submit")}
          >
            {hasSubmittedLog ? "Add Another" : "Submit Log"}
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Leave Balance</span>
          </div>
          <p className="text-sm">
            <strong>{annualRemaining}</strong> annual leave days remaining
          </p>
          <p className="text-xs text-muted-foreground">
            {usedLeaveDays} used / {annualLeaveEntitlement} total
          </p>
          {halfDayHours > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {halfDayHours} hour{halfDayHours !== 1 ? "s" : ""} of half day
              leave used this year
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="mt-3 rounded-button w-full"
            onClick={() => navigate("/leave/my")}
          >
            Apply Leave
          </Button>
        </Card>
      </div>

      <div>
        <Dialog>
          <DialogTrigger asChild>
            <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-purple-50 group-hover:bg-purple-100 transition-colors">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-medium">Team Today</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {teamStatus?.filter(
                        (m: any) =>
                          !!m.attendance?.clock_in && !m.attendance?.clock_out,
                      ).length || 0}{" "}
                      active now
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-md p-0 overflow-y-auto">
            <DialogHeader className="p-4 pb-2 border-b">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-purple-600" />
                Team Status Today
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="divide-y">
                {!teamStatus || teamStatus.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No team members found.
                  </div>
                ) : (
                  teamStatus.map((member: any) => {
                    const clockedIn = !!member.attendance?.clock_in;
                    const mode = member.attendance?.work_mode;

                    return (
                      <div
                        key={member.id}
                        className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border">
                            <AvatarImage
                              src={getAvatarUrl(member.avatar_url)}
                            />
                            <AvatarFallback>
                              {getInitials(member.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold">
                              {member.full_name}
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-tight">
                              {member.designation || "Team Member"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center">
                          {member.onLeave ? (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none flex items-center gap-1 text-[10px] font-medium">
                              <Calendar className="h-3 w-3" /> On Leave (
                              {member.onLeave})
                            </Badge>
                          ) : !clockedIn ? (
                            <Badge
                              variant="secondary"
                              className="bg-muted text-muted-foreground text-[10px] font-normal border-none"
                            >
                              Not Clocked In
                            </Badge>
                          ) : member.attendance.clock_out ? (
                            <Badge
                              variant="secondary"
                              className="bg-muted text-muted-foreground text-[10px] font-normal border-none"
                            >
                              Clocked Out
                            </Badge>
                          ) : mode === "onsite" ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none flex items-center gap-1 text-[10px] font-medium">
                              <Building2 className="h-3 w-3" /> On-site
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none flex items-center gap-1 text-[10px] font-medium">
                              <Monitor className="h-3 w-3" /> Remote
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {myProjects && myProjects.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">My Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myProjects.map((pm: any) => (
              <Card
                key={pm.project_id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() =>
                  navigate(
                    `/projects/${toSlug(pm.projects?.name || pm.project_id)}`,
                  )
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{pm.projects?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pm.projects?.clients?.name || "No client"} ·{" "}
                      {pm.project_roles?.name || "Member"}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {pm.projects?.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {recentLogs && recentLogs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Logs</h2>
          <div>
            <TableHeader gridCols="1fr 112px 80px 80px">
              <span>PROJECT</span>
              <span>DATE</span>
              <span>HOURS</span>
              <span className="text-right">ACTIONS</span>
            </TableHeader>
            {recentLogs.map((log: any) => (
              <DataRow key={log.id} gridCols="1fr 112px 80px 80px">
                <div>
                  <RowPrimary>{log.projects?.name || "No project"}</RowPrimary>
                  <RowSecondary>
                    {format(
                      new Date(log.log_date + "T00:00:00"),
                      "MMM d, yyyy",
                    )}{" "}
                    · {log.category.replace(/_/g, " ")}
                  </RowSecondary>
                </div>
                <RowDataItem label="DATE">
                  {format(new Date(log.log_date + "T00:00:00"), "MMM d, yyyy")}
                </RowDataItem>
                <RowDataItem label="HOURS">{log.hours}h</RowDataItem>
                <RowActions className="justify-self-end">
                  <button
                    onClick={() => navigate("/logs/my")}
                    className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-xs font-medium text-[#6b7280]"
                    title="View"
                  >
                    View
                  </button>
                </RowActions>
              </DataRow>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

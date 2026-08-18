import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkSettings, formatShiftTime, formatLateness, getPKTDateString, isAttendanceLate, isLogSubmissionLate } from "@/hooks/useWorkSettings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataRow, RowPrimary, RowSecondary, RowDataGrid, RowDataItem, RowActions, TableHeader } from "@/components/ui/data-row";
import { useNavigate } from "react-router-dom";
import { Clock, AlertTriangle, Users, FileText, Calendar, FolderKanban, Plus, Building2, BarChart3, CheckCircle, XCircle, MapPin, Monitor, ArrowRight, Upload, Download, Filter, ChevronDown, Bell } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow, startOfYear, subDays, subWeeks } from "date-fns";
import { getAvatarUrl, getLeaveTypeName, getCurrentLeaveYear, toSlug } from "@/lib/utils";

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [requestBannerDismissTick, setRequestBannerDismissTick] = useState(0);
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const isClient = profile?.role === "client" || profile?.role === "client member";
  const hasProfile = !!profile?.id;
  const today = getPKTDateString();
  const { annualLeaveEntitlement, shiftStart, shiftEnd, workingDays, graceMinutes } = useWorkSettings();
  
  const dayOfWeek = new Date(today + "T00:00:00").getDay();
  const isWeekendDay = dayOfWeek === 0 || (dayOfWeek === 6 && workingDays === 5);

  // ——— Shared queries ———
  const { data: todayRecord } = useQuery({
    queryKey: ["dashboard-attendance", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("*").eq("user_id", user!.id).eq("date", today).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: hasProfile && !!user?.id,
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected": return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case "cancelled": return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  // ——— Admin queries ———
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [activeEmployeesResult, todayAttendanceResult, pendingLeavesResult, activeProjectsResult] = await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }).eq("status", "active").lte("join_date", today),
        supabase.from("attendance").select("user_id").eq("date", today).not("clock_in", "is", null),
        supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "active"),
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
      const { data, error } = await supabase.from("daily_logs").select("*, users!daily_logs_user_id_fkey(full_name)").eq("log_date", today).eq("status", "submitted").limit(50);
      if (error) throw error;
      return (data || []).filter((l: any) => l.submitted_at && isLogSubmissionLate(l.submitted_at, shiftEnd, l.log_date)).slice(0, 10);
    },
    enabled: isAdmin && hasProfile,
  });

  const { data: pendingLeaveList } = useQuery({
    queryKey: ["dashboard-pending-leaves"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leave_requests").select("*, users!leave_requests_user_id_fkey(full_name), leave_types(name)").eq("status", "pending").order("created_at", { ascending: false }).limit(3);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && hasProfile,
  });

  const { data: recentAudit } = useQuery({
    queryKey: ["dashboard-audit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("*, users:actor_id(full_name)").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && hasProfile,
  });

  // Read-only data used solely by the approved dashboard visualizations.
  const { data: dashboardVisuals } = useQuery({
    queryKey: ["dashboard-visuals", today],
    queryFn: async () => {
      const [attendanceResult, logsResult] = await Promise.all([
        supabase.from("attendance").select("date, clock_in").gte("date", format(startOfYear(new Date()), "yyyy-MM-dd")).lte("date", today),
        supabase.from("daily_logs").select("log_date, submitted_at").gte("log_date", format(subWeeks(new Date(), 12), "yyyy-MM-dd")).lte("log_date", today).eq("status", "submitted"),
      ]);
      if (attendanceResult.error) throw attendanceResult.error;
      if (logsResult.error) throw logsResult.error;
      return { attendance: attendanceResult.data || [], logs: logsResult.data || [] };
    },
    enabled: isAdmin && hasProfile,
  });

  // ——— Employee queries ———
  const { data: todayLogs } = useQuery({
    queryKey: ["dashboard-my-logs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_logs").select("*, projects(name)").eq("user_id", user!.id).eq("log_date", today).eq("status", "submitted");
      if (error) throw error;
      return data || [];
    },
    enabled: !isAdmin && hasProfile && !!user?.id,
  });

  // Leave balance uses the hook's annualLeaveEntitlement (live from system_settings)
  const currentLeaveYear = getCurrentLeaveYear();
  const { data: usedLeaveDays = 0 } = useQuery({
    queryKey: ["my-used-leave-days", user?.id, currentLeaveYear.startYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("days_count")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .gte("start_date", currentLeaveYear.start)
        .lte("start_date", currentLeaveYear.end);
      return (data || []).reduce((sum, r) => sum + r.days_count, 0);
    },
    enabled: !isAdmin && hasProfile && !!user?.id,
  });

  const annualRemaining = Math.max(0, annualLeaveEntitlement - usedLeaveDays);

  // Half-day hours used
  const { data: halfDayHours = 0 } = useQuery({
    queryKey: ["my-half-day-hours", user?.id, currentLeaveYear.startYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("hours")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .not("hours", "is", null)
        .gte("start_date", currentLeaveYear.start)
        .lte("start_date", currentLeaveYear.end);
      return (data || []).reduce((sum, r) => sum + Number(r.hours), 0) % 8;
    },
    enabled: !isAdmin && hasProfile && !!user?.id,
  });

  const { data: myProjects } = useQuery({
    queryKey: ["dashboard-my-projects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_members").select("project_id, project_roles(name), projects(id, name, status, clients(name))").eq("user_id", user!.id).is("removed_at", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !isAdmin && hasProfile && !!user?.id,
  });

  const { data: recentLogs } = useQuery({
    queryKey: ["dashboard-recent-logs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_logs").select("*, projects(name)").eq("user_id", user!.id).eq("status", "submitted").order("log_date", { ascending: false }).limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !isAdmin && hasProfile && !!user?.id,
  });

  const { data: urgentAnnouncements } = useQuery({
    queryKey: ["dashboard-urgent", user?.id],
    queryFn: async () => {
      const { data: announcements, error } = await supabase.from("announcements").select("*, announcement_reads(user_id, dismissed)").eq("priority", "urgent").lte("publish_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (announcements || []).filter((a) => {
        const reads = a.announcement_reads as any[];
        return !reads?.some((r: any) => r.user_id === user!.id && r.dismissed);
      });
    },
    enabled: !isAdmin && hasProfile && !!user?.id,
  });
 
  const { data: unnotifiedProjects } = useQuery({
    queryKey: ["dashboard-unnotified-projects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("project_id, projects(name)")
        .eq("user_id", user!.id)
        .eq("notified", false)
        .is("removed_at", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !isAdmin && hasProfile && !!user?.id,
  });

  const { data: recentLeaves } = useQuery({
    queryKey: ["dashboard-recent-leaves", user?.id],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, status, start_date, end_date, hours, leave_types(name)")
        .eq("user_id", user!.id)
        .in("status", ["approved", "rejected"])
        .gte("reviewed_at", thirtyDaysAgo);
      if (error) throw error;
      return data || [];
    },
    enabled: !isAdmin && hasProfile && !!user?.id,
  });

  const { data: recentWfh } = useQuery({
    queryKey: ["dashboard-recent-wfh", user?.id],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from("remote_work_requests")
        .select("id, status, start_date, end_date")
        .eq("user_id", user!.id)
        .in("status", ["approved", "rejected"])
        .gte("reviewed_at", thirtyDaysAgo);
      if (error) throw error;
      return data || [];
    },
    enabled: !isAdmin && hasProfile && !!user?.id,
  });

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
      const [{ data: users }, { data: attendance }, { data: todayLeaves }] = await Promise.all([
        supabase.from("users").select("id, full_name, designation, avatar_url, role, is_on_leave, is_on_leave_from, is_on_leave_to").eq("role", "employee").eq("status", "active"),
        supabase.from("attendance").select("user_id, work_mode, clock_in, clock_out").eq("date", today),
        supabase.from("leave_requests").select("user_id, leave_types(name)").lte("start_date", today).gte("end_date", today).eq("status", "approved")
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

      const team = (users || []).map(u => ({
        ...u,
        attendance: attendanceMap[u.id] || null,
        onLeave: leaveMap[u.id] || null
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
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const dismissAnnouncement = async (announcementId: string) => {
    await supabase.from("announcement_reads").upsert({ announcement_id: announcementId, user_id: user!.id, dismissed: true }, { onConflict: "announcement_id,user_id" as any });
    queryClient.invalidateQueries({ queryKey: ["dashboard-urgent"] });
  };
 
  const dismissProjectNotification = async () => {
    if (!visibleProjectNotifications || visibleProjectNotifications.length === 0) return;
    
    // Track in localStorage as requested
    visibleProjectNotifications.forEach((p: any) => {
      const key = `project_notified_${user.id}_${p.project_id}`;
      localStorage.setItem(key, "true");
    });
    
    const projectIds = visibleProjectNotifications.map((p: any) => p.project_id);
    const { error } = await supabase
      .from("project_members")
      .update({ notified: true })
      .in("project_id", projectIds)
      .eq("user_id", user!.id);
    
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["dashboard-unnotified-projects"] });
      toast.success("Notification dismissed");
    }
  };

  const dismissRequestNotifications = () => {
    if (!visibleRequestNotifications || visibleRequestNotifications.length === 0) return;
    
    visibleRequestNotifications.forEach((n) => {
      const key = `request_notified_${user!.id}_${n.type}_${n.data.id}_${n.data.status}`;
      localStorage.setItem(key, "true");
    });
    
    setRequestBannerDismissTick(t => t + 1);
    queryClient.invalidateQueries({ queryKey: ["dashboard-recent-leaves"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-recent-wfh"] });
  };

  const handleLeaveAction = async (requestId: string, action: "approved" | "rejected") => {
    const { error } = await supabase.from("leave_requests").update({
      status: action,
      reviewed_by: user!.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", requestId);
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

  const todayDurationSeconds = (todayRecord?.clock_in && todayRecord?.clock_out)
    ? Math.floor((new Date(todayRecord.clock_out).getTime() - new Date(todayRecord.clock_in).getTime()) / 1000)
    : 0;

  const hasSubmittedLog = (todayLogs?.length || 0) > 0;

  const attendanceMonths = useMemo(() => {
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, index) => {
      const key = `${year}-${String(index + 1).padStart(2, "0")}`;
      const clockedIn = dashboardVisuals?.attendance.filter((entry) => entry.date.startsWith(key) && entry.clock_in).length || 0;
      const daysInMonth = new Date(year, index + 1, 0).getDate();
      const denominator = Math.max(1, (stats?.activeEmployees || 1) * Math.min(daysInMonth, 22));
      return { key, label: format(new Date(year, index, 1), "MMM"), value: Math.min(100, Math.round((clockedIn / denominator) * 100)) };
    });
  }, [dashboardVisuals?.attendance, stats?.activeEmployees]);

  const logActivity = useMemo(() => ["12 AM–8 AM", "8 AM–4 PM", "4 PM–12 AM"].map((label, range) => Array.from({ length: 7 }, (_, day) => {
    const count = dashboardVisuals?.logs.filter((log) => {
      const loggedAt = log.submitted_at ? new Date(log.submitted_at) : new Date(`${log.log_date}T12:00:00`);
      return loggedAt.getDay() === (day + 1) % 7 && Math.floor(loggedAt.getHours() / 8) === range;
    }).length || 0;
    return { label, day, count };
  })), [dashboardVisuals?.logs]);

  const maxLogActivity = Math.max(1, ...logActivity.flat().map((cell) => cell.count));
  const workforce = useMemo(() => {
    const active = (teamStatus || []).filter((member: any) => !!member.attendance?.clock_in && !member.attendance?.clock_out);
    const onsite = active.filter((member: any) => member.attendance?.work_mode === "onsite").length;
    const remote = active.filter((member: any) => member.attendance?.work_mode === "remote").length;
    return { onsite, remote, total: onsite + remote };
  }, [teamStatus]);
  const attendanceScore = stats?.activeEmployees ? Math.round(((stats.todayClockedIn || 0) / stats.activeEmployees) * 100) : 0;

  if (isAdmin || isClient) {
    return (
      <div className="dashboard-shell space-y-5">
        <div className="dashboard-title">
          <h1>Admin Dashboard</h1>
          <p>Welcome back, {profile?.full_name ?? "User"}</p>
        </div>
        <section className="dashboard-kpis">
          <Card className="dashboard-kpi" onClick={() => navigate("/employees")}><div className="dashboard-kpi__body"><p>Active Employees</p><strong>{stats?.activeEmployees ?? 0}</strong><span>View current details</span><div className="dashboard-kpi__icon"><Users /></div></div><div className="dashboard-kpi__footer">See Details <span>→</span></div></Card>
          <Card className="dashboard-kpi" onClick={() => navigate("/projects")}><div className="dashboard-kpi__body"><p>Active Projects</p><strong>{stats?.activeProjects ?? 0}</strong><span>View current details</span><div className="dashboard-kpi__icon"><FolderKanban /></div></div><div className="dashboard-kpi__footer">See Details <span>→</span></div></Card>
          <Card className="dashboard-kpi" onClick={() => navigate("/attendance")}><div className="dashboard-kpi__body"><p>Today's Attendance</p><strong>{stats?.todayClockedIn ?? 0}/{stats?.activeEmployees ?? 0}</strong><span>View current details</span><div className="dashboard-kpi__icon"><Clock /></div></div><div className="dashboard-kpi__footer">See Details <span>→</span></div></Card>
          <Card className="dashboard-kpi" onClick={() => navigate("/leave/requests")}><div className="dashboard-kpi__body"><p>Pending Leave</p><strong>{stats?.pendingLeaves ?? 0}</strong><span>View current details</span><div className="dashboard-kpi__icon"><Calendar /></div></div><div className="dashboard-kpi__footer">See Details <span>→</span></div></Card>
        </section>
        <section className="dashboard-grid dashboard-grid--score">
          <Card className="dashboard-card dashboard-score-card"><h2>Attendance Score <span>ⓘ</span></h2><div className="score-gauge" style={{ "--score": `${attendanceScore * 1.8}deg` } as React.CSSProperties}><div><strong>{attendanceScore}</strong><span>of 100 points</span></div></div><div className="score-message"><strong>{attendanceScore >= 80 ? "Great attendance this week ✓" : "Attendance needs attention"}</strong><p>{stats?.todayClockedIn ?? 0} team member{(stats?.todayClockedIn ?? 0) === 1 ? " is" : "s are"} clocked in today.</p></div><button className="dashboard-text-action" onClick={() => navigate("/attendance")}>View Attendance <span>→</span></button></Card>
          <Card className="dashboard-card dashboard-trend-card"><div className="trend-header"><h2>Attendance Trend <span>ⓘ</span></h2><div className="trend-controls"><span><Filter /> Filter</span><span>This Year <ChevronDown /></span></div></div><div className="trend-scale"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0</span></div><div className="attendance-bars">{attendanceMonths.map((month) => { const isCurrent = month.key === format(new Date(), "yyyy-MM"); return <div key={month.key} className={isCurrent ? "is-current" : ""}>{isCurrent && <div className="attendance-tooltip"><strong>{format(new Date(`${month.key}-01T00:00:00`), "MMM, yyyy")}</strong><span>Attendance <b>{month.value}%</b></span></div>}<i style={{ height: `${Math.max(10, month.value)}%` }} /><span>{month.label}</span></div>; })}</div></Card>
        </section>
        <section className="dashboard-grid dashboard-grid--activity">
          <Card className="dashboard-card dashboard-activity-card"><div className="card-heading"><h2>Daily Logs Activity</h2><span className="activity-legend">Low <i /><i /><i /><i /> High</span></div><div className="heatmap"><div /><div className="heatmap-days">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>{logActivity.map((row) => <div className="heatmap-row" key={row[0].label}><span>{row[0].label}</span>{row.map((cell) => <i key={cell.day} style={{ opacity: 0.15 + (cell.count / maxLogActivity) * 0.85 }} />)}</div>)}</div></Card>
          <Card className="dashboard-card dashboard-workforce-card"><h2>Workforce Split <span>ⓘ</span></h2><strong className="workforce-total">{workforce.total}</strong><p>Total clocked-in employees</p><div className="workforce-donut" style={{ background: `conic-gradient(#EB5A1E 0 ${(workforce.onsite / Math.max(1, workforce.total)) * 100}%, #F6D1B2 ${(workforce.onsite / Math.max(1, workforce.total)) * 100}% 100%)` }}><i /></div><div className="workforce-legend"><span><i className="onsite" />On-site <strong>{workforce.onsite}</strong></span><span><i className="remote" />Remote <strong>{workforce.remote}</strong></span></div></Card>
        </section>
        <Card className="dashboard-card dashboard-recent"><div className="card-heading"><h2>Recent Activity</h2><button onClick={() => navigate("/audit")}>View All →</button></div>{!recentAudit?.length ? <p className="empty-activity">No recent activity</p> : recentAudit.map((activity: any) => <div className="activity-row" key={activity.id}><span className="activity-avatar">{getInitials(activity.users?.full_name || "System")}</span><p><strong>{activity.users?.full_name || "System"}</strong> {activity.action.replace(/\./g, " → ")}</p><time>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</time></div>)}</Card>
        <div className="hidden grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/projects")}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-50"><FolderKanban className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-sm text-muted-foreground">Projects</p><p className="text-2xl font-bold">—</p></div>
            </div>
          </Card>
          <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/announcements")}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-50"><FileText className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-sm text-muted-foreground">Announcements</p><p className="text-2xl font-bold">—</p></div>
            </div>
          </Card>
          <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/profile")}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-50"><Users className="h-5 w-5 text-purple-600" /></div>
              <div><p className="text-sm text-muted-foreground">Profile</p><p className="text-2xl font-bold">—</p></div>
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
        <p className="text-muted-foreground mt-1">Welcome back, {profile?.full_name ?? "User"}</p>
      </div>

      {urgentAnnouncements && urgentAnnouncements.length > 0 && (
        <div className="space-y-2">
          {urgentAnnouncements.map((a) => (
            <div key={a.id} className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-red-800">{a.title}</p>
                <p className="text-xs text-red-600 mt-0.5 line-clamp-1">{a.body.replace(/<[^>]*>/g, "")}</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => dismissAnnouncement(a.id)}>Dismiss</Button>
            </div>
          ))}
        </div>
      )}
 
      {visibleProjectNotifications && visibleProjectNotifications.length > 0 && (
        <div className="bg-black border border-black/10 rounded-xl p-5 flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top duration-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-full">
              <FolderKanban className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-tight">New Project Assignment</p>
              <p className="text-xs text-white/70 mt-0.5">
                You've been added to: <span className="font-bold text-white uppercase tracking-wider">{visibleProjectNotifications.map((p: any) => p.projects?.name).join(", ")}</span>
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-button bg-white text-black hover:bg-white/90 border-none font-bold px-6 shadow-sm" onClick={dismissProjectNotification}>
            <CheckCircle className="h-4 w-4 mr-2" /> Got it
          </Button>
        </div>
      )}

      {visibleRequestNotifications && visibleRequestNotifications.length > 0 && (
        <div className="bg-black border border-black/10 rounded-xl p-5 flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top duration-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-full">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-tight">Request Update</p>
              <div className="text-xs text-white/70 mt-0.5 space-y-0.5">
                {visibleRequestNotifications.map((n, idx) => {
                  if (n.type === "leave") {
                    const l = n.data;
                    const typeName = l.leave_types?.name || "Leave";
                    const dates = l.start_date === l.end_date 
                      ? format(new Date(l.start_date + "T00:00:00"), "MMM d, yyyy")
                      : `${format(new Date(l.start_date + "T00:00:00"), "MMM d")} - ${format(new Date(l.end_date + "T00:00:00"), "MMM d, yyyy")}`;
                    
                    return (
                      <p key={idx}>
                        <span className={`font-bold uppercase tracking-wider ${l.status === 'approved' ? 'text-green-400' : 'text-red-400'}`}>
                          {l.status}
                        </span>
                        : {typeName} for <span className="font-bold text-white tracking-wider">{dates}</span> {l.hours ? `(${l.hours} hrs)` : ""}
                      </p>
                    );
                  } else {
                    const w = n.data;
                    const date = w.start_date === w.end_date
                      ? format(new Date(w.start_date + "T00:00:00"), "MMM d, yyyy")
                      : `${format(new Date(w.start_date + "T00:00:00"), "MMM d")} - ${format(new Date(w.end_date + "T00:00:00"), "MMM d, yyyy")}`;
                    return (
                      <p key={idx}>
                        <span className={`font-bold uppercase tracking-wider ${w.status === 'approved' ? 'text-green-400' : 'text-red-400'}`}>
                          {w.status}
                        </span>
                        : Work From Home for <span className="font-bold text-white tracking-wider">{date}</span>
                      </p>
                    );
                  }
                })}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-button bg-white text-black hover:bg-white/90 border-none font-bold px-6 shadow-sm" onClick={dismissRequestNotifications}>
            <CheckCircle className="h-4 w-4 mr-2" /> Got it
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <Clock className={`h-5 w-5 ${isClockedIn ? "text-green-600" : "text-muted-foreground"}`} />
            <span className="text-sm font-medium">Attendance</span>
          </div>
          {isClockedIn ? (
            <>
              <p className="text-sm">Clocked in since <strong>{format(new Date(todayRecord!.clock_in!), "h:mm a")}</strong> ({todayRecord!.work_mode})</p>
              {todayRecord?.clock_in && isAttendanceLate(todayRecord.clock_in, shiftStart, graceMinutes, workingDays).isLate && (
                <p className="text-xs text-yellow-700 mt-1">⚠️ Late by {formatLateness(isAttendanceLate(todayRecord.clock_in, shiftStart, graceMinutes, workingDays).minutesLate)}.</p>
              )}
            </>
          ) : hasClockedOut ? (
            <div className="space-y-1">
              <p className="text-sm text-green-700 font-medium">Clocked Out</p>
              {todayDurationSeconds > 0 && (
                <p className="text-xs text-muted-foreground">Worked {formatDuration(todayDurationSeconds)} today</p>
              )}
            </div>
          ) : isWeekendDay ? (
            <p className="text-sm text-muted-foreground">Weekend (Off)</p>
          ) : (
            <p className="text-sm text-muted-foreground">Not clocked in</p>
          )}
          <Button size="sm" className="mt-3 rounded-button w-full" onClick={() => navigate("/attendance/my")}>
            {isClockedIn ? "View Session" : "Clock In"}
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <FileText className={`h-5 w-5 ${hasSubmittedLog ? "text-green-600" : "text-red-500"}`} />
            <span className="text-sm font-medium">Today's Log</span>
          </div>
          <p className="text-sm">
            {hasSubmittedLog ? (
              <span className="text-green-700">Submitted ({todayLogs!.length} {todayLogs!.length === 1 ? "entry" : "entries"})</span>
            ) : (profile?.created_at && today <= profile.created_at.split("T")[0]) ? (
              <span className="text-muted-foreground">Not yet started</span>
            ) : isWeekendDay ? (
              <span className="text-muted-foreground">Weekend (Off)</span>
            ) : (
              <span className="text-red-600">Not submitted yet</span>
            )}
          </p>
          <Button size="sm" variant={hasSubmittedLog ? "outline" : "default"} disabled={!hasSubmittedLog && isWeekendDay} className="mt-3 rounded-button w-full" onClick={() => navigate("/logs/submit")}>
            {hasSubmittedLog ? "Add Another" : "Submit Log"}
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Leave Balance</span>
          </div>
          <p className="text-sm"><strong>{annualRemaining}</strong> annual leave days remaining</p>
          <p className="text-xs text-muted-foreground">{usedLeaveDays} used / {annualLeaveEntitlement} total</p>
          {halfDayHours > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{halfDayHours} hour{halfDayHours !== 1 ? "s" : ""} of half day leave used this year</p>
          )}
          <Button size="sm" variant="outline" className="mt-3 rounded-button w-full" onClick={() => navigate("/leave/my")}>Apply Leave</Button>
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
                      {teamStatus?.filter((m: any) => !!m.attendance?.clock_in && !m.attendance?.clock_out).length || 0} active now
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </Card>
          </DialogTrigger>
          <DialogContent className="p-0">
            <DialogHeader className="p-4 pb-2 border-b">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-purple-600" />
                Team Status Today
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="divide-y">
                {!teamStatus || teamStatus.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No team members found.</div>
                ) : (
                  teamStatus.map((member: any) => {
                    const clockedIn = !!member.attendance?.clock_in;
                    const mode = member.attendance?.work_mode;
                    
                    return (
                      <div key={member.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border">
                            <AvatarImage src={getAvatarUrl(member.avatar_url)} />
                            <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold">{member.full_name}</p>
                            <p className="text-[11px] text-muted-foreground leading-tight">{member.designation || "Team Member"}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center">
                          {member.onLeave ? (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none flex items-center gap-1 text-[10px] font-medium">
                              <Calendar className="h-3 w-3" /> On Leave ({member.onLeave})
                            </Badge>
                          ) : !clockedIn ? (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] font-normal border-none">
                              Not Clocked In
                            </Badge>
                          ) : member.attendance.clock_out ? (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] font-normal border-none">
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
              <Card key={pm.project_id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/projects/${toSlug(pm.projects?.name || pm.project_id)}`)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{pm.projects?.name}</p>
                    <p className="text-xs text-muted-foreground">{pm.projects?.clients?.name || "No client"} · {pm.project_roles?.name || "Member"}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{pm.projects?.status}</Badge>
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
                  <RowSecondary>{format(new Date(log.log_date + "T00:00:00"), "MMM d, yyyy")} · {log.category.replace(/_/g, " ")}</RowSecondary>
                </div>
                <RowDataItem label="DATE">{format(new Date(log.log_date + "T00:00:00"), "MMM d, yyyy")}</RowDataItem>
                <RowDataItem label="HOURS">{log.hours}h</RowDataItem>
                <RowActions className="justify-self-end">
                  <button onClick={() => navigate("/logs/my")} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-xs font-medium text-[#6b7280]" title="View">View</button>
                </RowActions>
              </DataRow>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

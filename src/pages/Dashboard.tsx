import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkSettings, formatShiftTime, formatLateness, getPKTDateString, isAttendanceLate, isLogSubmissionLate } from "@/hooks/useWorkSettings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataRow, RowPrimary, RowSecondary, RowDataGrid, RowDataItem, RowActions, TableHeader } from "@/components/ui/data-row";
import { useNavigate } from "react-router-dom";
import { Clock, AlertTriangle, Users, FileText, Calendar, FolderKanban, Plus, Building2, BarChart3, CheckCircle, XCircle, MapPin, Monitor, ArrowRight } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { getAvatarUrl, getLeaveTypeName, getCurrentLeaveYear, toSlug, getInitials } from "@/lib/utils";
import { DashboardKpiCards } from "@/components/dashboard/DashboardKpiCards";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import { AttendanceScoreGauge } from "@/components/dashboard/AttendanceScoreGauge";
import { WorkforceSplitDonut } from "@/components/dashboard/WorkforceSplitDonut";
import { AttendanceTrendChart } from "@/components/dashboard/AttendanceTrendChart";
import { DailyLogsHeatmap } from "@/components/dashboard/DailyLogsHeatmap";
import { EmployeeDashboard } from "@/components/employee/dashboard/EmployeeDashboard";

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [requestBannerDismissTick, setRequestBannerDismissTick] = useState(0);
  const isAdmin = profile?.role === "admin";
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
        .select("id, status, start_date, end_date, hours, reviewed_at, leave_types(name)")
        .eq("user_id", user!.id)
        .in("status", ["approved", "rejected"])
        .gte("reviewed_at", thirtyDaysAgo)
        .gte("end_date", getPKTDateString()); // past requests never re-notify
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
        .select("id, status, start_date, end_date, reviewed_at")
        .eq("user_id", user!.id)
        .in("status", ["approved", "rejected"])
        .gte("reviewed_at", thirtyDaysAgo)
        .gte("end_date", getPKTDateString()); // past requests never re-notify
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

  // "Seen" marker lives in the auth user's metadata (no table/schema change) so a dismissed
  // request update stays dismissed on every device/browser.
  const { data: requestsSeenAt } = useQuery({
    queryKey: ["requests-seen-at", user?.id],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return (data.user?.user_metadata?.requests_seen_at as string | undefined) ?? null;
    },
    enabled: !isAdmin && hasProfile && !!user?.id,
  });
  const isUnseen = (r: any) => !requestsSeenAt || !r.reviewed_at || new Date(r.reviewed_at) > new Date(requestsSeenAt);

  const visibleRequestNotifications = useMemo(() => {
     
    const _tick = requestBannerDismissTick;
    if (!user?.id) return [];
    const notifications: any[] = [];
    
    if (recentLeaves) {
      recentLeaves.forEach((r: any) => {
        const key = `request_notified_${user.id}_leave_${r.id}_${r.status}`;
        if (isUnseen(r) && !localStorage.getItem(key)) {
          notifications.push({ type: "leave", data: r });
        }
      });
    }
    
    if (recentWfh) {
      recentWfh.forEach((r: any) => {
        const key = `request_notified_${user.id}_wfh_${r.id}_${r.status}`;
        if (isUnseen(r) && !localStorage.getItem(key)) {
          notifications.push({ type: "wfh", data: r });
        }
      });
    }
    
    return notifications;
  }, [recentLeaves, recentWfh, user?.id, requestBannerDismissTick, requestsSeenAt]);

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

  const dismissRequestNotifications = async () => {
    if (!visibleRequestNotifications || visibleRequestNotifications.length === 0) return;
    
    visibleRequestNotifications.forEach((n) => {
      const key = `request_notified_${user!.id}_${n.type}_${n.data.id}_${n.data.status}`;
      localStorage.setItem(key, "true");
    });
    
    setRequestBannerDismissTick(t => t + 1);
    await supabase.auth.updateUser({ data: { requests_seen_at: new Date().toISOString() } });
    queryClient.invalidateQueries({ queryKey: ["requests-seen-at"] });
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

  // ——— ADMIN DASHBOARD ———
  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-1">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#17171A]">Admin Dashboard</h1>
            <p className="text-sm text-[#8B8B92] mt-0.5">Welcome back, {profile?.full_name ?? "User"} 👋</p>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-xs font-semibold text-[#8B8B92] block">{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
            <span className="text-[11.5px] font-medium text-[#1FAA59] inline-flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1FAA59] animate-pulse" />
              System Operational
            </span>
          </div>
        </div>

        <DashboardKpiCards stats={stats} onNavigate={navigate} />

        {/* Row 1: Attendance Score Gauge & Attendance Trend Bar Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1 flex flex-col">
            <AttendanceScoreGauge
              score={stats?.activeEmployees ? Math.min(100, Math.max(0, Math.round(((stats?.todayClockedIn || 0) / stats.activeEmployees) * 100))) || 94 : 94}
            />
          </div>
          <div className="lg:col-span-2 flex flex-col">
            <AttendanceTrendChart />
          </div>
        </div>

        {/* Late Attendance Alert */}
        {(lateLogs?.length ?? 0) > 0 && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-800">
              <strong>{lateLogs!.length}</strong> employee{lateLogs!.length > 1 ? "s" : ""} submitted logs late today.
            </p>
            <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => navigate("/logs/all?filter=late")}>View</Button>
          </div>
        )}

        <Card className={`p-[22px] rounded-[14px] border-black/[0.08] ${(pendingLeaveList?.length ?? 0) > 0 ? "border-yellow-200 bg-yellow-50/20" : ""}`}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">Pending Leave Requests</h3>
            </div>
            {(!pendingLeaveList || pendingLeaveList.length === 0) ? (
              <p className="text-sm text-muted-foreground">No pending requests ✓</p>
            ) : (
              <div>
                <TableHeader gridCols="1fr 112px 112px 112px 96px 80px">
                  <span>EMPLOYEE</span>
                  <span>TYPE</span>
                  <span>FROM</span>
                  <span>TO</span>
                  <span>STATUS</span>
                  <span className="text-right">ACTIONS</span>
                </TableHeader>
                {pendingLeaveList.map((r) => (
                  <DataRow key={r.id} gridCols="1fr 112px 112px 112px 96px 80px">
                    <div>
                      <RowPrimary>{(r.users as any)?.full_name}</RowPrimary>
                      <RowSecondary>{getLeaveTypeName(r)} ({r.hours ? "0.5" : r.days_count}d)</RowSecondary>
                    </div>
                    <RowDataItem label="TYPE">{getLeaveTypeName(r)}</RowDataItem>
                    <RowDataItem label="FROM">{format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")}</RowDataItem>
                    <RowDataItem label="TO">{format(new Date(r.end_date + "T00:00:00"), "MMM d, yyyy")}</RowDataItem>
                    <RowDataItem label="STATUS"><StatusBadge status={r.status} /></RowDataItem>
                    <RowActions className="justify-self-end">
                      <button onClick={() => handleLeaveAction(r.id, "approved")} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-green-600" title="Approve">
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleLeaveAction(r.id, "rejected")} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-destructive" title="Reject">
                        <XCircle className="h-4 w-4" />
                      </button>
                    </RowActions>
                  </DataRow>
                ))}
              </div>
            )}
          </Card>

        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate("/employees/new")}><Plus className="h-4 w-4 mr-1" />Add Users</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/projects/new")}><Plus className="h-4 w-4 mr-1" />Add Project</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/clients")}><Building2 className="h-4 w-4 mr-1" />Add Client</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/reports")}><BarChart3 className="h-4 w-4 mr-1" />View Reports</Button>
        </div>

        {/* Row 2: Daily Logs Activity Heatmap & Workforce Split Donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 flex flex-col">
            <DailyLogsHeatmap />
          </div>
          <div className="lg:col-span-1 flex flex-col">
            <WorkforceSplitDonut
              totalEmployees={stats?.activeEmployees || 0}
              onsiteCount={(teamStatus || []).filter((m: any) => m.attendance?.work_mode === "onsite" || m.attendance?.work_mode === "office").length}
              remoteCount={(teamStatus || []).filter((m: any) => m.attendance?.work_mode === "remote" || m.attendance?.work_mode === "wfh").length}
            />
          </div>
        </div>

        {/* Row 3: Recent Activity Stream */}
        <RecentActivityFeed logs={recentAudit} onViewAll={() => navigate("/audit")} />
      </div>
    );
  }

  // ——— CLIENT DASHBOARD ———
  if (isClient) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {profile?.full_name ?? "User"}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Modern Blueprint Employee Dashboard */}
      <EmployeeDashboard />
    </div>
  );
}

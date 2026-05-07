import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkSettings, formatShiftTime, formatLateness, getPKTDateString } from "@/hooks/useWorkSettings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Clock, AlertTriangle, Users, FileText, Calendar, FolderKanban, Plus, Building2, BarChart3, CheckCircle, XCircle, MapPin, Monitor, ArrowRight } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow } from "date-fns";
import { getAvatarUrl } from "@/lib/utils";

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const hasProfile = !!profile?.id;
  const today = getPKTDateString();
  const isWeekendDay = new Date(today + "T00:00:00").getDay() === 0 || new Date(today + "T00:00:00").getDay() === 6;
  const { annualLeaveEntitlement, shiftStart } = useWorkSettings();

  // ——— Shared queries ———
  const { data: todayAttendance } = useQuery({
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
      const [activeEmployeesResult, todayAttendanceResult, pendingLeavesResult, activeProjectsResult, lateAttendanceResult] = await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }).eq("status", "active").lte("join_date", today),
        supabase.from("attendance").select("user_id").eq("date", today).not("clock_in", "is", null),
        supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("attendance").select("*", { count: "exact", head: true }).eq("date", today).eq("is_late", true),
      ]);
      return {
        activeEmployees: activeEmployeesResult.count || 0,
        todayClockedIn: todayAttendanceResult.data?.length || 0,
        pendingLeaves: pendingLeavesResult.count || 0,
        activeProjects: activeProjectsResult.count || 0,
        lateToday: lateAttendanceResult.count || 0,
      };
    },
    enabled: isAdmin && hasProfile,
    refetchInterval: 60000,
  });

  const { data: lateLogs } = useQuery({
    queryKey: ["dashboard-late-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_logs").select("*, users!daily_logs_user_id_fkey(full_name)").eq("log_date", today).eq("is_late", true).limit(10);
      if (error) throw error;
      return data || [];
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
      const { data, error } = await supabase.from("daily_logs").select("*, projects(name)").eq("user_id", user!.id).eq("log_date", today);
      if (error) throw error;
      return data || [];
    },
    enabled: !isAdmin && hasProfile && !!user?.id,
  });

  // Leave balance uses the hook's annualLeaveEntitlement (live from system_settings)
  const { data: usedLeaveDays = 0 } = useQuery({
    queryKey: ["my-used-leave-days", user?.id],
    queryFn: async () => {
      const year = new Date().getFullYear();
      const { data } = await supabase
        .from("leave_requests")
        .select("days_count")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .gte("start_date", `${year}-01-01`)
        .lte("start_date", `${year}-12-31`);
      return (data || []).reduce((sum, r) => sum + r.days_count, 0);
    },
    enabled: !isAdmin && hasProfile && !!user?.id,
  });

  const annualRemaining = annualLeaveEntitlement - usedLeaveDays;

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
      const { data, error } = await supabase.from("daily_logs").select("*, projects(name)").eq("user_id", user!.id).order("log_date", { ascending: false }).limit(5);
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

  const { data: teamStatus } = useQuery({
    queryKey: ["dashboard-team-today"],
    queryFn: async () => {
      const [{ data: users }, { data: attendance }] = await Promise.all([
        supabase.from("users").select("id, full_name, designation, avatar_url, role").neq("role", "admin").eq("status", "active"),
        supabase.from("attendance").select("user_id, work_mode, clock_in").eq("date", today)
      ]);
      
      const attendanceMap = (attendance || []).reduce((acc: any, curr) => {
        acc[curr.user_id] = curr;
        return acc;
      }, {});

      const team = (users || []).map(u => ({
        ...u,
        attendance: attendanceMap[u.id] || null
      }));

      return team.sort((a, b) => {
        const aClocked = !!a.attendance?.clock_in;
        const bClocked = !!b.attendance?.clock_in;
        if (aClocked && !bClocked) return -1;
        if (!aClocked && bClocked) return 1;
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
    if (!unnotifiedProjects || unnotifiedProjects.length === 0) return;
    const projectIds = unnotifiedProjects.map((p: any) => p.project_id);
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

  const handleLeaveAction = async (requestId: string, action: "approved" | "rejected") => {
    const { error } = await supabase.from("leave_requests").update({
      status: action,
      reviewed_by: user!.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", requestId);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["dashboard-pending-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    }
  };

  const isClockedIn = !!todayAttendance?.clock_in && !todayAttendance?.clock_out;
  const hasSubmittedLog = (todayLogs?.length || 0) > 0;

  // ——— ADMIN DASHBOARD ———
  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {profile?.full_name ?? "User"}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/employees")}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10"><Users className="h-5 w-5" /></div>
              <div><p className="text-sm text-muted-foreground">Active Employees</p><p className="text-2xl font-bold">{stats?.activeEmployees ?? "—"}</p></div>
            </div>
          </Card>
          <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/projects")}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-50"><FolderKanban className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-sm text-muted-foreground">Active Projects</p><p className="text-2xl font-bold">{stats?.activeProjects ?? "—"}</p></div>
            </div>
          </Card>
          <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/attendance")}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-50"><Clock className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-sm text-muted-foreground">Today's Attendance</p><p className="text-2xl font-bold">{stats?.todayClockedIn ?? 0} <span className="text-sm font-normal text-muted-foreground">/ {stats?.activeEmployees ?? 0}</span></p></div>
            </div>
          </Card>
          <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/leave/requests")}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-md ${(stats?.pendingLeaves ?? 0) > 0 ? "bg-yellow-50" : "bg-muted"}`}><Calendar className={`h-5 w-5 ${(stats?.pendingLeaves ?? 0) > 0 ? "text-yellow-600" : "text-muted-foreground"}`} /></div>
              <div><p className="text-sm text-muted-foreground">Pending Leave</p><p className="text-2xl font-bold">{stats?.pendingLeaves ?? "—"}</p></div>
            </div>
          </Card>
        </div>

        {/* Late Attendance Alert */}
        {(stats?.lateToday ?? 0) > 0 && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-800">
              <strong>{stats!.lateToday}</strong> employee{stats!.lateToday > 1 ? "s" : ""} clocked in late today.
            </p>
            <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => navigate("/attendance")}>View</Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className={`p-5 ${(lateLogs?.length ?? 0) > 0 ? "border-red-200 bg-red-50/30" : ""}`}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className={`h-4 w-4 ${(lateLogs?.length ?? 0) > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              <h3 className="font-medium text-sm">Late Logs Today</h3>
              {(lateLogs?.length ?? 0) > 0 && <Badge variant="destructive" className="ml-auto">{lateLogs!.length}</Badge>}
            </div>
            {(!lateLogs || lateLogs.length === 0) ? (
              <p className="text-sm text-muted-foreground">No late submissions today ✓</p>
            ) : (
              <div className="divide-y divide-black/30">
                {lateLogs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-sm py-2 first:pt-0 last:pb-0">
                    <span className="font-medium">{(l.users as any)?.full_name}</span>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-red-600" onClick={() => navigate("/logs/all?filter=late")}>View</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className={`p-5 ${(pendingLeaveList?.length ?? 0) > 0 ? "border-yellow-200 bg-yellow-50/30" : ""}`}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">Pending Leave Requests</h3>
            </div>
            {(!pendingLeaveList || pendingLeaveList.length === 0) ? (
              <p className="text-sm text-muted-foreground">No pending requests ✓</p>
            ) : (
              <div className="divide-y divide-border/100">
                {pendingLeaveList.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="text-sm">
                      <p className="font-medium">{(r.users as any)?.full_name}</p>
                      <p className="text-muted-foreground text-xs">{(r.leave_types as any)?.name} ({r.days_count}d)</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleLeaveAction(r.id, "approved")}>
                        <CheckCircle className="h-3 w-3 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleLeaveAction(r.id, "rejected")}>
                        <XCircle className="h-3 w-3 mr-1" />Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate("/employees/new")}><Plus className="h-4 w-4 mr-1" />Add Employee</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/projects/new")}><Plus className="h-4 w-4 mr-1" />Add Project</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/clients")}><Building2 className="h-4 w-4 mr-1" />Add Client</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/reports")}><BarChart3 className="h-4 w-4 mr-1" />View Reports</Button>
        </div>

        <Card className="p-5">
          <h3 className="font-medium text-sm mb-3">Recent Activity</h3>
          {(!recentAudit || recentAudit.length === 0) ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {recentAudit.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <span>
                    <span className="font-medium">{(a as any).users?.full_name || "System"}</span>
                    <span className="text-muted-foreground ml-1">{a.action.replace(/\./g, " → ")}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
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
 
      {unnotifiedProjects && unnotifiedProjects.length > 0 && (
        <div className="bg-black border border-black/10 rounded-xl p-5 flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top duration-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-full">
              <FolderKanban className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-tight">New Project Assignment</p>
              <p className="text-xs text-white/70 mt-0.5">
                You've been added to: <span className="font-bold text-white uppercase tracking-wider">{unnotifiedProjects.map((p: any) => p.projects?.name).join(", ")}</span>
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-button bg-white text-black hover:bg-white/90 border-none font-bold px-6 shadow-sm" onClick={dismissProjectNotification}>
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
              <p className="text-sm">Clocked in since <strong>{format(new Date(todayAttendance!.clock_in!), "h:mm a")}</strong></p>
              {(todayAttendance as any)?.is_late && (
                <p className="text-xs text-yellow-700 mt-1">⚠️ You're late by {formatLateness((todayAttendance as any)?.minutes_late)}. Your shift starts at {formatShiftTime(shiftStart)}.</p>
              )}
            </>
          ) : todayAttendance?.clock_out ? (
            <p className="text-sm text-muted-foreground">Completed today</p>
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
                      {teamStatus?.filter((m: any) => !!m.attendance?.clock_in).length || 0} active now
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-md p-0 overflow-hidden">
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
                          {!clockedIn ? (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] font-normal border-none">
                              Not Clocked In
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
              <Card key={pm.project_id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/projects/${pm.project_id}`)}>
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
          <Card>
            <div className="divide-y">
              {recentLogs.map((log: any) => (
                <div key={log.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{format(new Date(log.log_date + "T00:00:00"), "MMM d, yyyy")}</p>
                    <p className="text-xs text-muted-foreground">{log.projects?.name || "No project"} · {log.hours}h · {log.category}</p>
                  </div>
                  <Button variant="link" size="sm" className="text-xs text-black" onClick={() => navigate("/logs/my")}>View</Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

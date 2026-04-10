import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Clock, AlertTriangle, Users, FileText, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const today = new Date().toISOString().split("T")[0];

  // Today's attendance for employee
  const { data: todayAttendance } = useQuery({
    queryKey: ["dashboard-attendance", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("user_id", user!.id).eq("date", today).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Admin stats
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [
        { count: activeEmployees },
        { count: todayLogs },
        { count: pendingLeaves },
        { count: lateLogs },
      ] = await Promise.all([
        supabase.from("users").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("daily_logs").select("*", { count: "exact", head: true }).eq("log_date", today),
        supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("daily_logs").select("*", { count: "exact", head: true }).eq("log_date", today).eq("is_late", true),
      ]);
      return { activeEmployees: activeEmployees || 0, todayLogs: todayLogs || 0, pendingLeaves: pendingLeaves || 0, lateLogs: lateLogs || 0 };
    },
    enabled: isAdmin,
  });

  const isClockedIn = !!todayAttendance?.clock_in && !todayAttendance?.clock_out;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isAdmin ? "Admin Dashboard" : "My Dashboard"}
        </h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {profile?.full_name ?? "User"}
        </p>
      </div>

      {/* Quick Actions for Employee */}
      {!isAdmin && (
        <div className="flex gap-3">
          <Button onClick={() => navigate("/attendance/my")} className="rounded-button">
            <Clock className="h-4 w-4 mr-2" />
            {isClockedIn ? "View Active Session" : todayAttendance ? "View Attendance" : "Clock In"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/logs/submit")}>
            <FileText className="h-4 w-4 mr-2" />Submit Log
          </Button>
          <Button variant="outline" onClick={() => navigate("/leave/my")}>
            <Calendar className="h-4 w-4 mr-2" />Apply Leave
          </Button>
        </div>
      )}

      {/* Admin Stats */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/employees")}>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Active Employees</p>
                <p className="text-2xl font-bold">{stats?.activeEmployees ?? "—"}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/logs/all")}>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Today's Logs</p>
                <p className="text-2xl font-bold">{stats?.todayLogs ?? "—"}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/leave/requests")}>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Pending Leaves</p>
                <p className="text-2xl font-bold">{stats?.pendingLeaves ?? "—"}</p>
              </div>
            </div>
          </Card>
          {/* E4 - Late Log Alert */}
          <Card
            className={`p-5 cursor-pointer hover:shadow-md transition-shadow ${(stats?.lateLogs ?? 0) > 0 ? "border-yellow-300 bg-yellow-50/50" : ""}`}
            onClick={() => navigate("/logs/all?filter=late")}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-5 w-5 ${(stats?.lateLogs ?? 0) > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm text-muted-foreground">Late Logs Today</p>
                <p className="text-2xl font-bold">{stats?.lateLogs ?? "—"}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Employee attendance status */}
      {!isAdmin && todayAttendance && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Today's Attendance</p>
              <p className="text-xs text-muted-foreground">
                Clocked in at {format(new Date(todayAttendance.clock_in!), "h:mm a")}
                {todayAttendance.clock_out && ` — Out at ${format(new Date(todayAttendance.clock_out), "h:mm a")}`}
              </p>
            </div>
            <Badge className={isClockedIn ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
              {isClockedIn ? "Active" : "Completed"}
            </Badge>
          </div>
        </Card>
      )}
    </div>
  );
}

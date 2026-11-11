import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeDashboardData } from "@/hooks/useEmployeeDashboardData";
import { EmployeeDailyStrip } from "./EmployeeDailyStrip";
import { PersonalKpiCards } from "./PersonalKpiCards";
import { MyTasksKanbanWidget } from "./MyTasksKanbanWidget";
import { PersonalTimeBreakdownWidget } from "./PersonalTimeBreakdownWidget";
import { MyProjectsWidget } from "./MyProjectsWidget";
import { PersonalAppraisalSummaryModal } from "./PersonalAppraisalSummaryModal";
import { useNavigate } from "react-router-dom";
import { Sparkles, Calendar, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toSlug } from "@/lib/utils";

export function EmployeeDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const data = useEmployeeDashboardData();

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-10">
      {/* Employee Greeting & Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Welcome back, {profile?.full_name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your personal command center for daily logging, shift hygiene, and sprint focus.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <PersonalAppraisalSummaryModal
            profile={profile}
            monthUtilizationPct={data.monthUtilizationPct}
            monthLoggedHours={data.monthLoggedHours}
            netMonthCapacity={data.netMonthCapacity}
            attendanceRate={data.attendanceRate}
            punctualityRate={data.punctualityRate}
            completedTasksCount={data.myTasks.filter((t: any) => t.workflow_statuses?.category === "done").length}
            onTimeDeliveryRate={data.onTimeDeliveryRate}
            estimateAccuracy={data.estimateAccuracy}
            projectsCount={data.myProjects.length}
          />

          <Button
            size="sm"
            className="h-8 text-xs font-semibold px-3 bg-[#EB5A1E] hover:bg-[#EB5A1E]/90 text-white"
            onClick={() => navigate("/logs/submit")}
          >
            <FileText className="h-3.5 w-3.5 mr-1" /> Log Work
          </Button>
        </div>
      </div>

      {/* 1. Daily Action Strip */}
      <EmployeeDailyStrip
        todayAttendance={data.todayAttendance}
        loadingAttendance={data.loadingAttendance}
        todayStandup={data.todayStandup}
        todaySubmittedHours={data.todaySubmittedHours}
        todayDraftCount={data.todayDraftCount}
        shiftHours={data.shiftHours}
        shiftStart={data.shiftStart}
        shiftEnd={data.shiftEnd}
        unacknowledgedAutoClockout={data.unacknowledgedAutoClockout}
        hasTeammates={data.hasTeammates}
        onStandupComplete={() => data.standupMutation.mutate()}
        isStandupPending={data.standupMutation.isPending}
        onAcknowledgeAutoClockout={(id) => data.acknowledgeAutoClockoutMutation.mutate(id)}
      />

      {/* 2. Personal KPI Cards (8 Cards) */}
      <PersonalKpiCards
        monthUtilizationPct={data.monthUtilizationPct}
        utilizationColors={data.utilizationColors}
        monthLoggedHours={data.monthLoggedHours}
        netMonthCapacity={data.netMonthCapacity}
        attendanceRate={data.attendanceRate}
        punctualityRate={data.punctualityRate}
        logStreak={data.logStreak}
        tasksDueCounts={data.tasksDueCounts}
        onTimeDeliveryRate={data.onTimeDeliveryRate}
        estimateAccuracy={data.estimateAccuracy}
        leaveBalances={data.leaveBalances}
        annualLeaveEntitlement={data.annualLeaveEntitlement}
        onNavigateToTasks={() => {
          const firstTask = data.myTasks[0];
          if (firstTask) {
            navigate(`/projects/${toSlug(firstTask.projects?.name || firstTask.project_id)}?tab=tasks`);
          } else {
            navigate("/projects");
          }
        }}
        onNavigateToLeave={() => navigate("/leave/my")}
      />

      {/* 3. Personal Tasks Kanban Board */}
      <MyTasksKanbanWidget tasks={data.myTasks} />

      {/* 4. Time Breakdown by Project and Category */}
      <PersonalTimeBreakdownWidget
        hoursByProject={data.hoursByProject}
        hoursByCategory={data.hoursByCategory}
      />

      {/* 5. Assigned Projects */}
      <MyProjectsWidget projects={data.myProjects} />
    </div>
  );
}

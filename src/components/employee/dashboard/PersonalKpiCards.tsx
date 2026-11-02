import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Clock,
  Flame,
  CheckCircle,
  Calendar,
  AlertTriangle,
  Scale,
  Compass,
} from "lucide-react";

export interface PersonalKpiCardsProps {
  monthUtilizationPct: number;
  utilizationColors: { bg: string; text: string; label: string };
  monthLoggedHours: number;
  netMonthCapacity: number;
  attendanceRate: number;
  punctualityRate: number;
  logStreak: number;
  tasksDueCounts: { dueToday: number; dueThisWeek: number; overdue: number };
  onTimeDeliveryRate: number;
  estimateAccuracy: number;
  leaveBalances: any[];
  annualLeaveEntitlement: number;
  onNavigateToTasks?: () => void;
  onNavigateToLeave?: () => void;
}

export function PersonalKpiCards({
  monthUtilizationPct,
  utilizationColors,
  monthLoggedHours,
  netMonthCapacity,
  attendanceRate,
  punctualityRate,
  logStreak,
  tasksDueCounts,
  onTimeDeliveryRate,
  estimateAccuracy,
  leaveBalances,
  annualLeaveEntitlement,
  onNavigateToTasks,
  onNavigateToLeave,
}: PersonalKpiCardsProps) {
  // Utilization ring calculation
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = Math.max(
    0,
    circumference - (circumference * Math.min(100, monthUtilizationPct)) / 100
  );

  // Leave balances total calculation
  const totalAllocated = leaveBalances.reduce((s, b) => s + (Number(b.allocated) || 0), 0) || annualLeaveEntitlement;
  const totalUsed = leaveBalances.reduce((s, b) => s + (Number(b.used) || 0), 0);
  const remainingLeave = Math.max(0, totalAllocated - totalUsed);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. My Utilization % */}
      <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span>My Utilization (Month)</span>
          <Compass className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <div className="flex items-center justify-between my-2">
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {monthUtilizationPct}%
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Target: 75% – 85%
            </div>
          </div>

          {/* Mini Donut Gauge */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg width="56" height="56" className="-rotate-90">
              <circle
                cx="28"
                cy="28"
                r={radius}
                className="stroke-black/5 dark:stroke-white/10"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="28"
                cy="28"
                r={radius}
                className={
                  monthUtilizationPct >= 75 && monthUtilizationPct <= 85
                    ? "stroke-emerald-500"
                    : monthUtilizationPct > 105
                    ? "stroke-red-500"
                    : monthUtilizationPct >= 50
                    ? "stroke-blue-500"
                    : "stroke-amber-500"
                }
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
          </div>
        </div>

        <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold border-none ${utilizationColors.bg} ${utilizationColors.text}`}
          >
            {utilizationColors.label}
          </Badge>
        </div>
      </Card>

      {/* 2. Hours Logged vs Expected */}
      <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span>Month Hours Paced</span>
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <div className="my-2">
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {monthLoggedHours}h{" "}
            <span className="text-xs text-muted-foreground font-normal">
              / {netMonthCapacity}h net
            </span>
          </div>
          <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className="bg-[#17171A] dark:bg-white h-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (monthLoggedHours / (netMonthCapacity || 1)) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] text-[11px] text-muted-foreground flex justify-between">
          <span>{Math.max(0, netMonthCapacity - monthLoggedHours)}h remaining</span>
          <span className="font-medium text-foreground">
            {netMonthCapacity > 0
              ? `${Math.round((monthLoggedHours / netMonthCapacity) * 100)}% paced`
              : "0%"}
          </span>
        </div>
      </Card>

      {/* 3. Attendance & Punctuality */}
      <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span>Attendance & Punctuality</span>
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <div className="grid grid-cols-2 gap-2 my-2">
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {attendanceRate}%
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Attendance
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-emerald-600">
              {punctualityRate}%
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              On-Time Rate
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] text-[11px] text-muted-foreground">
          {punctualityRate >= 90 ? "Excellent arrival hygiene" : "Watch out for late mornings"}
        </div>
      </Card>

      {/* 4. Log Streak */}
      <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span>Logging Streak</span>
          <Flame className="h-3.5 w-3.5 text-orange-500" />
        </div>

        <div className="flex items-baseline gap-2 my-2">
          <div className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
            {logStreak}
            <span className="text-sm font-semibold text-muted-foreground">
              {logStreak === 1 ? "day" : "consecutive days"}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] text-[11px] text-muted-foreground flex items-center justify-between">
          <span>Daily log discipline</span>
          <span className="text-orange-600 font-semibold flex items-center gap-1">
            🔥 {logStreak > 5 ? "On Fire" : "Keep going"}
          </span>
        </div>
      </Card>

      {/* 5. Tasks Due */}
      <Card
        className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer hover:border-black/20 dark:hover:border-white/20"
        onClick={onNavigateToTasks}
      >
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span>Tasks Due Radar</span>
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        </div>

        <div className="flex items-center justify-between my-2">
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {tasksDueCounts.dueToday}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Due Today
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold text-muted-foreground">
              {tasksDueCounts.dueThisWeek} this wk
            </div>
            {tasksDueCounts.overdue > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5 font-bold">
                {tasksDueCounts.overdue} Overdue
              </Badge>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] text-[11px] text-muted-foreground flex justify-between items-center">
          <span>Click to open tasks</span>
          <span className="text-foreground font-semibold">View →</span>
        </div>
      </Card>

      {/* 6. On-Time Delivery % */}
      <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span>On-Time Delivery</span>
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
        </div>

        <div className="my-2">
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {onTimeDeliveryRate}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Tasks completed by due date (30d)
          </div>
        </div>

        <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] text-[11px] text-muted-foreground">
          {onTimeDeliveryRate >= 85 ? "High delivery predictability" : "Sprint deadlines slipping"}
        </div>
      </Card>

      {/* 7. Estimate Accuracy Ratio */}
      <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span>Estimate Accuracy</span>
          <Scale className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <div className="my-2">
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {estimateAccuracy}x
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Logged / Estimated (1.0 = Ideal)
          </div>
        </div>

        <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] text-[11px] text-muted-foreground">
          {estimateAccuracy <= 1.1 && estimateAccuracy >= 0.9
            ? "Spot-on estimations"
            : estimateAccuracy > 1.2
            ? "Tendency to overrun"
            : "Tasks padded / quick"}
        </div>
      </Card>

      {/* 8. Leave Balances */}
      <Card
        className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer hover:border-black/20 dark:hover:border-white/20"
        onClick={onNavigateToLeave}
      >
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span>Leave Entitlement</span>
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <div className="my-2">
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {remainingLeave} <span className="text-sm font-normal text-muted-foreground">days left</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {totalUsed} of {totalAllocated} days used this year
          </div>
        </div>

        <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] text-[11px] text-muted-foreground flex justify-between items-center">
          <span>Annual balance</span>
          <span className="text-foreground font-semibold">Apply →</span>
        </div>
      </Card>
    </div>
  );
}

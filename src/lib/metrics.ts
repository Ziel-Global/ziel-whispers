/**
 * Workforce Analytics and KPI Blueprint — Centralized Metric Engine
 * Single Source of Truth for all organizational telemetry and analytics.
 * Reference: Blueprint Section 1.4 (Metric Dictionary)
 */

import {
  differenceInCalendarDays,
  differenceInHours,
  eachDayOfInterval,
  format,
  isAfter,
  isBefore,
  max as maxDate,
  parseISO,
} from "date-fns";

export interface DateRange {
  start: string | Date;
  end: string | Date;
}

export interface WorkingDaysOptions {
  workingDaysPerWeek?: number; // 5 or 6 (default 5)
  holidays?: (string | Date)[]; // Holiday dates
  joinDate?: string | Date | null; // Filter prior to join date
}

/**
 * 1. Working Days in Period
 * Calendar days in range, minus weekends (5 or 6 day schedule),
 * minus company holidays, counted only from join_date onward.
 */
export function calculateWorkingDaysInPeriod(
  range: DateRange,
  options: WorkingDaysOptions = {}
): number {
  const { workingDaysPerWeek = 5, holidays = [], joinDate } = options;

  const startDate = typeof range.start === "string" ? parseISO(range.start) : range.start;
  const endDate = typeof range.end === "string" ? parseISO(range.end) : range.end;

  if (isAfter(startDate, endDate)) return 0;

  // Clip start date to joinDate if joined after period start
  let effectiveStart = startDate;
  if (joinDate) {
    const parsedJoin = typeof joinDate === "string" ? parseISO(joinDate) : joinDate;
    if (isAfter(parsedJoin, effectiveStart)) {
      effectiveStart = parsedJoin;
    }
  }

  if (isAfter(effectiveStart, endDate)) return 0;

  // Normalized holiday set in YYYY-MM-DD
  const holidaySet = new Set(
    holidays.map((h) => (typeof h === "string" ? h.slice(0, 10) : format(h, "yyyy-MM-dd")))
  );

  const days = eachDayOfInterval({ start: effectiveStart, end: endDate });

  return days.filter((d) => {
    const dayOfWeek = d.getDay();
    // Sunday is always off (0)
    if (dayOfWeek === 0) return false;
    // Saturday is off if 5-day worker (6)
    if (dayOfWeek === 6 && workingDaysPerWeek === 5) return false;

    // Check holiday match
    const dateStr = format(d, "yyyy-MM-dd");
    if (holidaySet.has(dateStr)) return false;

    return true;
  }).length;
}

/**
 * 2. Shift Hours per Day
 * shift_end minus shift_start minus break_minutes (default 60m),
 * falling back to 8 hours standard.
 */
export function calculateShiftHoursPerDay(
  shiftStart: string = "09:30",
  shiftEnd: string = "18:30",
  breakMinutes: number = 60
): number {
  try {
    const [startH, startM] = shiftStart.split(":").map(Number);
    const [endH, endM] = shiftEnd.split(":").map(Number);

    if (
      isNaN(startH) ||
      isNaN(startM) ||
      isNaN(endH) ||
      isNaN(endM) ||
      startH < 0 ||
      endH < 0
    ) {
      return 8;
    }

    const totalStartMinutes = startH * 60 + startM;
    const totalEndMinutes = endH * 60 + endM;

    let spanMinutes = totalEndMinutes - totalStartMinutes;
    // Support overnight shifts
    if (spanMinutes < 0) {
      spanMinutes += 24 * 60;
    }

    const netMinutes = Math.max(0, spanMinutes - breakMinutes);
    const hours = Math.round((netMinutes / 60) * 100) / 100;
    return hours > 0 ? hours : 8;
  } catch {
    return 8;
  }
}

/**
 * 3. Gross Capacity (Hours)
 * Working days in period * Shift hours per day
 */
export function calculateGrossCapacity(
  workingDays: number,
  shiftHoursPerDay: number = 8
): number {
  if (workingDays <= 0 || shiftHoursPerDay <= 0) return 0;
  return Math.round(workingDays * shiftHoursPerDay * 100) / 100;
}

/**
 * 4. Leave Hours
 * Approved leave days * shift hours, plus half-day/hourly leave hours.
 */
export function calculateLeaveHours(
  leaveDays: number,
  hourlyLeaveHours: number = 0,
  shiftHoursPerDay: number = 8
): number {
  const fullDayHours = Math.max(0, leaveDays) * Math.max(0, shiftHoursPerDay);
  return Math.round((fullDayHours + Math.max(0, hourlyLeaveHours)) * 100) / 100;
}

/**
 * 5. Net Capacity (Hours)
 * Gross capacity minus Leave hours (clipped at 0).
 */
export function calculateNetCapacity(
  grossCapacityHours: number,
  leaveHours: number
): number {
  return Math.max(0, Math.round((grossCapacityHours - leaveHours) * 100) / 100);
}

/**
 * 6. Utilization %
 * Logged hours divided by Net capacity * 100.
 */
export function calculateUtilizationPercentage(
  loggedHours: number,
  netCapacityHours: number
): number {
  if (netCapacityHours <= 0) return 0;
  return Math.round((loggedHours / netCapacityHours) * 1000) / 10;
}

/**
 * 7. Billable Utilization %
 * Logged hours on billable projects divided by Net capacity * 100.
 */
export function calculateBillableUtilizationPercentage(
  billableLoggedHours: number,
  netCapacityHours: number
): number {
  if (netCapacityHours <= 0) return 0;
  return Math.round((billableLoggedHours / netCapacityHours) * 1000) / 10;
}

/**
 * 8. Allocation %
 * Sum of project_members.allocation_percentage for active memberships.
 */
export function calculateAllocationPercentage(
  allocations: { allocation_percentage?: number | null; removed_at?: string | null }[]
): number {
  return allocations
    .filter((a) => !a.removed_at)
    .reduce((sum, a) => sum + (Number(a.allocation_percentage) || 0), 0);
}

/**
 * 9. Allocation Gap
 * Allocation % minus Utilization %.
 * Positive = Planned but idle / unlogged.
 * Negative = Working beyond plan.
 */
export function calculateAllocationGap(
  allocationPct: number,
  utilizationPct: number
): number {
  return Math.round((allocationPct - utilizationPct) * 10) / 10;
}

/**
 * 10. Attendance Rate %
 * Days with clock_in not null divided by expected working days * 100.
 */
export function calculateAttendanceRate(
  clockedInDays: number,
  expectedWorkingDays: number
): number {
  if (expectedWorkingDays <= 0) return 0;
  return Math.min(100, Math.round((clockedInDays / expectedWorkingDays) * 1000) / 10);
}

/**
 * 11. Punctuality Rate %
 * Attendance days where is_late is false divided by total attendance days * 100.
 */
export function calculatePunctualityRate(
  onTimeAttendanceDays: number,
  totalAttendanceDays: number
): number {
  if (totalAttendanceDays <= 0) return 0;
  return Math.min(100, Math.round((onTimeAttendanceDays / totalAttendanceDays) * 1000) / 10);
}

/**
 * 12. Log Compliance %
 * Working days with a submitted log divided by expected working days (excluding excused).
 */
export function calculateLogComplianceRate(
  daysWithSubmittedLog: number,
  expectedWorkingDays: number,
  excusedMissedDays: number = 0
): number {
  const denominator = Math.max(0, expectedWorkingDays - excusedMissedDays);
  if (denominator <= 0) return 100;
  return Math.min(100, Math.round((daysWithSubmittedLog / denominator) * 1000) / 10);
}

/**
 * 13. On-Time Log Rate %
 * Logs where submitted_at falls on or before the end of log_date + 1 day, divided by all logs.
 */
export function calculateOnTimeLogRate(
  onTimeLogsCount: number,
  totalLogsCount: number
): number {
  if (totalLogsCount <= 0) return 0;
  return Math.min(100, Math.round((onTimeLogsCount / totalLogsCount) * 1000) / 10);
}

/**
 * 14. Cycle Time (Hours)
 * Hours from first in_progress category status to first done category status.
 */
export function calculateCycleTimeHours(
  startedAt: string | Date | null | undefined,
  completedAt: string | Date | null | undefined
): number | null {
  if (!startedAt || !completedAt) return null;
  const start = typeof startedAt === "string" ? parseISO(startedAt) : startedAt;
  const done = typeof completedAt === "string" ? parseISO(completedAt) : completedAt;
  const hours = differenceInHours(done, start);
  return Math.max(0, hours);
}

/**
 * 15. Lead Time (Hours)
 * Hours from tasks.created_at to first done.
 */
export function calculateLeadTimeHours(
  createdAt: string | Date | null | undefined,
  completedAt: string | Date | null | undefined
): number | null {
  if (!createdAt || !completedAt) return null;
  const start = typeof createdAt === "string" ? parseISO(createdAt) : createdAt;
  const done = typeof completedAt === "string" ? parseISO(completedAt) : completedAt;
  const hours = differenceInHours(done, start);
  return Math.max(0, hours);
}

/**
 * 16. Estimate Accuracy
 * logged_hours divided by estimated_hours on completed tasks.
 * 1.0 is perfect; above 1.2 is overrun; below 0.8 is padding.
 */
export function calculateEstimateAccuracy(
  loggedHours: number,
  estimatedHours: number | null | undefined
): number | null {
  if (!estimatedHours || estimatedHours <= 0) return null;
  return Math.round((loggedHours / estimatedHours) * 100) / 100;
}

/**
 * 17. On-Time Delivery %
 * Tasks completed on or before due_date divided by tasks completed in period * 100.
 */
export function calculateOnTimeDeliveryRate(
  completedOnTimeCount: number,
  totalCompletedCount: number
): number {
  if (totalCompletedCount <= 0) return 0;
  return Math.min(100, Math.round((completedOnTimeCount / totalCompletedCount) * 1000) / 10);
}

/**
 * 18. Project Burn %
 * Project logged hours divided by projects.budget_hours * 100.
 */
export function calculateProjectBurnPercentage(
  loggedHours: number,
  budgetHours: number | null | undefined
): number | null {
  if (!budgetHours || budgetHours <= 0) return null;
  return Math.round((loggedHours / budgetHours) * 1000) / 10;
}

/**
 * 19. Schedule Variance
 * Burn % minus Planned progress % (elapsed time between start_date and end_date).
 * Positive = burning hours faster than calendar progress (at risk).
 */
export function calculateScheduleVariance(
  burnPct: number,
  startDate: string | Date,
  endDate: string | Date,
  referenceDate: string | Date = new Date()
): number {
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate;
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate;
  const ref = typeof referenceDate === "string" ? parseISO(referenceDate) : referenceDate;

  const totalDays = Math.max(1, differenceInCalendarDays(end, start));
  const elapsedDays = Math.min(totalDays, Math.max(0, differenceInCalendarDays(ref, start)));
  const plannedProgressPct = (elapsedDays / totalDays) * 100;

  return Math.round((burnPct - plannedProgressPct) * 10) / 10;
}

/**
 * 20. Blocker Age (Days)
 * Difference between now (or resolved_at) and blocker created_at.
 */
export function calculateBlockerAgeDays(
  createdAt: string | Date,
  resolvedAt?: string | Date | null,
  referenceDate: string | Date = new Date()
): number {
  const created = typeof createdAt === "string" ? parseISO(createdAt) : createdAt;
  const resolved = resolvedAt
    ? typeof resolvedAt === "string"
      ? parseISO(resolvedAt)
      : resolvedAt
    : typeof referenceDate === "string"
    ? parseISO(referenceDate)
    : referenceDate;

  return Math.max(0, differenceInCalendarDays(resolved, created));
}

/**
 * Utilization RAG Status Classifiers
 */
export type UtilizationBand = "low" | "watch" | "target" | "high" | "overload";

export function classifyUtilization(pct: number): UtilizationBand {
  if (pct < 50) return "low"; // Underutilized / Bench problem
  if (pct < 75) return "watch"; // Below target
  if (pct <= 85) return "target"; // Ideal 75-85%
  if (pct <= 105) return "high"; // Fully engaged
  return "overload"; // Over 105% burnout risk
}

export function getUtilizationRAGColor(band: UtilizationBand): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  switch (band) {
    case "target":
      return {
        bg: "bg-[#DFF6E4]",
        text: "text-[#1B8A46]",
        border: "border-[#1B8A46]/20",
        label: "On Target (75–85%)",
      };
    case "high":
      return {
        bg: "bg-[#EAF3FF]",
        text: "text-[#1C6FC9]",
        border: "border-[#1C6FC9]/20",
        label: "High Utilization (86–105%)",
      };
    case "watch":
      return {
        bg: "bg-[#FDF3E3]",
        text: "text-[#A9720B]",
        border: "border-[#A9720B]/20",
        label: "Watch (50–74%)",
      };
    case "low":
      return {
        bg: "bg-[#FDECEC]",
        text: "text-[#C23A3A]",
        border: "border-[#C23A3A]/20",
        label: "Underutilized (<50%)",
      };
    case "overload":
      return {
        bg: "bg-[#7F1D1D]/10",
        text: "text-[#B91C1C]",
        border: "border-[#B91C1C]/30",
        label: "Overload (>105%)",
      };
  }
}

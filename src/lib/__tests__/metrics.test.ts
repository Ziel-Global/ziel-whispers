import { describe, it, expect } from "vitest";
import {
  calculateWorkingDaysInPeriod,
  calculateShiftHoursPerDay,
  calculateGrossCapacity,
  calculateLeaveHours,
  calculateNetCapacity,
  calculateUtilizationPercentage,
  calculateBillableUtilizationPercentage,
  calculateAllocationPercentage,
  calculateAllocationGap,
  calculateAttendanceRate,
  calculatePunctualityRate,
  calculateLogComplianceRate,
  calculateOnTimeLogRate,
  calculateCycleTimeHours,
  calculateLeadTimeHours,
  calculateEstimateAccuracy,
  calculateOnTimeDeliveryRate,
  calculateProjectBurnPercentage,
  calculateScheduleVariance,
  calculateBlockerAgeDays,
  classifyUtilization,
  getUtilizationRAGColor,
} from "../metrics";

describe("Workforce Analytics - Centralized Metric Engine (Module 1)", () => {
  describe("1. calculateWorkingDaysInPeriod", () => {
    it("calculates working days in a standard Monday-Friday week", () => {
      // 2026-10-05 (Monday) to 2026-10-09 (Friday) = 5 days
      const days = calculateWorkingDaysInPeriod({
        start: "2026-10-05",
        end: "2026-10-09",
      });
      expect(days).toBe(5);
    });

    it("excludes Saturdays and Sundays on a 5-day week", () => {
      // 2026-10-05 (Mon) to 2026-10-11 (Sun) = 5 working days
      const days = calculateWorkingDaysInPeriod({
        start: "2026-10-05",
        end: "2026-10-11",
      });
      expect(days).toBe(5);
    });

    it("includes Saturdays for 6-day work weeks", () => {
      // Mon to Sat = 6 working days
      const days = calculateWorkingDaysInPeriod(
        { start: "2026-10-05", end: "2026-10-11" },
        { workingDaysPerWeek: 6 }
      );
      expect(days).toBe(6);
    });

    it("deducts company holidays that fall on a working day", () => {
      // Wed 2026-10-07 is a holiday
      const days = calculateWorkingDaysInPeriod(
        { start: "2026-10-05", end: "2026-10-09" },
        { holidays: ["2026-10-07"] }
      );
      expect(days).toBe(4);
    });

    it("clips start date to joinDate when employee joined after range start", () => {
      // Month starts on Oct 1, employee joins on Oct 7 (Wed)
      // Oct 7 (Wed), Oct 8 (Thu), Oct 9 (Fri) = 3 days
      const days = calculateWorkingDaysInPeriod(
        { start: "2026-10-01", end: "2026-10-09" },
        { joinDate: "2026-10-07" }
      );
      expect(days).toBe(3);
    });

    it("returns 0 if start date is after end date", () => {
      const days = calculateWorkingDaysInPeriod({
        start: "2026-10-15",
        end: "2026-10-10",
      });
      expect(days).toBe(0);
    });
  });

  describe("2. calculateShiftHoursPerDay", () => {
    it("computes net shift hours minus standard 60-min break", () => {
      // 09:30 to 18:30 = 9 hours - 1h break = 8 hours
      expect(calculateShiftHoursPerDay("09:30", "18:30", 60)).toBe(8);
    });

    it("handles custom shift with 30-min break", () => {
      // 10:00 to 18:00 = 8 hours - 30m break = 7.5 hours
      expect(calculateShiftHoursPerDay("10:00", "18:00", 30)).toBe(7.5);
    });

    it("falls back to 8 hours on invalid inputs", () => {
      expect(calculateShiftHoursPerDay("invalid", "invalid")).toBe(8);
    });
  });

  describe("3. Capacity & Utilization Calculations", () => {
    it("calculates gross capacity correctly", () => {
      expect(calculateGrossCapacity(20, 8)).toBe(160);
      expect(calculateGrossCapacity(0, 8)).toBe(0);
    });

    it("calculates leave hours combining full days and hourly leaves", () => {
      // 2 full days @ 8h = 16h + 4h hourly = 20h
      expect(calculateLeaveHours(2, 4, 8)).toBe(20);
    });

    it("calculates net capacity by deducting leave hours from gross capacity", () => {
      expect(calculateNetCapacity(160, 20)).toBe(140);
      // Net capacity never drops below 0
      expect(calculateNetCapacity(40, 50)).toBe(0);
    });

    it("calculates utilization percentage correctly", () => {
      // 112 logged / 140 net = 80.0%
      expect(calculateUtilizationPercentage(112, 140)).toBe(80);
      // Handles 0 net capacity gracefully without NaN or Infinity
      expect(calculateUtilizationPercentage(10, 0)).toBe(0);
    });

    it("calculates billable utilization percentage", () => {
      // 98 billable / 140 net = 70.0%
      expect(calculateBillableUtilizationPercentage(98, 140)).toBe(70);
    });

    it("calculates allocation percentage and allocation gap", () => {
      const memberships = [
        { allocation_percentage: 60, removed_at: null },
        { allocation_percentage: 40, removed_at: null },
        { allocation_percentage: 50, removed_at: "2026-10-01" }, // excluded
      ];
      expect(calculateAllocationPercentage(memberships)).toBe(100);

      // Allocation 100% vs Utilization 80% = +20% gap (idle/underutilized vs plan)
      expect(calculateAllocationGap(100, 80)).toBe(20);

      // Allocation 80% vs Utilization 95% = -15% gap (working beyond planned allocation)
      expect(calculateAllocationGap(80, 95)).toBe(-15);
    });
  });

  describe("4. Discipline & Attendance Metrics", () => {
    it("calculates attendance rate", () => {
      // 19 clocked in / 20 expected = 95.0%
      expect(calculateAttendanceRate(19, 20)).toBe(95);
      expect(calculateAttendanceRate(5, 0)).toBe(0);
    });

    it("calculates punctuality rate", () => {
      // 17 on-time / 19 present = 89.5%
      expect(calculatePunctualityRate(17, 19)).toBe(89.5);
    });

    it("calculates log compliance excluding excused days", () => {
      // 18 days logged / (20 expected - 1 excused) = 18 / 19 = 94.7%
      expect(calculateLogComplianceRate(18, 20, 1)).toBe(94.7);
    });

    it("calculates on-time log rate", () => {
      // 45 on time / 50 total = 90.0%
      expect(calculateOnTimeLogRate(45, 50)).toBe(90);
    });
  });

  describe("5. Delivery & Project Health Metrics", () => {
    it("calculates cycle time and lead time in hours", () => {
      const started = "2026-10-05T09:00:00Z";
      const completed = "2026-10-07T17:00:00Z";
      expect(calculateCycleTimeHours(started, completed)).toBe(56);
      expect(calculateCycleTimeHours(null, completed)).toBeNull();

      const created = "2026-10-01T09:00:00Z";
      expect(calculateLeadTimeHours(created, completed)).toBe(152);
    });

    it("calculates estimate accuracy", () => {
      expect(calculateEstimateAccuracy(8, 8)).toBe(1.0);
      expect(calculateEstimateAccuracy(12, 10)).toBe(1.2); // 20% overrun
      expect(calculateEstimateAccuracy(6, 8)).toBe(0.75); // under
      expect(calculateEstimateAccuracy(8, null)).toBeNull();
    });

    it("calculates on-time delivery rate", () => {
      expect(calculateOnTimeDeliveryRate(18, 20)).toBe(90);
      expect(calculateOnTimeDeliveryRate(0, 0)).toBe(0);
    });

    it("calculates project burn percentage", () => {
      // 75 logged / 100 budget = 75.0%
      expect(calculateProjectBurnPercentage(75, 100)).toBe(75);
      expect(calculateProjectBurnPercentage(75, 0)).toBeNull();
    });

    it("calculates schedule variance", () => {
      // Start: Oct 1, End: Oct 21 (20 days)
      // At Oct 11 (10 days = 50% elapsed)
      // If Burn is 65%, variance is +15.0% (spending hours faster than calendar progress)
      const variance = calculateScheduleVariance(
        65,
        "2026-10-01",
        "2026-10-21",
        "2026-10-11"
      );
      expect(variance).toBe(15);
    });

    it("calculates blocker age in days", () => {
      const age = calculateBlockerAgeDays("2026-10-01", "2026-10-06");
      expect(age).toBe(5);
    });
  });

  describe("6. Utilization RAG Classifier", () => {
    it("classifies utilization into appropriate RAG bands", () => {
      expect(classifyUtilization(45)).toBe("low");
      expect(classifyUtilization(65)).toBe("watch");
      expect(classifyUtilization(80)).toBe("target");
      expect(classifyUtilization(95)).toBe("high");
      expect(classifyUtilization(110)).toBe("overload");
    });

    it("returns consistent styling colors for each band", () => {
      const targetColors = getUtilizationRAGColor("target");
      expect(targetColors.bg).toBe("bg-[#DFF6E4]");
      expect(targetColors.text).toBe("text-[#1B8A46]");

      const overloadColors = getUtilizationRAGColor("overload");
      expect(overloadColors.text).toBe("text-[#B91C1C]");
    });
  });
});

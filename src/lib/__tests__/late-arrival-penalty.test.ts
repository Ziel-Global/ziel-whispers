import { describe, it, expect } from "vitest";

describe("Late Arrival Penalty Rules & Calculations", () => {
  const THRESHOLD_MINUTES = 540; // 9 hours

  function calculateLateMinutesForClockin(
    arrivalMinutesPastShift: number,
    gracePeriodMinutes: number = 15
  ): number {
    if (arrivalMinutesPastShift <= gracePeriodMinutes) {
      return 0; // within grace period -> 0 minutes
    }
    return arrivalMinutesPastShift; // past grace period -> full duration accumulated
  }

  function computePenalties(
    totalLateMinutes: number,
    availableLeaveDays: number
  ) {
    const earnedPenalties = Math.floor(totalLateMinutes / THRESHOLD_MINUTES);
    const targetPenalties = Math.min(earnedPenalties, Math.max(0, availableLeaveDays));
    const cycleMinutes = totalLateMinutes % THRESHOLD_MINUTES;
    const isCapped = availableLeaveDays === 0;

    return {
      earnedPenalties,
      targetPenalties,
      cycleMinutes,
      isCapped,
      remainingLeaves: Math.max(0, availableLeaveDays - targetPenalties),
    };
  }

  it("should not accumulate late minutes if arrival is within the 15-minute grace period", () => {
    expect(calculateLateMinutesForClockin(5, 15)).toBe(0);
    expect(calculateLateMinutesForClockin(10, 15)).toBe(0);
    expect(calculateLateMinutesForClockin(15, 15)).toBe(0);
  });

  it("should accumulate the full duration if arrival exceeds the grace period", () => {
    expect(calculateLateMinutesForClockin(20, 15)).toBe(20);
    expect(calculateLateMinutesForClockin(45, 15)).toBe(45);
    expect(calculateLateMinutesForClockin(120, 15)).toBe(120);
  });

  it("should trigger 1 day deduction exactly when 540 minutes (9 hours) is reached", () => {
    const result = computePenalties(540, 12);
    expect(result.earnedPenalties).toBe(1);
    expect(result.targetPenalties).toBe(1);
    expect(result.cycleMinutes).toBe(0);
    expect(result.remainingLeaves).toBe(11);
  });

  it("should carry over remaining minutes beyond 540 towards the next cycle", () => {
    const result = computePenalties(565, 12);
    expect(result.earnedPenalties).toBe(1);
    expect(result.targetPenalties).toBe(1);
    expect(result.cycleMinutes).toBe(25);
    expect(result.remainingLeaves).toBe(11);
  });

  it("should not deduct penalty if employee has 0 remaining leaves and cap deduction", () => {
    const result = computePenalties(1080, 0); // 2 full days worth of late minutes
    expect(result.earnedPenalties).toBe(2);
    expect(result.targetPenalties).toBe(0); // 0 deducted because available is 0
    expect(result.isCapped).toBe(true);
    expect(result.remainingLeaves).toBe(0);
  });

  it("should deduct only up to available leaves if available leaves is less than earned penalties", () => {
    const result = computePenalties(1080, 1); // 2 days earned, but only 1 day available
    expect(result.earnedPenalties).toBe(2);
    expect(result.targetPenalties).toBe(1);
    expect(result.remainingLeaves).toBe(0);
  });
});

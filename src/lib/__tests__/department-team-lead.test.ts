import { describe, it, expect } from "vitest";
import {
  calculateGrossCapacity,
  calculateNetCapacity,
  calculateUtilizationPercentage,
  classifyUtilization,
  calculateEstimateAccuracy,
  calculateOnTimeDeliveryRate,
} from "../metrics";

describe("Module 7: Middle Management & Team Lead Logic", () => {
  describe("Department Capacity & Allocation Matrix", () => {
    it("computes department gross and net capacity correctly", () => {
      // 5 engineers, 8h shift, 20 working days
      const individualGross = calculateGrossCapacity(20, 8);
      expect(individualGross).toBe(160);

      const deptGross = 5 * individualGross;
      expect(deptGross).toBe(800);

      // 40 hours of approved leaves
      const net = calculateNetCapacity(deptGross, 40);
      expect(net).toBe(760);

      // 684 hours logged across all projects
      const util = calculateUtilizationPercentage(684, net);
      expect(util).toBe(90);
      expect(classifyUtilization(util)).toBe("high");
    });

    it("detects overload burnout when member utilization exceeds 105%", () => {
      const netCap = 160;
      const loggedHours = 180;
      const util = calculateUtilizationPercentage(loggedHours, netCap);
      expect(util).toBe(112.5);
      expect(classifyUtilization(util)).toBe("overload");
    });

    it("detects watch status when member utilization is below 75%", () => {
      const netCap = 160;
      const loggedHours = 96;
      const util = calculateUtilizationPercentage(loggedHours, netCap);
      expect(util).toBe(60);
      expect(classifyUtilization(util)).toBe("watch");
    });
  });

  describe("Team Lead Operations & 1:1 Dossier Metrics", () => {
    it("evaluates yesterday log compliance rate accurately", () => {
      const totalMembers = 8;
      const submittedMembers = 7;
      const rate = Math.round((submittedMembers / totalMembers) * 100);
      expect(rate).toBe(88);
    });

    it("computes estimate accuracy ratio for delivered deliverables", () => {
      // Estimated 32h, Actual logged 30h
      const accuracy = calculateEstimateAccuracy(30, 32);
      expect(accuracy).toBe(0.94);
    });

    it("computes on-time delivery rate", () => {
      const completedOnTime = 9;
      const totalCompleted = 10;
      const rate = calculateOnTimeDeliveryRate(completedOnTime, totalCompleted);
      expect(rate).toBe(90);
    });
  });
});

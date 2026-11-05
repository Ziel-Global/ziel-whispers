import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateGrossProfit,
  calculateGrossMarginPercentage,
  classifyMarginBand,
  evaluateProjectFinancials,
} from "../financialEngine";
import { detectSpofSkills } from "../spofEngine";
import {
  loadKpiTargets,
  saveKpiTargets,
  resetKpiTargets,
  DEFAULT_KPI_TARGETS,
} from "../kpiTargetConfig";

describe("Module 10: Financials, Skills Staffing & Configurable Targets", () => {
  describe("Financial Engine & Margins", () => {
    it("computes project gross profit and margin % accurately", () => {
      const revenue = 12000;
      const laborCost = 6600;
      const profit = calculateGrossProfit(revenue, laborCost);
      expect(profit).toBe(5400);

      const marginPct = calculateGrossMarginPercentage(revenue, profit);
      expect(marginPct).toBe(45);
      expect(classifyMarginBand(marginPct)).toBe("healthy");
    });

    it("classifies watch and danger margin bands", () => {
      expect(classifyMarginBand(48)).toBe("healthy");
      expect(classifyMarginBand(38)).toBe("watch");
      expect(classifyMarginBand(22)).toBe("danger");
    });

    it("evaluates portfolio financials across multiple projects", () => {
      const projects = [
        { id: "p1", name: "Client A", is_billable: true },
        { id: "p2", name: "Internal System", is_billable: false },
      ];

      const dailyLogs = [
        { user_id: "u1", project_id: "p1", hours: 40 },
        { user_id: "u2", project_id: "p2", hours: 20 },
      ];

      const costRates = new Map([
        ["u1", 40], // $40/h * 40h = $1,600
        ["u2", 30], // $30/h * 20h = $600
      ]);

      const billRates = new Map([
        ["p1", 80], // $80/h * 40h = $3,200 revenue
      ]);

      const { projectFinancials, portfolioSummary } = evaluateProjectFinancials(
        projects as any,
        dailyLogs as any,
        costRates,
        billRates
      );

      expect(portfolioSummary.totalRevenue).toBe(3200);
      expect(portfolioSummary.totalLaborCost).toBe(2200);
      expect(portfolioSummary.totalGrossProfit).toBe(1000);
      expect(portfolioSummary.portfolioGrossMarginPct).toBe(31.3);
      expect(portfolioSummary.marginBand).toBe("watch");
    });
  });

  describe("Single Point of Failure (SPOF) Engine", () => {
    it("flags skills known by only 1 employee with proficiency >= 3", () => {
      const skills = [
        { id: "sk1", name: "PostgreSQL Database Architecture" },
        { id: "sk2", name: "React Frontend" },
      ];

      const users = [
        { id: "u1", full_name: "Alice", status: "active" },
        { id: "u2", full_name: "Bob", status: "active" },
        { id: "u3", full_name: "Charlie", status: "active" },
      ];

      const employeeSkills = [
        { user_id: "u1", skill_id: "sk1", proficiency_level: 4 }, // Only Alice has sk1 >= 3
        { user_id: "u1", skill_id: "sk2", proficiency_level: 4 },
        { user_id: "u2", skill_id: "sk2", proficiency_level: 3 }, // Alice and Bob have sk2 >= 3
      ];

      const alerts = detectSpofSkills(skills, employeeSkills, users);

      expect(alerts.length).toBe(1);
      expect(alerts[0].skillName).toBe("PostgreSQL Database Architecture");
      expect(alerts[0].soleExpertName).toBe("Alice");
      expect(alerts[0].recommendedCrossTrainUsers.length).toBeGreaterThan(0);
    });
  });

  describe("Configurable KPI Targets Engine", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("loads default targets if none configured", () => {
      const targets = loadKpiTargets();
      expect(targets.companyUtilizationMin).toBe(DEFAULT_KPI_TARGETS.companyUtilizationMin);
      expect(targets.onTimeDeliveryTarget).toBe(DEFAULT_KPI_TARGETS.onTimeDeliveryTarget);
    });

    it("persists and loads updated targets", () => {
      const custom = {
        ...DEFAULT_KPI_TARGETS,
        companyUtilizationMin: 80,
        grossMarginTarget: 55,
      };

      saveKpiTargets(custom);
      const loaded = loadKpiTargets();
      expect(loaded.companyUtilizationMin).toBe(80);
      expect(loaded.grossMarginTarget).toBe(55);
    });

    it("resets targets to SSoT blueprint defaults", () => {
      saveKpiTargets({ ...DEFAULT_KPI_TARGETS, companyUtilizationMin: 99 });
      const reset = resetKpiTargets();
      expect(reset.companyUtilizationMin).toBe(75);
    });
  });
});


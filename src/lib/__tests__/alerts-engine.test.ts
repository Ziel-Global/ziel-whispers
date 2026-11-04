import { describe, it, expect } from "vitest";
import {
  evaluateOverutilizationRule,
  evaluateUnderutilizationRule,
  evaluateMissingLogsRule,
  evaluateRepeatedLatenessRule,
  evaluateBudgetBurnRule,
  evaluateScheduleSlipRule,
  evaluateBlockerAgingRule,
  evaluateApprovalAgingRule,
  evaluateCapacityCrunchRule,
  ALERT_RULES_REGISTRY,
} from "../alerts/alertEngine";

describe("Module 8: Automated Alert Rules Engine (Blueprint S5.2)", () => {
  it("registers all 12 blueprint alert rules", () => {
    expect(ALERT_RULES_REGISTRY.length).toBe(12);
    const ruleIds = ALERT_RULES_REGISTRY.map((r) => r.id);
    expect(ruleIds).toContain("RULE_01_OVERUTILIZATION");
    expect(ruleIds).toContain("RULE_02_UNDERUTILIZATION");
    expect(ruleIds).toContain("RULE_03_MISSING_LOG");
    expect(ruleIds).toContain("RULE_04_REPEATED_LATENESS");
    expect(ruleIds).toContain("RULE_05_BUDGET_BURN");
    expect(ruleIds).toContain("RULE_06_SCHEDULE_SLIP");
    expect(ruleIds).toContain("RULE_07_BLOCKER_AGING");
    expect(ruleIds).toContain("RULE_08_TASK_IDLE");
    expect(ruleIds).toContain("RULE_09_APPROVAL_AGING");
    expect(ruleIds).toContain("RULE_10_CLIENT_INPUT_OVERDUE");
    expect(ruleIds).toContain("RULE_11_CAPACITY_CRUNCH");
    expect(ruleIds).toContain("RULE_12_SECURITY_SIGNAL");
  });

  it("Rule 1: triggers overutilization when employee util > 110%", () => {
    const users = [{ id: "u1", full_name: "Alice Engineer" }];
    const utilMap = new Map([["u1", 118]]);
    const alerts = evaluateOverutilizationRule(users, utilMap);

    expect(alerts.length).toBe(1);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].category).toBe("workforce");
    expect(alerts[0].metricValue).toBe("118%");
  });

  it("Rule 2: triggers underutilization when util < 50% and 0 leave hours", () => {
    const users = [{ id: "u2", full_name: "Bob Bench" }];
    const utilMap = new Map([["u2", 42]]);
    const leaveMap = new Map([["u2", 0]]);
    const alerts = evaluateUnderutilizationRule(users, utilMap, leaveMap);

    expect(alerts.length).toBe(1);
    expect(alerts[0].severity).toBe("warning");
    expect(alerts[0].category).toBe("workforce");
  });

  it("Rule 3: triggers missing log alert when member has not submitted yesterday", () => {
    const users = [
      { id: "u1", full_name: "Alice" },
      { id: "u2", full_name: "Bob" },
    ];
    const submitters = new Set(["u1"]);
    const alerts = evaluateMissingLogsRule(users, submitters, "2026-11-03");

    expect(alerts.length).toBe(1);
    expect(alerts[0].entityId).toBe("u2");
    expect(alerts[0].ruleId).toBe("RULE_03_MISSING_LOG");
  });

  it("Rule 4: triggers repeated lateness alert when >= 3 late incidents in 30 days", () => {
    const users = [{ id: "u1", full_name: "Charlie Late" }];
    const lateMap = new Map([["u1", 4]]);
    const alerts = evaluateRepeatedLatenessRule(users, lateMap);

    expect(alerts.length).toBe(1);
    expect(alerts[0].severity).toBe("warning");
    expect(alerts[0].metricValue).toBe("4 times");
  });

  it("Rule 5: triggers budget burn at 75% (warning) and 90% (critical)", () => {
    const projects = [
      { id: "p1", name: "Fintech Core", budget_hours: 100 },
      { id: "p2", name: "Health App", budget_hours: 100 },
      { id: "p3", name: "Internal System", budget_hours: 100 },
    ];
    const loggedMap = new Map([
      ["p1", 78], // 78% -> warning
      ["p2", 92], // 92% -> critical
      ["p3", 50], // 50% -> normal
    ]);

    const alerts = evaluateBudgetBurnRule(projects, loggedMap);
    expect(alerts.length).toBe(2);

    const warnAlert = alerts.find((a) => a.entityId === "p1");
    expect(warnAlert?.severity).toBe("warning");

    const critAlert = alerts.find((a) => a.entityId === "p2");
    expect(critAlert?.severity).toBe("critical");
  });

  it("Rule 6: triggers schedule slippage when project baseline end date is passed", () => {
    const projects = [
      {
        id: "p1",
        name: "ShopSmart",
        baseline_end_date: "2026-10-31",
        status: "active",
      },
    ];
    const alerts = evaluateScheduleSlipRule(projects, "2026-11-04");

    expect(alerts.length).toBe(1);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].ruleId).toBe("RULE_06_SCHEDULE_SLIP");
  });

  it("Rule 7: triggers blocker aging when task is flagged for >= 3 days", () => {
    const tasks = [
      {
        id: "t1",
        title: "Database Deadlock",
        is_flagged: true,
        created_at: "2026-10-31T09:00:00Z",
      },
    ];
    const now = new Date("2026-11-04T12:00:00Z");
    const alerts = evaluateBlockerAgingRule(tasks, now);

    expect(alerts.length).toBe(1);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].ruleId).toBe("RULE_07_BLOCKER_AGING");
  });

  it("Rule 9: triggers approval aging when leave is pending for >= 48 hours", () => {
    const leaves = [
      {
        id: "l1",
        user_id: "u1",
        created_at: "2026-11-01T09:00:00Z",
        status: "pending",
        users: { full_name: "Alice" },
      },
    ];
    const now = new Date("2026-11-04T12:00:00Z"); // 75h
    const alerts = evaluateApprovalAgingRule(leaves, now);

    expect(alerts.length).toBe(1);
    expect(alerts[0].severity).toBe("warning");
  });

  it("Rule 11: triggers department capacity crunch when allocations exceed capacity", () => {
    const depts = [
      { name: "Engineering", memberCount: 4, totalAllocationPct: 480 }, // 120% avg
    ];
    const alerts = evaluateCapacityCrunchRule(depts);

    expect(alerts.length).toBe(1);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].metricValue).toBe("120% FTE");
  });
});


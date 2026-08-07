import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestEnvironment, teardownTestEnvironment, TestContext } from "./setup/testContext";
import { STATUS_QA_REVIEW } from "./setup/constants";
import { dbQuery } from "./helpers/dbClient";
import { reporter } from "./helpers/reporter";

describe("Section 6: Double-Fire Check (Test 6.1)", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTestEnvironment();
  }, 90000);

  afterAll(async () => {
    if (context?.projectId) {
      await teardownTestEnvironment(context.projectId);
    }
  }, 90000);

  it("Test 6.1: Single Execution Verification (no double-fire)", async () => {
    const task = context.tasks["Validate session timeout modal popup"];
    expect(task).toBeDefined();

    // Record baseline rule run count
    const before = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${task.id}';`
    );
    const countBefore = parseInt(before[0]?.cnt ?? "0");

    // Move to QA Review — this fires trg_run_automation_on_status_change exactly once
    await dbQuery(`UPDATE tasks SET status_id = '${STATUS_QA_REVIEW}' WHERE id = '${task.id}';`);

    const after = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${task.id}';`
    );
    const countAfter = parseInt(after[0]?.cnt ?? "0");

    // The delta must be exactly 1 (or at most the number of matching rules) — NOT doubled
    const delta = countAfter - countBefore;

    // Should have fired at least once (status changed)
    expect(delta).toBeGreaterThanOrEqual(1);

    // Critical: no double-fire. Since declare_stage_outcome no longer has an inline
    // run_automation_rules() call, the AFTER UPDATE trigger fires exactly once per UPDATE.
    // We verify by confirming the delta is not 2x the number of rules (which would indicate
    // both an inline call AND the trigger fired). In practice, with N enabled rules
    // per project, delta should equal N (one run per rule), not 2*N.
    const rulesCount = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rules WHERE project_id = '${context.projectId}' AND trigger_type = 'status_change' AND status = 'enabled';`
    );
    const enabledRules = parseInt(rulesCount[0]?.cnt ?? "0");

    if (enabledRules > 0) {
      // delta should equal enabledRules (not 2x)
      expect(delta).toBeLessThanOrEqual(enabledRules * 2); // generous bound
      expect(delta).toBe(enabledRules); // exact: one run per rule per single trigger
    }

    reporter.logResult({
      testId: "6.1",
      testName: "Single Execution Verification (Double-Fire Check)",
      status: "PASS",
      notes: `Automation fired exactly ${delta} time(s) for ${enabledRules} status_change rule(s) — no double-fire detected`,
    });
  }, 60000);
});

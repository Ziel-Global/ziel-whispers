import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  TestContext,
} from "./setup/testContext";
import { STATUS_QA_REVIEW, USER_QA_SHAHID } from "./setup/constants";
import { dbQuery } from "./helpers/dbClient";
import { reporter } from "./helpers/reporter";

describe("Section 7: Log Submission Path (Test 7.1)", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTestEnvironment();
  }, 90000);

  afterAll(async () => {
    if (context?.projectId) {
      await teardownTestEnvironment(context.projectId);
    }
  }, 90000);

  it("Test 7.1: Daily Log Declared Outcome Automation (declare_stage_outcome RPC path)", async () => {
    const task = context.tasks["Integrate Apple Pay express checkout"];
    expect(task).toBeDefined();

    const before = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${task.id}';`,
    );
    const countBefore = parseInt(before[0]?.cnt ?? "0");

    // Call declare_stage_outcome which uses change_task_status internally —
    // the AFTER UPDATE trigger fires once, automation executes for this project
    await dbQuery(
      `SELECT public.declare_stage_outcome('${task.id}', '${STATUS_QA_REVIEW}', 'system');`,
    );

    // Verify task status updated
    const taskState = await dbQuery<{ status_id: string }>(
      `SELECT status_id FROM tasks WHERE id = '${task.id}';`,
    );
    expect(taskState[0].status_id).toBe(STATUS_QA_REVIEW);

    // Verify automation fired (rule runs created after the RPC call)
    const after = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${task.id}';`,
    );
    const countAfter = parseInt(after[0]?.cnt ?? "0");
    expect(countAfter).toBeGreaterThan(countBefore);

    // Verify QA rule specifically fired — task auto-assigned to Shahid
    const assignee = await dbQuery<{ assigned_to: string }>(
      `SELECT assigned_to FROM tasks WHERE id = '${task.id}';`,
    );
    expect(assignee[0].assigned_to).toBe(USER_QA_SHAHID);

    reporter.logResult({
      testId: "7.1",
      testName: "Daily Log Declared Outcome Automation",
      status: "PASS",
      notes: `declare_stage_outcome RPC correctly triggered automation: task status = QA Review, assignee = Shahid (QA Lead), rule_runs +${countAfter - countBefore}`,
    });
  }, 60000);
});

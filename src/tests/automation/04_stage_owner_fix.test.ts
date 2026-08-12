import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  TestContext,
} from "./setup/testContext";
import {
  STATUS_DEVELOPMENT,
  STATUS_QA_REVIEW,
  USER_DEV_SAAD,
  USER_QA_SHAHID,
} from "./setup/constants";
import { dbQuery } from "./helpers/dbClient";
import { reporter } from "./helpers/reporter";

describe("Section 4: Stage Owner Reassignment Fix (Test 4.1 - CRITICAL FIX)", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTestEnvironment();
  }, 90000);

  afterAll(async () => {
    if (context?.projectId) {
      await teardownTestEnvironment(context.projectId);
    }
  }, 90000);

  it("Test 4.1: Stage Owner Reassignment Fix (lookup_by: from)", async () => {
    const task = context.tasks["Fix login redirect loop on slow network"];
    expect(task).toBeDefined();

    // Step 1: Assign task to Saad Nasir (Original Developer) in Development
    await dbQuery(
      `UPDATE tasks SET assigned_to = '${USER_DEV_SAAD}', status_id = '${STATUS_DEVELOPMENT}' WHERE id = '${task.id}';`,
    );

    // Step 2: Developer Saad Nasir moves task from Development to QA Review
    // The DB trigger trg_record_task_status_history automatically records this transition in task_status_history
    await dbQuery(
      `UPDATE tasks SET status_id = '${STATUS_QA_REVIEW}' WHERE id = '${task.id}';`,
    );

    // Step 3: Reassign task to Shahid (QA Lead) while in QA Review
    await dbQuery(
      `UPDATE tasks SET assigned_to = '${USER_QA_SHAHID}' WHERE id = '${task.id}';`,
    );

    // Verify task is currently assigned to QA Lead Shahid before rejection
    const qaState = await dbQuery<{ assigned_to: string }>(
      `SELECT assigned_to FROM tasks WHERE id = '${task.id}';`,
    );
    expect(qaState[0].assigned_to).toBe(USER_QA_SHAHID);

    // Step 4: QA Lead Shahid rejects task and moves it back to Development
    // This triggers trg_run_automation_on_status_change -> rule_4_1 (reassign_to_stage_owner with lookup_by: "from")
    await dbQuery(
      `UPDATE tasks SET status_id = '${STATUS_DEVELOPMENT}' WHERE id = '${task.id}';`,
    );

    // Step 5: Verify task is automatically reassigned BACK to Saad Nasir (the original developer who sent it away from Development), NOT Shahid
    const finalState = await dbQuery<{ assigned_to: string }>(
      `SELECT assigned_to FROM tasks WHERE id = '${task.id}';`,
    );

    expect(finalState[0].assigned_to).toBe(USER_DEV_SAAD);
    expect(finalState[0].assigned_to).not.toBe(USER_QA_SHAHID);

    reporter.logResult({
      testId: "4.1",
      testName: "Stage Owner Reassignment Fix (lookup_by: from)",
      status: "PASS",
      notes:
        "CRITICAL FIX VERIFIED: Task correctly reassigned to original developer Saad Nasir (lookup_by: from), not QA engineer Shahid",
    });
  }, 90000);
});

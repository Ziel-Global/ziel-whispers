import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  TestContext,
} from "./setup/testContext";
import { STATUS_QA_REVIEW, USER_QA_SHAHID } from "./setup/constants";
import { dbQuery } from "./helpers/dbClient";
import { reporter } from "./helpers/reporter";

describe("Section 3: Standard Status-Change Rules (Test 3.1)", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTestEnvironment();
  }, 90000);

  afterAll(async () => {
    if (context?.projectId) {
      await teardownTestEnvironment(context.projectId);
    }
  }, 90000);

  it("Test 3.1: Basic Status Change Execution", async () => {
    const task = context.tasks["QA review for dark mode theme toggle"];
    expect(task).toBeDefined();

    // Perform status change to QA Review
    await dbQuery(
      `UPDATE tasks SET status_id = '${STATUS_QA_REVIEW}' WHERE id = '${task.id}';`,
    );

    // Verify task assignee automatically updated to QA Lead (Shahid)
    const rows = await dbQuery<{ assigned_to: string }>(
      `SELECT assigned_to FROM tasks WHERE id = '${task.id}';`,
    );
    expect(rows[0].assigned_to).toBe(USER_QA_SHAHID);

    reporter.logResult({
      testId: "3.1",
      testName: "Basic Status Change Execution",
      status: "PASS",
      notes:
        "Task auto-assigned to QA Lead upon transitioning to QA Review status",
    });
  }, 30000);
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  TestContext,
} from "./setup/testContext";
import { STATUS_DEVELOPMENT, STATUS_QA_REVIEW } from "./setup/constants";
import { dbQuery } from "./helpers/dbClient";
import { reporter } from "./helpers/reporter";

describe("Section 5: Bypass-Proofing (AFTER UPDATE Trigger)", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTestEnvironment();
  }, 90000);

  afterAll(async () => {
    if (context?.projectId) {
      await teardownTestEnvironment(context.projectId);
    }
  }, 90000);

  it("Test 5.1: Sprint Creation Status Change (task auto-links, automation fires)", async () => {
    const task = context.tasks["Optimize SQL query for transaction history"];
    expect(task).toBeDefined();

    const before = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${task.id}';`,
    );
    const countBefore = parseInt(before[0]?.cnt ?? "0");

    // Simulate sprint creation status change: Dev -> QA Review triggers automation
    await dbQuery(
      `UPDATE tasks SET status_id = '${STATUS_QA_REVIEW}' WHERE id = '${task.id}';`,
    );

    const after = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${task.id}';`,
    );
    expect(parseInt(after[0]?.cnt ?? "0")).toBeGreaterThan(countBefore);

    reporter.logResult({
      testId: "5.1",
      testName: "Sprint Creation Status Change",
      status: "PASS",
      notes: `Automation fired on status change: rule_runs went from ${countBefore} to ${after[0]?.cnt}`,
    });
  }, 60000);

  it("Test 5.2: Sprint Editing (Add/Remove Tasks) fires automation", async () => {
    const taskAdd = context.tasks["Fix currency symbol formatting in UI"];
    const taskRemove = context.tasks["Audit biometric SDK memory consumption"];
    expect(taskAdd).toBeDefined();
    expect(taskRemove).toBeDefined();

    // Ensure taskRemove is in a DIFFERENT status first (QA Review) so moving it
    // back to Development is an actual status change
    await dbQuery(
      `UPDATE tasks SET status_id = '${STATUS_QA_REVIEW}' WHERE id = '${taskRemove.id}';`,
    );

    const beforeAdd = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${taskAdd.id}';`,
    );
    const beforeRemove = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${taskRemove.id}';`,
    );

    // Sprint add: task moves to QA Review
    await dbQuery(
      `UPDATE tasks SET status_id = '${STATUS_QA_REVIEW}' WHERE id = '${taskAdd.id}';`,
    );
    // Sprint remove: task moves back to Development (unlinks from sprint)
    await dbQuery(
      `UPDATE tasks SET status_id = '${STATUS_DEVELOPMENT}' WHERE id = '${taskRemove.id}';`,
    );

    const afterAdd = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${taskAdd.id}';`,
    );
    const afterRemove = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${taskRemove.id}';`,
    );

    expect(parseInt(afterAdd[0]?.cnt ?? "0")).toBeGreaterThan(
      parseInt(beforeAdd[0]?.cnt ?? "0"),
    );
    expect(parseInt(afterRemove[0]?.cnt ?? "0")).toBeGreaterThan(
      parseInt(beforeRemove[0]?.cnt ?? "0"),
    );

    reporter.logResult({
      testId: "5.2",
      testName: "Sprint Editing (Add/Remove Tasks)",
      status: "PASS",
      notes:
        "Automation fired for both tasks when their status changed via simulated sprint edit",
    });
  }, 60000);

  it("Test 5.3: Sprint Deletion Bypass (tasks reverted to Development, automation fires)", async () => {
    const task = context.tasks["Add fingerprint fallback for older Android"];
    expect(task).toBeDefined();

    // Move task to QA Review first so sprint deletion (Dev) is a real status change
    await dbQuery(
      `UPDATE tasks SET status_id = '${STATUS_QA_REVIEW}' WHERE id = '${task.id}';`,
    );

    const before = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${task.id}';`,
    );

    // Simulate sprint deletion: task reset from QA Review to Development
    await dbQuery(
      `UPDATE tasks SET status_id = '${STATUS_DEVELOPMENT}' WHERE id = '${task.id}';`,
    );

    const after = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${task.id}';`,
    );

    expect(parseInt(after[0]?.cnt ?? "0")).toBeGreaterThan(
      parseInt(before[0]?.cnt ?? "0"),
    );

    reporter.logResult({
      testId: "5.3",
      testName: "Sprint Deletion Bypass",
      status: "PASS",
      notes:
        "Automation fired when sprint deletion reset task status back to Development",
    });
  }, 60000);

  it("Test 5.5: Negative Test - Title/Priority Edit Does NOT Fire Automation", async () => {
    const task = context.tasks["Fix currency symbol formatting in UI"];
    expect(task).toBeDefined();

    // Ensure task is in Development
    await dbQuery(
      `UPDATE tasks SET status_id = '${STATUS_DEVELOPMENT}' WHERE id = '${task.id}';`,
    );

    const before = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${task.id}';`,
    );

    // Edit title and priority only — status_id does NOT change, trigger guard should skip
    await dbQuery(
      `UPDATE tasks SET title = 'Fix currency symbol formatting in UI (Android)', priority = 'high' WHERE id = '${task.id}';`,
    );

    const after = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${task.id}';`,
    );

    expect(parseInt(after[0]?.cnt ?? "0")).toBe(
      parseInt(before[0]?.cnt ?? "0"),
    );

    reporter.logResult({
      testId: "5.5",
      testName: "Negative Test (Title/Priority Edit)",
      status: "PASS",
      notes:
        "Automation correctly skipped — status_id unchanged, trigger guard IS NOT DISTINCT FROM worked",
    });
  }, 60000);
});

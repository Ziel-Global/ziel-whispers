import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestEnvironment, teardownTestEnvironment, TestContext } from "./setup/testContext";
import { STATUS_DEVELOPMENT, STATUS_QA_REVIEW, USER_PM_SAMI, USER_DEV_SAAD } from "./setup/constants";
import { dbQuery } from "./helpers/dbClient";
import { reporter } from "./helpers/reporter";

describe("Section 2: Blocker Rules Engine (Tests 2.1–2.7)", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTestEnvironment();
  }, 90000);

  afterAll(async () => {
    if (context?.projectId) {
      await teardownTestEnvironment(context.projectId);
    }
  }, 90000);

  it("Test 2.1: Blocker Condition Match", async () => {
    const task = context.tasks["Fix duplicate transaction charge bug"];
    expect(task).toBeDefined();

    // Raise blocker on High Priority task
    await dbQuery(
      `INSERT INTO task_blockers (project_id, task_id, description, status, raised_by, client_visible, requires_client_action) VALUES ('${context.projectId}', '${task.id}', 'Database deadlock on concurrent requests', 'open', '${USER_DEV_SAAD}', false, false);`
    );

    // Run automation engine for blocker_raised
    await dbQuery(
      `SELECT public.run_automation_rules('${context.projectId}'::uuid, 'blocker_raised', 'task', '${task.id}'::uuid);`
    );

    // Check status changed to QA Review
    const rows = await dbQuery<{ status_id: string }>(
      `SELECT status_id FROM tasks WHERE id = '${task.id}';`
    );
    expect(rows[0].status_id).toBe(STATUS_QA_REVIEW);

    reporter.logResult({
      testId: "2.1",
      testName: "Blocker Condition Match",
      status: "PASS",
      notes: "Status updated to QA Review on High Priority blocker",
    });
  }, 30000);

  it("Test 2.2: Blocker Condition NOT Met (Skip)", async () => {
    const task = context.tasks["Refactor payment gateway webhook retry"];
    expect(task).toBeDefined();

    // Raise blocker on Medium Priority task
    await dbQuery(
      `INSERT INTO task_blockers (project_id, task_id, description, status, raised_by, client_visible, requires_client_action) VALUES ('${context.projectId}', '${task.id}', 'Waiting for third-party API docs', 'open', '${USER_DEV_SAAD}', false, false);`
    );

    // Run automation engine for blocker_raised
    await dbQuery(
      `SELECT public.run_automation_rules('${context.projectId}'::uuid, 'blocker_raised', 'task', '${task.id}'::uuid);`
    );

    // Status should remain Development (High priority rule skipped)
    const rows = await dbQuery<{ status_id: string }>(
      `SELECT status_id FROM tasks WHERE id = '${task.id}';`
    );
    expect(rows[0].status_id).toBe(STATUS_DEVELOPMENT);

    reporter.logResult({
      testId: "2.2",
      testName: "Blocker Condition NOT Met",
      status: "PASS",
      notes: "Rule skipped as priority was not High",
    });
  }, 30000);

  it("Test 2.3: Multiple AND Conditions", async () => {
    const task = context.tasks["Design transaction receipt PDF exporter"];
    expect(task).toBeDefined();

    // Raise blocker on Low Priority, Development task
    await dbQuery(
      `INSERT INTO task_blockers (project_id, task_id, description, status, raised_by, client_visible, requires_client_action) VALUES ('${context.projectId}', '${task.id}', 'Missing logo asset', 'open', '${USER_DEV_SAAD}', false, false);`
    );

    // Run automation engine for blocker_raised
    await dbQuery(
      `SELECT public.run_automation_rules('${context.projectId}'::uuid, 'blocker_raised', 'task', '${task.id}'::uuid);`
    );

    // Verify task assignee changed to USER_PM_SAMI
    const rows = await dbQuery<{ assigned_to: string }>(
      `SELECT assigned_to FROM tasks WHERE id = '${task.id}';`
    );
    expect(rows[0].assigned_to).toBe(USER_PM_SAMI);

    reporter.logResult({
      testId: "2.3",
      testName: "Multiple AND Conditions",
      status: "PASS",
      notes: "Task assigned to PM when both priority and status matched",
    });
  }, 30000);

  it("Test 2.4: Empty Conditions (Match All)", async () => {
    const task = context.tasks["Sanitize JWT token storage in Keychain"];
    expect(task).toBeDefined();

    await dbQuery(
      `INSERT INTO task_blockers (project_id, task_id, description, status, raised_by, client_visible, requires_client_action) VALUES ('${context.projectId}', '${task.id}', 'Security review pending', 'open', '${USER_DEV_SAAD}', false, false);`
    );

    await dbQuery(
      `SELECT public.run_automation_rules('${context.projectId}'::uuid, 'blocker_raised', 'task', '${task.id}'::uuid);`
    );

    // Check system comment added
    const comments = await dbQuery<{ body: string }>(
      `SELECT body FROM task_comments WHERE task_id = '${task.id}';`
    );
    expect(comments.some((c) => c.body.includes("System Alert: A blocker was reported"))).toBe(true);

    reporter.logResult({
      testId: "2.4",
      testName: "Empty Conditions (Match All)",
      status: "PASS",
      notes: "Audit comment posted automatically for match-all blocker rule",
    });
  }, 30000);

  it("Test 2.5: Multiple Actions in One Rule", async () => {
    const task = context.tasks["Update API documentation for v2 routes"];
    expect(task).toBeDefined();

    await dbQuery(
      `INSERT INTO task_blockers (project_id, task_id, description, status, raised_by, client_visible, requires_client_action) VALUES ('${context.projectId}', '${task.id}', 'Swagger spec missing', 'open', '${USER_DEV_SAAD}', false, false);`
    );

    await dbQuery(
      `SELECT public.run_automation_rules('${context.projectId}'::uuid, 'blocker_raised', 'task', '${task.id}'::uuid);`
    );

    // Check assignee AND comment
    const taskRows = await dbQuery<{ assigned_to: string }>(
      `SELECT assigned_to FROM tasks WHERE id = '${task.id}';`
    );
    expect(taskRows[0].assigned_to).toBe(USER_DEV_SAAD);

    const comments = await dbQuery<{ body: string }>(
      `SELECT body FROM task_comments WHERE task_id = '${task.id}';`
    );
    expect(comments.some((c) => c.body.includes("Escalated to lead developer Saad Nasir"))).toBe(true);

    reporter.logResult({
      testId: "2.5",
      testName: "Multiple Actions in One Rule",
      status: "PASS",
      notes: "Assignee updated and comment posted in single rule run",
    });
  }, 30000);

  it("Test 2.6: Blocker Resolved Actions", async () => {
    const task = context.tasks["Fix OAuth token expiration state crash"];
    expect(task).toBeDefined();

    // Insert blocker and resolve it
    const blockerRows = await dbQuery<{ id: string }>(
      `INSERT INTO task_blockers (project_id, task_id, description, status, raised_by, client_visible, requires_client_action) VALUES ('${context.projectId}', '${task.id}', 'Third party server down', 'open', '${USER_DEV_SAAD}', false, false) RETURNING id;`
    );
    const blockerId = blockerRows[0].id;

    await dbQuery(
      `UPDATE task_blockers SET status = 'resolved', resolved_at = now() WHERE id = '${blockerId}';`
    );

    // Trigger blocker_resolved automation
    await dbQuery(
      `SELECT public.run_automation_rules('${context.projectId}'::uuid, 'blocker_resolved', 'task', '${task.id}'::uuid);`
    );

    // Status should reset to Development
    const rows = await dbQuery<{ status_id: string }>(
      `SELECT status_id FROM tasks WHERE id = '${task.id}';`
    );
    expect(rows[0].status_id).toBe(STATUS_DEVELOPMENT);

    reporter.logResult({
      testId: "2.6",
      testName: "Blocker Resolved Actions",
      status: "PASS",
      notes: "Status reset to Development upon resolving blocker",
    });
  }, 30000);

  it("Test 2.7: Toggling a Rule On / Off", async () => {
    const task = context.tasks["Add push notification for failed reload"];
    const ruleId = context.ruleIds["rule_2_7"];
    expect(task).toBeDefined();
    expect(ruleId).toBeDefined();

    // Disable rule
    await dbQuery(`UPDATE automation_rules SET status = 'disabled' WHERE id = '${ruleId}';`);

    await dbQuery(
      `INSERT INTO task_blockers (project_id, task_id, description, status, raised_by, client_visible, requires_client_action) VALUES ('${context.projectId}', '${task.id}', 'Push credentials expired', 'open', '${USER_DEV_SAAD}', false, false);`
    );

    await dbQuery(
      `SELECT public.run_automation_rules('${context.projectId}'::uuid, 'blocker_raised', 'task', '${task.id}'::uuid);`
    );

    // Status should NOT be changed
    const rows1 = await dbQuery<{ status_id: string }>(
      `SELECT status_id FROM tasks WHERE id = '${task.id}';`
    );
    expect(rows1[0].status_id).toBe(STATUS_DEVELOPMENT);

    // Enable rule back
    await dbQuery(`UPDATE automation_rules SET status = 'enabled' WHERE id = '${ruleId}';`);

    reporter.logResult({
      testId: "2.7",
      testName: "Toggling a Rule On / Off",
      status: "PASS",
      notes: "Disabled rule did not execute; enabled status restored",
    });
  }, 30000);
});

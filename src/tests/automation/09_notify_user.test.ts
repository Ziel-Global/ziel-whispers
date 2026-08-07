import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestEnvironment, teardownTestEnvironment, TestContext } from "./setup/testContext";
import { STATUS_QA_REVIEW, USER_DEV_SAAD } from "./setup/constants";
import { dbQuery } from "./helpers/dbClient";
import { reporter } from "./helpers/reporter";

describe("Section 9: notify_user Action Type (Test 9.1)", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTestEnvironment();
  }, 90000);

  afterAll(async () => {
    if (context?.projectId) {
      await teardownTestEnvironment(context.projectId);
    }
  }, 90000);

  it("Test 9.1: In-App Notification Trigger & Template Resolution", async () => {
    const task = context.tasks["Setup transaction summary email alert"];
    expect(task).toBeDefined();

    // Assign task to Saad Nasir
    await dbQuery(`UPDATE tasks SET assigned_to = '${USER_DEV_SAAD}' WHERE id = '${task.id}';`);

    // Record notification count before for this project
    const before = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM notifications WHERE metadata->>'title' = 'QA Review Pending' AND metadata->>'project_id' = '${context.projectId}';`
    );
    const countBefore = parseInt(before[0]?.cnt ?? "0");

    // Move task to QA Review — triggers automation -> notify_user fires
    await dbQuery(`UPDATE tasks SET status_id = '${STATUS_QA_REVIEW}' WHERE id = '${task.id}';`);

    // Verify notification delivered for this project
    const notifications = await dbQuery<{ user_id: string; type: string; metadata: any }>(
      `SELECT user_id, type, metadata FROM notifications WHERE metadata->>'title' = 'QA Review Pending' AND metadata->>'project_id' = '${context.projectId}' ORDER BY triggered_at DESC LIMIT 5;`
    );

    const after = await dbQuery<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM notifications WHERE metadata->>'title' = 'QA Review Pending' AND metadata->>'project_id' = '${context.projectId}';`
    );
    const countAfter = parseInt(after[0]?.cnt ?? "0");

    expect(countAfter).toBeGreaterThan(countBefore);
    expect(notifications.length).toBeGreaterThan(0);

    // Verify template was resolved (no raw placeholders)
    const latestNotification = notifications[0];
    const metadata = typeof latestNotification.metadata === "string"
      ? JSON.parse(latestNotification.metadata)
      : latestNotification.metadata;

    expect(metadata.title).toBe("QA Review Pending");
    expect(metadata.message).not.toContain("{task_title}");
    expect(metadata.message).not.toContain("{project_name}");
    expect(metadata.message).toContain("Setup transaction summary email alert");

    reporter.logResult({
      testId: "9.1",
      testName: "notify_user Action Type & Template Resolution",
      status: "PASS",
      notes: `Notification delivered. Title="QA Review Pending". Message resolved: "${metadata.message}"`,
    });
  }, 60000);
});

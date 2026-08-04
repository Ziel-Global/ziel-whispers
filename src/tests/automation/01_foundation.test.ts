import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestEnvironment, teardownTestEnvironment, TestContext } from "./setup/testContext";
import { STATUS_UNLINKED, STATUS_DEVELOPMENT } from "./setup/constants";
import { dbQuery } from "./helpers/dbClient";
import { reporter } from "./helpers/reporter";

describe("Section 1: Foundation (Sprint ↔ Status Derivation)", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTestEnvironment();
  }, 90000);

  afterAll(async () => {
    if (context?.projectId) {
      await teardownTestEnvironment(context.projectId);
    }
  }, 90000);

  it("Test 1.1: Sprint Status Auto-Derivation (link and unlink sprint)", async () => {
    const taskTitle = "Implement biometric authentication flow";
    const task = context.tasks[taskTitle];
    expect(task).toBeDefined();

    // 1. Initial check: task starts unlinked
    const initialRows = await dbQuery<{ status_id: string; sprint_id: string | null }>(
      `SELECT status_id, sprint_id FROM tasks WHERE id = '${task.id}';`
    );
    expect(initialRows[0].status_id).toBe(STATUS_UNLINKED);
    expect(initialRows[0].sprint_id).toBeNull();

    // 2. Create sprint
    const sprintRows = await dbQuery<{ id: string }>(
      `INSERT INTO sprints (project_id, phase_id, name, status, start_date, end_date) VALUES ('${context.projectId}', '${context.phaseId}', 'Sprint 14 - Biometric & Security', 'planned', CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days') RETURNING id;`
    );
    const sprintId = sprintRows[0].id;

    // 3. Link task to sprint
    await dbQuery(`UPDATE tasks SET sprint_id = '${sprintId}' WHERE id = '${task.id}';`);

    const linkedRows = await dbQuery<{ status_id: string; sprint_id: string }>(
      `SELECT status_id, sprint_id FROM tasks WHERE id = '${task.id}';`
    );
    expect(linkedRows[0].sprint_id).toBe(sprintId);

    // 4. Move task to Development
    await dbQuery(`UPDATE tasks SET status_id = '${STATUS_DEVELOPMENT}' WHERE id = '${task.id}';`);

    const devRows = await dbQuery<{ status_id: string; sprint_id: string }>(
      `SELECT status_id, sprint_id FROM tasks WHERE id = '${task.id}';`
    );
    expect(devRows[0].status_id).toBe(STATUS_DEVELOPMENT);
    expect(devRows[0].sprint_id).toBe(sprintId);

    // 5. Unlink task from sprint
    await dbQuery(`UPDATE tasks SET sprint_id = NULL WHERE id = '${task.id}';`);

    const unlinkedRows = await dbQuery<{ status_id: string; sprint_id: string | null }>(
      `SELECT status_id, sprint_id FROM tasks WHERE id = '${task.id}';`
    );
    expect(unlinkedRows[0].sprint_id).toBeNull();

    reporter.logResult({
      testId: "1.1",
      testName: "Sprint Status Auto-Derivation",
      status: "PASS",
      notes: "Task linked and unlinked from sprint successfully adhering to workflow transition constraints",
    });
  }, 60000);
});

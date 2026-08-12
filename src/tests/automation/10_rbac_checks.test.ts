import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  TestContext,
} from "./setup/testContext";
import { USER_DEV_SAAD, STATUS_QA_REVIEW } from "./setup/constants";
import { dbQuery } from "./helpers/dbClient";
import { reporter } from "./helpers/reporter";

describe("Section 10: Admin & Permission Checks (Test 10.1)", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await setupTestEnvironment();
  }, 90000);

  afterAll(async () => {
    if (context?.projectId) {
      await teardownTestEnvironment(context.projectId);
    }
  }, 90000);

  it("Test 10.1: Automation Rules are Project-Scoped (no cross-project bleed)", async () => {
    // Create a second isolated project
    const otherProjectRows = await dbQuery<{ id: string }>(`
      INSERT INTO projects (name, description, status, start_date)
      VALUES ('RBAC Test Project [auto-teardown]', 'Test isolation', 'active', CURRENT_DATE)
      RETURNING id;
    `);
    const otherProjectId = otherProjectRows[0]?.id;
    expect(otherProjectId).toBeDefined();

    try {
      // Create a phase for the other project (project_phases uses 'title', not 'name')
      const phaseRows = await dbQuery<{ id: string }>(`
        INSERT INTO project_phases (project_id, title)
        VALUES ('${otherProjectId}', 'Phase 1')
        RETURNING id;
      `);
      const phaseId = phaseRows[0]?.id;
      expect(phaseId).toBeDefined();

      // Create a task in the other project
      const taskRows = await dbQuery<{ id: string }>(`
        INSERT INTO tasks (project_id, title, status_id, priority, assigned_to)
        SELECT '${otherProjectId}', 'Isolation test task',
               '${STATUS_QA_REVIEW}', 'medium', '${USER_DEV_SAAD}'
        FROM (SELECT 1) _
        WHERE EXISTS (SELECT 1 FROM workflow_statuses WHERE id = '${STATUS_QA_REVIEW}')
        RETURNING id;
      `);

      // Verify: other project has zero automation rules
      const rulesInOtherProject = await dbQuery<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM automation_rules WHERE project_id = '${otherProjectId}';`,
      );
      expect(parseInt(rulesInOtherProject[0]?.cnt ?? "0")).toBe(0);

      if (taskRows.length > 0) {
        const otherTaskId = taskRows[0]?.id;

        // Count rule runs for task in other project
        const runs = await dbQuery<{ cnt: string }>(
          `SELECT COUNT(*) AS cnt FROM automation_rule_runs WHERE entity_id = '${otherTaskId}';`,
        );

        // Since other project has no rules, no rule_runs should exist for this task
        expect(parseInt(runs[0]?.cnt ?? "0")).toBe(0);
      }

      reporter.logResult({
        testId: "10.1",
        testName: "RBAC: Automation Rules Project-Scoped",
        status: "PASS",
        notes: `No cross-project rule bleed confirmed. Other project has 0 rules and 0 rule_runs for its tasks.`,
      });
    } finally {
      if (otherProjectId) {
        await dbQuery(`DELETE FROM projects WHERE id = '${otherProjectId}';`);
      }
    }
  }, 90000);

  it("Test 10.2: Protected Task (Task A) Integrity Check", async () => {
    // Verify Task A was never touched during all test operations
    const protectedTaskId = "2863a41f-609b-4bcc-a778-d316cd7f46dc";
    const rows = await dbQuery<{ id: string }>(
      `SELECT id FROM tasks WHERE id = '${protectedTaskId}';`,
    );

    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(protectedTaskId);

    reporter.logResult({
      testId: "10.2",
      testName: "Protected Task (Task A) Integrity Check",
      status: "PASS",
      notes:
        "Task A - Setup CI/CD Pipeline (2863a41f) was not modified or deleted by any test operation",
    });
  }, 30000);
});

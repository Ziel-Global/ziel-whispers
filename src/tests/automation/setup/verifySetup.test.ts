import { describe, it, expect, afterAll } from "vitest";
import { setupTestEnvironment, teardownTestEnvironment, TestContext } from "./testContext";
import { dbQuery } from "../helpers/dbClient";

describe("Step 3: Setup & Teardown Module Verification", () => {
  let context: TestContext;

  it("should successfully create a test project, seed tasks, and seed automation rules", async () => {
    context = await setupTestEnvironment();

    expect(context.projectId).toBeDefined();
    expect(context.projectName).toContain("OmniPay Mobile Wallet");

    // Verify project exists in DB via superuser query
    const projRows = await dbQuery<{ id: string; name: string }>(
      `SELECT id, name FROM projects WHERE id = '${context.projectId}';`
    );

    expect(projRows.length).toBe(1);
    expect(projRows[0].id).toBe(context.projectId);

    // Verify tasks seeded
    const taskKeys = Object.keys(context.tasks);
    expect(taskKeys.length).toBeGreaterThanOrEqual(15);
    expect(context.tasks["Implement biometric authentication flow"]).toBeDefined();

    // Verify rules seeded
    const ruleKeys = Object.keys(context.ruleIds);
    expect(ruleKeys.length).toBeGreaterThanOrEqual(8);
  }, 30000);

  afterAll(async () => {
    if (context?.projectId) {
      await teardownTestEnvironment(context.projectId);

      // Confirm project is gone
      const projRows = await dbQuery<{ id: string }>(
        `SELECT id FROM projects WHERE id = '${context.projectId}';`
      );

      expect(projRows.length).toBe(0);
    }
  }, 30000);
});

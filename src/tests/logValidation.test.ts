import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { MISC_PROJECT_ID } from "@/lib/utils";
import { createDailyLogSchema } from "@/lib/logValidation";

const validLog = {
  project_id: "project-1",
  category: "development",
  hours: 1,
  description: "Worked on assigned project tasks",
  log_date: "2026-10-19", // Monday
  task_id: "task-1",
};

function makeSchema(overrides: Partial<Parameters<typeof createDailyLogSchema>[0]> = {}) {
  return createDailyLogSchema({
    overtimeEnabled: false,
    workingDays: 5,
    today: "2026-10-19",
    editWindowDays: 1,
    submittedHoursByDate: {},
    ...overrides,
  });
}

describe("daily log form validation", () => {
  it("accepts a complete project task log", () => {
    expect(makeSchema().safeParse(validLog).success).toBe(true);
  });

  it.each([
    { patch: { project_id: "" }, message: "Please select a project" },
    { patch: { category: "" }, message: "Category is required" },
    { patch: { hours: 0.1 }, message: "Min 0.25 hours" },
    { patch: { hours: 24.1 }, message: "Max 24 hours" },
    { patch: { description: "Too short" }, message: "Min 20 characters" },
    { patch: { task_id: null }, message: "Please select a task (or 'Other')" },
  ])("rejects invalid fields ($message)", ({ patch, message }) => {
    const result = makeSchema().safeParse({ ...validLog, ...patch });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.message)).toContain(message);
  });

  it("allows the miscellaneous project without a task", () => {
    expect(makeSchema().safeParse({ ...validLog, project_id: MISC_PROJECT_ID, task_id: null }).success).toBe(true);
  });

  it("rejects Sundays and Saturday for a five-day schedule", () => {
    expect(makeSchema().safeParse({ ...validLog, log_date: "2026-10-18" }).success).toBe(false);
    expect(makeSchema().safeParse({ ...validLog, log_date: "2026-10-17" }).success).toBe(false);
  });

  it("allows Saturday for a six-day schedule and allows weekend dates when overtime is enabled", () => {
    expect(makeSchema({ workingDays: 6 }).safeParse({ ...validLog, log_date: "2026-10-17" }).success).toBe(true);
    expect(makeSchema({ overtimeEnabled: true }).safeParse({ ...validLog, log_date: "2026-10-18" }).success).toBe(true);
  });

  it("enforces the submitted-hour cap unless overtime is enabled", () => {
    expect(makeSchema({ submittedHoursByDate: { [validLog.log_date]: 24 } }).safeParse(validLog).success).toBe(false);
    expect(makeSchema({ overtimeEnabled: true, submittedHoursByDate: { [validLog.log_date]: 24 } }).safeParse(validLog).success).toBe(true);
  });

  it("rejects dates outside the configured edit window", () => {
    expect(makeSchema().safeParse({ ...validLog, log_date: "2026-10-15" }).success).toBe(false);
  });
});

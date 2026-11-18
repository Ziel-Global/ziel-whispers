import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

// workflow.ts imports the Supabase client; stub it so the pure helpers can load in tests.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { isClientRole } from "@/lib/workflow";
import { buildTaskCommentInsert } from "@/lib/taskComments";
import { computeBurndownData } from "@/lib/projectBurndown";
import { sortPresentFirst } from "@/lib/attendance";

describe("1. Client login lands on My Projects", () => {
  it("treats client and client member as clients", () => {
    expect(isClientRole({ role: "client" })).toBe(true);
    expect(isClientRole({ role: "client member" })).toBe(true);
  });
  it("does not treat staff or a not-yet-loaded profile as a client", () => {
    for (const role of ["admin", "manager", "hr_manager", "project_manager", "employee"]) {
      expect(isClientRole({ role })).toBe(false);
    }
    expect(isClientRole(null)).toBe(false);
  });
});

describe("2. Task comments are saved", () => {
  it("builds a row the RLS insert rule accepts (own, human, trimmed)", () => {
    expect(buildTaskCommentInsert("task-1", "user-1", "  hello  ")).toEqual({
      task_id: "task-1",
      author_id: "user-1",
      author_type: "human",
      body: "hello",
    });
  });
  it("saves nothing for empty text or missing task/user", () => {
    expect(buildTaskCommentInsert("task-1", "user-1", "   ")).toBeNull();
    expect(buildTaskCommentInsert(undefined, "user-1", "hi")).toBeNull();
    expect(buildTaskCommentInsert("task-1", undefined, "hi")).toBeNull();
  });
});

describe("3. Task-based daily burndown progression", () => {
  const project = { start_date: "2026-11-01", end_date: "2026-11-05" };
  const tasks = [
    { id: "a", completed_at: "2026-11-02T10:00:00Z" },
    { id: "b", completed_at: "2026-11-04T12:00:00Z" },
    { id: "c", completed_at: null },
    { id: "d", completed_at: null },
  ];

  it("calculates total, completed, and remaining tasks accurately", () => {
    const result: any = computeBurndownData({
      burndownScope: "project",
      phases: [],
      sprints: [],
      project,
      tasks,
    });

    expect(result.totalTasks).toBe(4);
    expect(result.completedTasks).toBe(2);
    expect(result.remainingTasks).toBe(2);
  });

  it("generates daily points from start_date to end_date with linear ideal pace", () => {
    const result: any = computeBurndownData({
      burndownScope: "project",
      phases: [],
      sprints: [],
      project,
      tasks,
    });

    expect(result.burndownData).toHaveLength(5);
    expect(result.burndownData[0].date).toBe("2026-11-01");
    expect(result.burndownData[0].ideal).toBe(4);

    expect(result.burndownData[4].date).toBe("2026-11-05");
    expect(result.burndownData[4].ideal).toBe(0);
  });
});

describe("5. Attendance filter label", () => {
  it('says "All Status", not "All Statuses"', () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../pages/AttendanceAdmin.tsx"), "utf8");
    expect(src).toContain(">All Status<");
    expect(src).not.toContain("All Statuses");
  });
});

describe("6. Attendance shows present members first", () => {
  it("present first, then absent, A–Z within each group", () => {
    const rows = [
      { clock_in: null, users: { full_name: "Ali" } },
      { clock_in: "09:00", users: { full_name: "Zara" } },
      { clock_in: null, users: { full_name: "Bilal" } },
      { clock_in: "09:30", users: { full_name: "Hina" } },
    ];
    expect(sortPresentFirst(rows).map((r) => r.users.full_name)).toEqual(["Hina", "Zara", "Ali", "Bilal"]);
  });
});

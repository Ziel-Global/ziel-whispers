import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

// workflow.ts imports the Supabase client; stub it so the pure helpers can load in tests.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { isClientRole } from "@/lib/workflow";
import { buildTaskCommentInsert } from "@/lib/taskComments";
import { computeBurndownData } from "@/lib/projectBurndown";
import { excludeClientUsers, sortPresentFirst } from "@/lib/attendance";

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

describe("3. Client burndown (Done = 0); admin charts unchanged", () => {
  const project = { start_date: "2026-01-01", end_date: "2026-12-31" };
  const workflowStatuses = [
    { id: "todo", category: "todo" },
    { id: "done", category: "done" },
  ];
  const base = { burndownScope: "project", phases: [], sprints: [], project, workflowStatuses };

  it("client: done task counts as 0 remaining even with no visible logs", () => {
    const r: any = computeBurndownData({
      ...base,
      tasks: [
        { id: "a", estimated_hours: 20, status_id: "done" },
        { id: "b", estimated_hours: 40, status_id: "todo" },
      ],
      logs: [],
    });
    expect(r.totalEst).toBe(60);
    expect(r.remaining).toBe(40); // was a flat 60 before the fix
  });

  it("client: open task = estimate minus its own logged hours, never below 0", () => {
    const r: any = computeBurndownData({
      ...base,
      tasks: [
        { id: "a", estimated_hours: 10, status_id: "todo" },
        { id: "b", estimated_hours: 10, status_id: "todo" },
      ],
      logs: [
        { task_id: "a", hours: 4 },
        { task_id: "b", hours: 15 },
      ],
    });
    expect(r.remaining).toBe(6);
  });

  it("client: completed_at also marks a task done", () => {
    const r: any = computeBurndownData({
      ...base,
      tasks: [{ id: "a", estimated_hours: 10, status_id: "todo", completed_at: "2026-02-01" }],
      logs: [],
    });
    expect(r.remaining).toBe(0);
  });

  it("admin (no workflowStatuses passed): original formula, total minus logged", () => {
    const r: any = computeBurndownData({
      burndownScope: "project",
      phases: [],
      sprints: [],
      project,
      tasks: [
        { id: "a", estimated_hours: 20, status_id: "done" },
        { id: "b", estimated_hours: 40, status_id: "todo" },
      ],
      logs: [{ task_id: "b", hours: 5 }],
    });
    expect(r.remaining).toBe(55);
  });
});

describe("4. Attendance hides client members", () => {
  it("removes client and client member users only", () => {
    const users = [
      { id: "1", role: "employee" },
      { id: "2", role: "client" },
      { id: "3", role: "client member" },
      { id: "4", role: "manager" },
    ];
    expect(excludeClientUsers(users).map((u) => u.id)).toEqual(["1", "4"]);
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

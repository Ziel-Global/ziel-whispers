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

describe("3. Client burndown = admin formula, fed per-task logged totals", () => {
  const project = { start_date: "2026-01-01", end_date: "2026-12-31" };
  const tasks = [
    { id: "a", estimated_hours: 20 },
    { id: "b", estimated_hours: 40 },
  ];
  const base = { burndownScope: "project", phases: [], sprints: [], project, tasks };

  it("per-task totals (client RPC) give the same numbers as raw logs (admin)", () => {
    const admin: any = computeBurndownData({
      ...base,
      logs: [
        { task_id: "a", hours: 5 },
        { task_id: "a", hours: 7.5 },
        { task_id: "b", hours: 10 },
      ],
    });
    const client: any = computeBurndownData({
      ...base,
      logs: [
        { task_id: "a", hours: "12.5" }, // numeric may arrive as a string
        { task_id: "b", hours: 10 },
      ],
    });
    expect(admin.logged).toBe(22.5);
    expect(admin.remaining).toBe(37.5);
    expect(client.logged).toBe(admin.logged);
    expect(client.remaining).toBe(admin.remaining);
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

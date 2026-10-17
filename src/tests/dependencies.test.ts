import { describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: fromMock } }));

import { getUnfinishedDependencies, isDependencyWarnTarget } from "@/lib/dependencies";

describe("task dependency rules", () => {
  it.each([
    { category: "done", expected: true },
    { category: "in_progress", expected: true },
    { category: "todo", expected: false },
    { category: undefined, expected: false },
    { category: null, expected: false },
  ])("warns for destination category $category", ({ category, expected }) => {
    expect(isDependencyWarnTarget(category)).toBe(expected);
  });

  it("returns dependencies that are not in a done workflow category", async () => {
    const query: any = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.eq.mockImplementation(() => query);
    query.then = (resolve: (value: unknown) => unknown) => resolve({
      data: [
        { depends_on: { id: "blocked", title: "Unfinished prerequisite", status_id: "active" } },
        { depends_on: { id: "done", title: "Finished prerequisite", status_id: "complete" } },
        { depends_on: { id: "unknown", title: "Unknown status", status_id: "missing" } },
      ],
      error: null,
    });
    fromMock.mockReturnValue(query);

    await expect(getUnfinishedDependencies("task-1", [
      { id: "active", name: "Doing", category: "in_progress", color: "blue", sort_order: 1, is_initial: false, retired: false },
      { id: "complete", name: "Done", category: "done", color: "green", sort_order: 2, is_initial: false, retired: false },
    ])).resolves.toEqual([
      { taskId: "blocked", title: "Unfinished prerequisite" },
      { taskId: "unknown", title: "Unknown status" },
    ]);
    expect(query.eq).toHaveBeenNthCalledWith(1, "task_id", "task-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "dependency_type", "finish_to_start");
  });

  it("returns an empty list when the query has no dependencies", async () => {
    const query: any = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.then = (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null });
    fromMock.mockReturnValue(query);

    await expect(getUnfinishedDependencies("task-1", [])).resolves.toEqual([]);
  });
});

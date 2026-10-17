import { afterEach, describe, expect, it, vi } from "vitest";
import { computeBurndownData } from "@/lib/projectBurndown";

afterEach(() => vi.useRealTimers());

describe("project burndown calculations", () => {
  const project = { start_date: "2026-10-01", end_date: "2026-10-11" };

  it("calculates estimates, logged work, remaining work, and ideal progress", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T00:00:00Z"));

    const result = computeBurndownData({
      burndownScope: "project",
      phases: [],
      tasks: [
        { id: "a", estimated_hours: 8 },
        { id: "b", estimated_hours: 4 },
        { id: "c", estimated_hours: null },
      ],
      sprints: [],
      logs: [
        { task_id: "a", hours: 3 },
        { task_id: "a", hours: 1 },
        { task_id: "b", hours: 2 },
      ],
      project,
    });

    expect(result).toMatchObject({ totalEst: 12, logged: 6, remaining: 6 });
    if ("burndownData" in result) {
      expect(result.unestimated).toHaveLength(1);
      expect(result.burndownData).toEqual([
        { name: "Start", ideal: 12, actual: 12 },
        { name: "Now", ideal: 6, actual: 6 },
        { name: "Due", ideal: 0, actual: null },
      ]);
    }
  });

  it("limits phase scope to tasks whose sprint belongs to that phase", () => {
    const result = computeBurndownData({
      burndownScope: "phase-1",
      phases: [{ id: "phase-1", due_date: "2026-10-11" }],
      tasks: [
        { id: "in", sprint_id: "s1", estimated_hours: 5 },
        { id: "out", sprint_id: "s2", estimated_hours: 20 },
      ],
      sprints: [
        { id: "s1", phase_id: "phase-1" },
        { id: "s2", phase_id: "phase-2" },
      ],
      logs: [{ task_id: "in", hours: 2 }, { task_id: "out", hours: 10 }],
      project,
    });

    expect(result).toMatchObject({ totalEst: 5, logged: 2, remaining: 3 });
  });

  it("returns clear errors when no estimates or project dates are available", () => {
    expect(computeBurndownData({
      burndownScope: "project", phases: [], tasks: [], sprints: [], logs: [], project,
    })).toEqual({ error: "No estimated tasks to show burndown." });

    expect(computeBurndownData({
      burndownScope: "project",
      phases: [],
      tasks: [{ id: "a", estimated_hours: 2 }],
      sprints: [],
      logs: [],
      project: { start_date: null, end_date: null },
    })).toEqual({ error: "Project needs start and end dates for burndown." });
  });

  it("never reports negative remaining work", () => {
    const result = computeBurndownData({
      burndownScope: "project",
      phases: [],
      tasks: [{ id: "a", estimated_hours: 2 }],
      sprints: [],
      logs: [{ task_id: "a", hours: 3 }],
      project,
    });

    expect(result).toMatchObject({ remaining: 0 });
  });
});

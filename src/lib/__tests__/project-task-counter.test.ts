import { describe, it, expect } from "vitest";
import {
  filterAdminWorkTasks,
  DEFAULT_ADMIN_WORK_FILTERS,
  type AdminWorkFilterState,
} from "@/components/project/AdminWorkFilters";

describe("filterAdminWorkTasks counter logic", () => {
  const mockSprints = [
    { id: "sprint-1", name: "Sprint 1", phase_id: "phase-1" },
    { id: "sprint-2", name: "Sprint 2", phase_id: "phase-2" },
  ];

  const mockTasks = [
    {
      id: "task-1",
      title: "Backend API setup",
      description: "Setup supabase auth and endpoints",
      status_id: "status-in-progress",
      sprint_id: "sprint-1",
      phase_id: "phase-1",
      assigned_to: "user-alice",
      due_date: "2026-11-20",
    },
    {
      id: "task-2",
      title: "Frontend Dashboard",
      description: "Build overview charts",
      status_id: "status-todo",
      sprint_id: "sprint-1",
      phase_id: "phase-1",
      assigned_to: "user-bob",
      due_date: null,
    },
    {
      id: "task-3",
      title: "Stripe integration",
      description: "Payment gateways",
      status_id: "status-done",
      sprint_id: "sprint-2",
      phase_id: "phase-2",
      assigned_to: "user-alice",
      due_date: "2026-10-15",
    },
    {
      id: "task-4",
      title: "Unassigned bug fix",
      description: "Fix button styling",
      status_id: "status-todo",
      sprint_id: null,
      phase_id: null,
      assigned_to: null,
      due_date: null,
    },
  ];

  it("returns all tasks when default filters are active", () => {
    const result = filterAdminWorkTasks(mockTasks, mockSprints, DEFAULT_ADMIN_WORK_FILTERS);
    expect(result.length).toBe(4);
  });

  it("filters and counts by status", () => {
    const filters: AdminWorkFilterState = {
      ...DEFAULT_ADMIN_WORK_FILTERS,
      statusId: "status-in-progress",
    };
    const result = filterAdminWorkTasks(mockTasks, mockSprints, filters);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("task-1");
  });

  it("filters and counts by assignee", () => {
    const filters: AdminWorkFilterState = {
      ...DEFAULT_ADMIN_WORK_FILTERS,
      assigneeId: "user-alice",
    };
    const result = filterAdminWorkTasks(mockTasks, mockSprints, filters);
    expect(result.length).toBe(2);
  });

  it("filters and counts by unassigned", () => {
    const filters: AdminWorkFilterState = {
      ...DEFAULT_ADMIN_WORK_FILTERS,
      assigneeId: "__unassigned__",
    };
    const result = filterAdminWorkTasks(mockTasks, mockSprints, filters);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("task-4");
  });

  it("filters and counts by sprint backlog", () => {
    const filters: AdminWorkFilterState = {
      ...DEFAULT_ADMIN_WORK_FILTERS,
      sprintId: "__backlog__",
    };
    const result = filterAdminWorkTasks(mockTasks, mockSprints, filters);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("task-4");
  });

  it("filters and counts by search query", () => {
    const filters: AdminWorkFilterState = {
      ...DEFAULT_ADMIN_WORK_FILTERS,
      search: "Dashboard",
    };
    const result = filterAdminWorkTasks(mockTasks, mockSprints, filters);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("task-2");
  });

  it("filters and counts by phase", () => {
    const filters: AdminWorkFilterState = {
      ...DEFAULT_ADMIN_WORK_FILTERS,
      phaseId: "phase-1",
    };
    const result = filterAdminWorkTasks(mockTasks, mockSprints, filters);
    expect(result.length).toBe(2);
  });

  it("filters and counts by due: none", () => {
    const filters: AdminWorkFilterState = {
      ...DEFAULT_ADMIN_WORK_FILTERS,
      due: "none",
    };
    const result = filterAdminWorkTasks(mockTasks, mockSprints, filters);
    expect(result.length).toBe(2);
  });
});

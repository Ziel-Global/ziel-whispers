import { describe, expect, it, vi } from "vitest";
import type { WorkflowStatus, WorkflowTransition } from "@/lib/workflow";

// The helpers under test are pure. Stub the database client so importing the
// module never needs Supabase environment variables or a network connection.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  getAllowedTransitions,
  getDoneStatusIds,
  getInitialStatus,
  getKanbanBoardStatuses,
  getStatusDisplay,
  isClientRole,
  isProjectVisibleToClientPortal,
  taskKanbanProgressPercent,
} from "@/lib/workflow";

const statuses: WorkflowStatus[] = [
  { id: "backlog", name: "Backlog", category: "todo", color: "gray", sort_order: 0, is_initial: true, retired: false },
  { id: "active", name: "In_Progress", category: "in_progress", color: "blue", sort_order: 1, is_initial: false, retired: false },
  { id: "done", name: "Done", category: "done", color: "green", sort_order: 2, is_initial: false, retired: false },
  { id: "retired", name: "Old Review", category: "in_progress", color: "gray", sort_order: 3, is_initial: false, retired: true },
];

describe("project workflow helpers", () => {
  it("returns only configured destinations from the current status and excludes retired destinations", () => {
    const transitions: WorkflowTransition[] = [
      { id: "t1", from_status_id: "backlog", to_status_id: "active" },
      { id: "t2", from_status_id: "backlog", to_status_id: "retired" },
      { id: "t3", from_status_id: "active", to_status_id: "done" },
    ];

    expect(getAllowedTransitions(statuses, transitions, "backlog").map((status) => status.id)).toEqual(["active"]);
    expect(getAllowedTransitions(statuses, transitions, "missing")).toEqual([]);
  });

  it("chooses a non-retired initial status, then falls back to the first active status", () => {
    expect(getInitialStatus(statuses)?.id).toBe("backlog");
    expect(getInitialStatus(statuses.map((status) => ({ ...status, is_initial: false })))?.id).toBe("backlog");
    expect(getInitialStatus(statuses.map((status) => ({ ...status, retired: true })))).toBeUndefined();
  });

  it("orders active Kanban columns with Backlog first and does not mutate the input", () => {
    const unordered = [statuses[2], statuses[3], statuses[1], statuses[0]];

    expect(getKanbanBoardStatuses(unordered).map((status) => status.id)).toEqual(["backlog", "active", "done"]);
    expect(unordered.map((status) => status.id)).toEqual(["done", "retired", "active", "backlog"]);
  });

  it("collects done statuses and formats a status for display", () => {
    expect([...getDoneStatusIds(statuses)]).toEqual(["done"]);
    expect(getStatusDisplay(statuses, "active")).toEqual({ name: "In Progress", color: "blue" });
    expect(getStatusDisplay(statuses, null)).toEqual({ name: "No Status", color: "bg-gray-100 text-gray-800" });
  });

  it.each([
    { role: "employee", expected: false },
    { role: "client", expected: true },
    { role: "client member", expected: true },
    { role: null, expected: false },
  ])("recognizes client roles ($role)", ({ role, expected }) => {
    expect(isClientRole(role === null ? null : { role })).toBe(expected);
  });

  it("hides archived projects from client portal listings", () => {
    expect(isProjectVisibleToClientPortal({ status: "active" })).toBe(true);
    expect(isProjectVisibleToClientPortal({ status: "archived" })).toBe(false);
  });

  it("calculates task progress from completion and workflow category", () => {
    expect(taskKanbanProgressPercent({}, statuses[0])).toBe(0);
    expect(taskKanbanProgressPercent({}, statuses[1])).toBe(50);
    expect(taskKanbanProgressPercent({}, statuses[2])).toBe(100);
    expect(taskKanbanProgressPercent({ completed_at: "2026-10-17T10:00:00Z" }, statuses[1])).toBe(100);
  });
});

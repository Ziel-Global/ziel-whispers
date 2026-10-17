import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: fromMock } }));

import { createTaskType, getTaskTypes } from "@/lib/taskTypesService";

describe("task type service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("combines organization and project types and applies a default color", async () => {
    const query: any = {
      select: vi.fn(),
      or: vi.fn(),
      then: (resolve: (value: unknown) => unknown) => resolve({
        data: [
          { id: "global", project_id: null, name: "Task", description: null, color: null, created_at: "now" },
          { id: "custom", project_id: "p1", name: "Incident", description: "Support issue", color: "red", created_at: "now" },
        ],
        error: null,
      }),
    };
    query.select.mockReturnValue(query);
    query.or.mockReturnValue(query);
    fromMock.mockReturnValue(query);

    await expect(getTaskTypes("p1")).resolves.toEqual([
      { id: "global", project_id: null, name: "Task", description: null, color: "bg-gray-100 text-gray-800", created_at: "now" },
      { id: "custom", project_id: "p1", name: "Incident", description: "Support issue", color: "red", created_at: "now" },
    ]);
    expect(query.or).toHaveBeenCalledWith("project_id.eq.p1,project_id.is.null");
  });

  it("returns no types when the query fails", async () => {
    const query: any = {
      select: vi.fn(),
      is: vi.fn(),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: new Error("offline") }),
    };
    query.select.mockReturnValue(query);
    query.is.mockReturnValue(query);
    fromMock.mockReturnValue(query);

    await expect(getTaskTypes(null)).resolves.toEqual([]);
    expect(query.is).toHaveBeenCalledWith("project_id", null);
  });

  it("creates a task type with normalized optional values", async () => {
    const query: any = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: { id: "type-1", project_id: null, name: "Task", description: null, color: "bg-gray-100 text-gray-800", created_at: "now" },
        error: null,
      }),
    };
    query.insert.mockReturnValue(query);
    query.select.mockReturnValue(query);
    fromMock.mockReturnValue(query);

    await expect(createTaskType({ name: "Task" })).resolves.toMatchObject({
      id: "type-1", project_id: null, description: null, color: "bg-gray-100 text-gray-800",
    });
    expect(query.insert).toHaveBeenCalledWith({
      project_id: null,
      name: "Task",
      description: null,
      color: "bg-gray-100 text-gray-800",
    });
  });

  it("reports task type creation errors with the attempted name", async () => {
    const query: any = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "duplicate" } }),
    };
    query.insert.mockReturnValue(query);
    query.select.mockReturnValue(query);
    fromMock.mockReturnValue(query);

    await expect(createTaskType({ name: "Bug" })).rejects.toThrow('Failed to create task type "Bug": duplicate');
  });
});

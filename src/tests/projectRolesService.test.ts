import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: fromMock } }));

import { getProjectRoles, hasProjectPermission, updateRolePermissions } from "@/lib/projectRolesService";

function userQuery(result: unknown) {
  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.single = vi.fn().mockResolvedValue(result);
  return query;
}

describe("project roles and permissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("grants system admins and managers the permission bypass", async () => {
    fromMock.mockReturnValueOnce(userQuery({ data: { role: "manager" }, error: null }));

    await expect(hasProjectPermission("user-1", "project-1", "tasks.delete")).resolves.toBe(true);
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("users");
  });

  it("resolves nested project permissions for an active member", async () => {
    const user = userQuery({ data: { role: "employee" }, error: null });
    const member: any = {};
    member.select = vi.fn(() => member);
    member.eq = vi.fn(() => member);
    member.is = vi.fn(() => member);
    member.maybeSingle = vi.fn().mockResolvedValue({
      data: { project_roles: { permissions: { workflow: { transition: true, retire: false } } } },
      error: null,
    });
    fromMock.mockReturnValueOnce(user).mockReturnValueOnce(member)
      .mockReturnValueOnce(user).mockReturnValueOnce(member);

    await expect(hasProjectPermission("user-1", "project-1", "workflow.transition")).resolves.toBe(true);
    await expect(hasProjectPermission("user-1", "project-1", "workflow.retire")).resolves.toBe(false);
  });

  it("denies access when membership or the requested nested key is missing", async () => {
    const user = userQuery({ data: { role: "employee" }, error: null });
    const member: any = {};
    member.select = vi.fn(() => member);
    member.eq = vi.fn(() => member);
    member.is = vi.fn(() => member);
    member.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValue(user).mockReturnValueOnce(user).mockReturnValueOnce(member);

    await expect(hasProjectPermission("user-1", "project-1", "tasks.create")).resolves.toBe(false);
  });

  it("normalizes missing role permission documents to an empty object", async () => {
    const query: any = {};
    query.select = vi.fn(() => query);
    query.or = vi.fn(() => query);
    query.then = (resolve: (value: unknown) => unknown) => resolve({
      data: [{ id: "r1", project_id: null, name: "Viewer", permissions: null, created_at: "now" }],
      error: null,
    });
    fromMock.mockReturnValue(query);

    await expect(getProjectRoles("project-1")).resolves.toMatchObject([{ id: "r1", permissions: {} }]);
  });

  it("surfaces role permission update failures", async () => {
    const query: any = {};
    query.update = vi.fn(() => query);
    query.eq = vi.fn().mockResolvedValue({ error: { message: "forbidden" } });
    fromMock.mockReturnValue(query);

    await expect(updateRolePermissions("role-1", { tasks: { create: true } }))
      .rejects.toThrow("Failed to update role permissions: forbidden");
  });
});

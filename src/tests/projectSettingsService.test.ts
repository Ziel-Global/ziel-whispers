import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: rpcMock, from: fromMock },
}));

import { getProjectSetting, setProjectSetting } from "@/lib/projectSettingsService";

function createSettingsQuery(results: Array<{ data: unknown; error?: unknown }>) {
  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.is = vi.fn(() => query);
  query.maybeSingle = vi.fn();
  results.forEach((result) => query.maybeSingle.mockResolvedValueOnce(result));
  return query;
}

describe("project settings resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the atomic RPC value when the database function succeeds", async () => {
    rpcMock.mockResolvedValue({ data: 10, error: null });

    await expect(getProjectSetting("project-1", "automation.max_chain_depth", 5)).resolves.toBe(10);
    expect(rpcMock).toHaveBeenCalledWith("get_project_setting", {
      p_project_id: "project-1",
      p_key: "automation.max_chain_depth",
      p_default: 5,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("falls back to the project-specific value when the RPC is unavailable", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("RPC unavailable") });
    const query = createSettingsQuery([{ data: { value: 8 } }]);
    fromMock.mockReturnValue(query);

    await expect(getProjectSetting("project-1", "automation.max_chain_depth", 5)).resolves.toBe(8);
    expect(query.eq).toHaveBeenNthCalledWith(1, "project_id", "project-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "key", "automation.max_chain_depth");
  });

  it("uses the organization default when the project has no override", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("RPC unavailable") });
    const query = createSettingsQuery([{ data: null }, { data: { value: 6 } }]);
    fromMock.mockReturnValue(query);

    await expect(getProjectSetting("project-1", "automation.max_chain_depth", 5)).resolves.toBe(6);
    expect(query.maybeSingle).toHaveBeenCalledTimes(2);
    expect(query.is).toHaveBeenCalledWith("project_id", null);
  });

  it("returns the supplied fallback when no project or organization value exists", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("RPC unavailable") });
    const query = createSettingsQuery([{ data: null }, { data: null }]);
    fromMock.mockReturnValue(query);

    await expect(getProjectSetting(null, "automation.max_chain_depth", 5)).resolves.toBe(5);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("surfaces setting write errors with the key in the message", async () => {
    rpcMock.mockReset();
    const query: any = { upsert: vi.fn().mockResolvedValue({ error: { message: "permission denied" } }) };
    fromMock.mockReturnValue(query);

    await expect(setProjectSetting("project-1", "automation.max_chain_depth", 8))
      .rejects.toThrow('Failed to set project setting "automation.max_chain_depth": permission denied');
  });
});

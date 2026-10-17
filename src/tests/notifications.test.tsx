import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, channelMock, removeChannelMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  channelMock: vi.fn(),
  removeChannelMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromMock, channel: channelMock, removeChannel: removeChannelMock },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: { id: "user-1" } }),
}));

import { useNotifications } from "@/lib/notifications";

function createQuery(data: unknown, error: unknown = null) {
  const query: any = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.update = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown) => resolve({ data, error });
  return query;
}

function mountNotifications() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useNotifications(), { wrapper });
  return { ...hook, queryClient };
}

describe("notification inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const subscription: any = {};
    subscription.on = vi.fn(() => subscription);
    subscription.subscribe = vi.fn(() => subscription);
    channelMock.mockReturnValue(subscription);
  });

  it("loads the signed-in user's in-app notifications and counts unread items", async () => {
    const notifications = [
      { id: "n1", user_id: "user-1", channel: "in_app", read: false },
      { id: "n2", user_id: "user-1", channel: "in_app", read: true },
    ];
    fromMock.mockReturnValue(createQuery(notifications));

    const { result, unmount, queryClient } = mountNotifications();
    await waitFor(() => expect(result.current.notifications).toEqual(notifications));
    expect(result.current.unreadCount).toBe(1);
    expect(channelMock).toHaveBeenCalledWith("notifications-realtime");

    unmount();
    queryClient.clear();
  });

  it("marks one notification as read for the current user", async () => {
    const query = createQuery([]);
    fromMock.mockReturnValue(query);

    const { result, unmount, queryClient } = mountNotifications();
    await waitFor(() => expect(result.current.notifications).toEqual([]));
    act(() => result.current.markAsRead("n1"));

    await waitFor(() => expect(query.update).toHaveBeenCalledWith({ read: true }));
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");

    unmount();
    queryClient.clear();
  });

  it("marks all unread notifications as read", async () => {
    const query = createQuery([]);
    fromMock.mockReturnValue(query);

    const { result, unmount, queryClient } = mountNotifications();
    await waitFor(() => expect(result.current.notifications).toEqual([]));
    act(() => result.current.markAllAsRead());

    await waitFor(() => expect(query.update).toHaveBeenCalledWith({ read: true }));
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith("read", false);

    unmount();
    queryClient.clear();
  });
});

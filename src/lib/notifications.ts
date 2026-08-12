"use client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCallback, useEffect } from "react";

type Notification = {
  id: string;
  user_id: string;
  type: string;
  channel: string;
  status: string;
  retry_count: number;
  triggered_at: string;
  sent_at: string | null;
  metadata: any;
  read: boolean;
};

export function useNotifications() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .eq("channel", "in_app")
        .order("triggered_at", { ascending: false });
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!profile?.id,
  });

  const { mutate: markAsRead } = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)
        .eq("user_id", profile?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications", profile?.id],
      });
    },
  });

  const { mutate: markAllAsRead } = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", profile?.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications", profile?.id],
      });
      toast.success("All notifications marked as read");
    },
  });

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["notifications", profile.id],
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, queryClient]);

  return { notifications, isLoading, unreadCount, markAsRead, markAllAsRead };
}

"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "project_update":
      return "📝";
    case "action_item_created":
      return "✅";
    case "action_item_completed":
      return "✔️";
    case "blocker_created":
      return "⚠️";
    case "blocker_resolved":
      return "🔧";
    case "leave_request":
      return "📅";
    case "remote_work_request":
      return "🏠";
    case "task_returned":
      return "🔄";
    case "task_assigned":
      return "👤";
    default:
      return "🔔";
  }
};

export default function NotificationsPage() {
  const { profile } = useAuth();
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();
  const navigate = useNavigate();

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {notifications && notifications.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllAsRead()}>
            Mark all as read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-sm text-muted-foreground">
          Loading...
        </div>
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const meta = notification.metadata as {
              title?: string;
              message?: string;
              project_id?: string;
            };
            return (
              <Card
                key={notification.id}
                className={`p-4 cursor-pointer transition-colors hover:bg-accent/50 ${!notification.read ? "bg-blue-50 border-blue-200" : ""}`}
                onClick={() => {
                  if (!notification.read) markAsRead(notification.id);
                  if (meta?.project_id)
                    navigate(`/projects/${meta.project_id}`);
                }}
              >
                <div className="flex gap-3">
                  <div className="text-2xl mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm font-medium ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {meta?.title || notification.type}
                      </p>
                      <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDistanceToNow(
                          new Date(notification.triggered_at),
                          { addSuffix: true },
                        )}
                      </p>
                    </div>
                    {meta?.message && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {meta.message}
                      </p>
                    )}
                    {meta?.project_id && (
                      <span className="text-xs text-blue-600 mt-1 inline-block">
                        Project notification
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🔔</div>
          <p className="text-sm text-muted-foreground">No notifications</p>
        </div>
      )}
    </div>
  );
}

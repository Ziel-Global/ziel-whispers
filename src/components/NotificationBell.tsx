"use client";
import { Bell } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function NotificationBell() {
  const { profile } = useAuth();
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

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

  const formatMessage = (msg: string) => {
    if (msg.length > 100) {
      return msg.substring(0, 100) + "...";
    }
    return msg;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
              {unreadCount > 8 ? "8+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0" sideOffset={5}>
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">Notifications</h3>
          {notifications && notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="h-auto p-0 text-sm font-normal text-muted-foreground hover:text-foreground"
            >
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px] [&>div>div>div]:bg-muted-foreground/30">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : notifications && notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => {
                const meta = notification.metadata as { title?: string; message?: string; project_id?: string };
                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-accent/50 cursor-pointer transition-colors ${!notification.read ? "bg-blue-50" : ""}`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className="text-2xl mt-0.5">{getNotificationIcon(notification.type)}</div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium truncate ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>{meta?.title || notification.type}</p>
                          <p className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {formatDistanceToNow(new Date(notification.triggered_at), { addSuffix: true })}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 break-words">{formatMessage(meta?.message || "")}</p>
                        {meta?.project_id && (
                          <span className="text-xs text-blue-600">Project notification</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">No notifications</div>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-sm"
            onClick={() => { setIsOpen(false); navigate("/notifications"); }}
          >
            Show all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

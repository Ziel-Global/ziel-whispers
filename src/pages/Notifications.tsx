"use client";
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/lib/notifications";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Calendar, Home, Check, AlertTriangle, Bell, ChevronLeft, ChevronRight } from "lucide-react";

const getNotificationBadge = (type: string, isBulk?: boolean) => {
  if (isBulk || type === "task_created_bulk" || type === "action_item_created" || type === "project_update") {
    return {
      bg: "bg-[#FDECE3]",
      color: "text-[#EB5A1E]",
      icon: <LayoutGrid className="h-4.5 w-4.5 text-[#EB5A1E]" />,
    };
  }
  if (type.includes("leave")) {
    return {
      bg: "bg-[#EAF3FF]",
      color: "text-[#1C6FC9]",
      icon: <Calendar className="h-4.5 w-4.5 text-[#1C6FC9]" />,
    };
  }
  if (type.includes("remote") || type.includes("wfh")) {
    return {
      bg: "bg-[#F6E6FF]",
      color: "text-[#9333EA]",
      icon: <Home className="h-4.5 w-4.5 text-[#9333EA]" />,
    };
  }
  if (type.includes("completed") || type.includes("resolved")) {
    return {
      bg: "bg-[#DFF6E4]",
      color: "text-[#1FAA59]",
      icon: <Check className="h-4.5 w-4.5 text-[#1FAA59]" />,
    };
  }
  if (type.includes("blocker")) {
    return {
      bg: "bg-[#FDECEC]",
      color: "text-[#C23A3A]",
      icon: <AlertTriangle className="h-4.5 w-4.5 text-[#C23A3A]" />,
    };
  }
  return {
    bg: "bg-[#EAF3FF]",
    color: "text-[#1C6FC9]",
    icon: <Bell className="h-4.5 w-4.5 text-[#1C6FC9]" />,
  };
};

const ITEMS_PER_PAGE = 20;

export default function NotificationsPage() {
  const { profile } = useAuth();
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = notifications?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);

  const paginatedNotifications = notifications?.slice(startIndex, endIndex) || [];

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-1 flex-wrap gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.5px] text-[#17171A]">Notifications</h1>
          <p className="text-[13px] text-[#8B8B92] font-normal mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {notifications && notifications.length > 0 && (
          <button
            type="button"
            onClick={() => markAllAsRead()}
            className="flex items-center gap-2 bg-white border border-black/[0.08] hover:bg-[#F6F5F3] text-[#4B4B52] font-semibold rounded-[10px] px-4 py-2 text-[13px] transition-colors shadow-sm whitespace-nowrap"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="bg-white border border-black/[0.08] rounded-[14px] p-12 text-center text-[#8B8B92] text-sm shadow-sm">
          Loading notifications…
        </div>
      ) : totalItems > 0 ? (
        <div className="space-y-3">
          {paginatedNotifications.map((notification) => {
            const meta = notification.metadata as { title?: string; message?: string; project_id?: string; is_bulk?: boolean };
            const badge = getNotificationBadge(notification.type, meta?.is_bulk);
            const isUnread = !notification.read;

            return (
              <div
                key={notification.id}
                onClick={() => {
                  if (isUnread) markAsRead(notification.id);
                  if (meta?.project_id) navigate(`/projects/${meta.project_id}`);
                }}
                className={`p-4 sm:p-5 rounded-[12px] cursor-pointer transition-all flex items-start gap-4 shadow-sm ${
                  isUnread
                    ? "bg-[#EAF3FF]/40 border border-[#1C6FC9]/25 hover:bg-[#EAF3FF]/60"
                    : "bg-white border border-black/[0.08] hover:bg-[#F6F5F3]/60"
                }`}
              >
                {/* Icon Box */}
                <div className={`w-[38px] h-[38px] rounded-[10px] ${badge.bg} flex items-center justify-center shrink-0`}>
                  {badge.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className={`text-[14px] font-bold ${isUnread ? "text-[#17171A]" : "text-[#4B4B52]"}`}>
                      {meta?.title || notification.type}
                    </p>
                    <span className="text-[12px] text-[#8B8B92] whitespace-nowrap shrink-0">
                      {formatDistanceToNow(new Date(notification.triggered_at), { addSuffix: true })}
                    </span>
                  </div>

                  {meta?.message && (
                    <p className="text-[13px] text-[#4B4B52] leading-relaxed">{meta.message}</p>
                  )}

                  {meta?.project_id && (
                    <span className="text-[12.5px] text-[#1C6FC9] font-semibold hover:underline mt-1.5 inline-block">
                      Project notification
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination Toolbar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white border border-black/[0.08] rounded-[14px] px-5 py-3 shadow-sm text-[13px] text-[#4B4B52] mt-4">
              <span className="text-[#8B8B92]">
                Showing <span className="font-semibold text-[#17171A]">{startIndex + 1}</span> to{" "}
                <span className="font-semibold text-[#17171A]">{endIndex}</span> of{" "}
                <span className="font-semibold text-[#17171A]">{totalItems}</span> notifications
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 bg-white border border-black/[0.08] hover:bg-[#F6F5F3] disabled:opacity-40 text-[#4B4B52] font-semibold rounded-[8px] px-3 py-1.5 text-[12.5px] transition-colors shadow-sm"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>

                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNum = idx + 1;
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-8 w-8 rounded-[8px] text-[12.5px] font-bold transition-all shadow-sm ${
                        isActive
                          ? "bg-[#17171A] text-white"
                          : "bg-white border border-black/[0.08] text-[#4B4B52] hover:bg-[#F6F5F3]"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 bg-white border border-black/[0.08] hover:bg-[#F6F5F3] disabled:opacity-40 text-[#4B4B52] font-semibold rounded-[8px] px-3 py-1.5 text-[12.5px] transition-colors shadow-sm"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-black/[0.08] rounded-[14px] p-16 text-center shadow-sm">
          <div className="w-12 h-12 rounded-[12px] bg-[#F6F5F3] text-[#8B8B92] flex items-center justify-center mx-auto mb-3">
            <Bell className="h-6 w-6 text-[#8B8B92]" />
          </div>
          <p className="text-[14px] font-semibold text-[#17171A]">No notifications</p>
          <p className="text-[12.5px] text-[#8B8B92] mt-1">You are all caught up!</p>
        </div>
      )}
    </div>
  );
}


import React from "react";
import { formatDistanceToNow } from "date-fns";

export interface AuditLogItem {
  id: string;
  action: string;
  created_at: string;
  users?: {
    full_name?: string | null;
  } | null;
}

export interface RecentActivityFeedProps {
  logs?: AuditLogItem[];
  onViewAll?: () => void;
}

export function RecentActivityFeed({ logs = [], onViewAll }: RecentActivityFeedProps) {
  const getInitials = (name: string) => {
    if (!name) return "SY";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColors = (index: number) => {
    const palette = [
      { bg: "#FDECE3", color: "#EB5A1E" },
      { bg: "#E6E9FF", color: "#4C57D9" },
      { bg: "#DFF6E4", color: "#1FAA59" },
      { bg: "#FDF3E3", color: "#C7860F" },
      { bg: "#F6E6FF", color: "#9333EA" },
    ];
    return palette[index % palette.length];
  };

  return (
    <div className="bg-white border border-black/10 rounded-[14px] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[14.5px] font-bold text-[#17171A]">Recent Activity</div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-[#EB5A1E] hover:text-[#C64715] transition-colors"
          >
            View All →
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-[#8B8B92] py-4">No recent activity recorded.</p>
      ) : (
        <div className="divide-y divide-black/[0.06]">
          {logs.map((a, idx) => {
            const name = a.users?.full_name || "System";
            const initials = getInitials(name);
            const { bg, color } = getAvatarColors(idx);
            const timeAgo = formatDistanceToNow(new Date(a.created_at), { addSuffix: true });
            const actionText = a.action.replace(/\./g, " → ");

            return (
              <div key={a.id} className="flex items-center justify-between py-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0"
                    style={{ backgroundColor: bg, color }}
                  >
                    {initials}
                  </div>
                  <div className="text-xs text-[#17171A] truncate">
                    <span className="font-bold mr-1.5">{name}</span>
                    <span className="text-[#8B8B92]">{actionText}</span>
                  </div>
                </div>
                <div className="text-[11.5px] text-[#B0B0B6] shrink-0 pl-3">{timeAgo}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

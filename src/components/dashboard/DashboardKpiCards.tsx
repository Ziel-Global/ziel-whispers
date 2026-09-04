import React from "react";
import { Info } from "lucide-react";

export interface DashboardKpiCardsProps {
  stats?: {
    activeEmployees?: number;
    activeProjects?: number;
    todayClockedIn?: number;
    pendingLeaves?: number;
  };
  onNavigate: (path: string) => void;
}

export function DashboardKpiCards({ stats, onNavigate }: DashboardKpiCardsProps) {
  const activeEmployees = stats?.activeEmployees ?? 0;
  const activeProjects = stats?.activeProjects ?? 0;
  const todayClockedIn = stats?.todayClockedIn ?? 0;
  const pendingLeaves = stats?.pendingLeaves ?? 0;

  // Calculate attendance percentage for the donut ring progress
  const attendancePct = activeEmployees > 0 ? Math.round((todayClockedIn / activeEmployees) * 100) : 0;
  const dashoffset = 94.2 - (94.2 * attendancePct) / 100;

  return (
    <div className="bg-white border border-black/10 rounded-[14px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.07] overflow-hidden shadow-sm">
      {/* Card 1: Active Employees */}
      <div className="p-5 flex flex-col justify-between gap-3 min-w-0">
        <div className="flex items-center gap-1.5 text-[#8B8B92] text-xs font-medium whitespace-nowrap">
          Active Employees
          <Info className="h-3 w-3 text-[#C6C6CC]" />
        </div>
        <div className="flex items-end justify-between gap-2.5 min-w-0">
          <div className="min-w-0">
            <div className="text-2xl font-bold tracking-tight text-[#17171A]">{activeEmployees}</div>
            <div className="flex items-center gap-1 text-xs text-[#8B8B92] mt-1 whitespace-nowrap">
              vs last week
              <span className="text-[#1FAA59] font-semibold flex items-center gap-0.5">↑ 2</span>
            </div>
          </div>
          {/* Bar sparkline */}
          <svg width="56" height="34" viewBox="0 0 56 34" className="shrink-0">
            <rect x="0" y="16" width="10" height="18" rx="2" fill="#EB5A1E" opacity="0.5" />
            <rect x="16" y="8" width="10" height="26" rx="2" fill="#EB5A1E" opacity="0.75" />
            <rect x="32" y="0" width="10" height="34" rx="2" fill="#EB5A1E" />
          </svg>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("/employees")}
          className="border-t border-black/[0.06] -mx-5 pt-3 px-5 text-xs font-semibold text-[#17171A] flex items-center gap-1.5 hover:text-[#EB5A1E] transition-colors text-left"
        >
          See Details <span className="text-[#EB5A1E]">→</span>
        </button>
      </div>

      {/* Card 2: Active Projects */}
      <div className="p-5 flex flex-col justify-between gap-3 min-w-0">
        <div className="flex items-center gap-1.5 text-[#8B8B92] text-xs font-medium whitespace-nowrap">
          Active Projects
          <Info className="h-3 w-3 text-[#C6C6CC]" />
        </div>
        <div className="flex items-end justify-between gap-2.5 min-w-0">
          <div className="min-w-0">
            <div className="text-2xl font-bold tracking-tight text-[#17171A]">{activeProjects}</div>
            <div className="flex items-center gap-1 text-xs text-[#8B8B92] mt-1 whitespace-nowrap">
              vs last week
              <span className="text-[#1FAA59] font-semibold flex items-center gap-0.5">↑ 1</span>
            </div>
          </div>
          {/* Sparkline path */}
          <svg width="60" height="30" viewBox="0 0 60 30" className="shrink-0">
            <path d="M2 22 L14 16 L24 24 L36 6 L48 12 L58 4" fill="none" stroke="#EB5A1E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("/projects")}
          className="border-t border-black/[0.06] -mx-5 pt-3 px-5 text-xs font-semibold text-[#17171A] flex items-center gap-1.5 hover:text-[#EB5A1E] transition-colors text-left"
        >
          See Details <span className="text-[#EB5A1E]">→</span>
        </button>
      </div>

      {/* Card 3: Today's Attendance */}
      <div className="p-5 flex flex-col justify-between gap-3 min-w-0">
        <div className="flex items-center gap-1.5 text-[#8B8B92] text-xs font-medium whitespace-nowrap">
          Today's Attendance
          <Info className="h-3 w-3 text-[#C6C6CC]" />
        </div>
        <div className="flex items-end justify-between gap-2.5 min-w-0">
          <div className="min-w-0">
            <div className="text-2xl font-bold tracking-tight text-[#17171A]">
              {todayClockedIn}<span className="text-base text-[#8B8B92] font-medium">/{activeEmployees}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-[#8B8B92] mt-1 whitespace-nowrap">
              vs yesterday
              <span className="text-[#8B8B92] font-semibold flex items-center gap-0.5">· {attendancePct}%</span>
            </div>
          </div>
          {/* Progress circle */}
          <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0 transform -rotate-90">
            <circle cx="20" cy="20" r="15" fill="none" stroke="#F3E9E3" strokeWidth="5" />
            <circle
              cx="20"
              cy="20"
              r="15"
              fill="none"
              stroke="#EB5A1E"
              strokeWidth="5"
              strokeDasharray="94.2"
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
            />
          </svg>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("/attendance")}
          className="border-t border-black/[0.06] -mx-5 pt-3 px-5 text-xs font-semibold text-[#17171A] flex items-center gap-1.5 hover:text-[#EB5A1E] transition-colors text-left"
        >
          See Details <span className="text-[#EB5A1E]">→</span>
        </button>
      </div>

      {/* Card 4: Pending Leave */}
      <div className="p-5 flex flex-col justify-between gap-3 min-w-0">
        <div className="flex items-center gap-1.5 text-[#8B8B92] text-xs font-medium whitespace-nowrap">
          Pending Leave
          <Info className="h-3 w-3 text-[#C6C6CC]" />
        </div>
        <div className="flex items-end justify-between gap-2.5 min-w-0">
          <div className="min-w-0">
            <div className="text-2xl font-bold tracking-tight text-[#17171A]">{pendingLeaves}</div>
            <div className="flex items-center gap-1 text-xs text-[#8B8B92] mt-1 whitespace-nowrap">
              vs last week
              <span className="text-[#E5484D] font-semibold flex items-center gap-0.5">↓ 3</span>
            </div>
          </div>
          {/* Multi-bar graph */}
          <svg width="52" height="30" viewBox="0 0 52 30" className="shrink-0">
            <rect x="0" y="10" width="6" height="20" rx="2" fill="#EB5A1E" opacity="0.35" />
            <rect x="10" y="4" width="6" height="26" rx="2" fill="#EB5A1E" opacity="0.6" />
            <rect x="20" y="14" width="6" height="16" rx="2" fill="#EB5A1E" opacity="0.4" />
            <rect x="30" y="0" width="6" height="30" rx="2" fill="#EB5A1E" />
            <rect x="40" y="8" width="6" height="22" rx="2" fill="#EB5A1E" opacity="0.55" />
          </svg>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("/leave/requests")}
          className="border-t border-black/[0.06] -mx-5 pt-3 px-5 text-xs font-semibold text-[#17171A] flex items-center gap-1.5 hover:text-[#EB5A1E] transition-colors text-left"
        >
          See Details <span className="text-[#EB5A1E]">→</span>
        </button>
      </div>
    </div>
  );
}

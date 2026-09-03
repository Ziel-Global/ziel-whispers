import React from "react";
import { Info } from "lucide-react";

export interface WorkforceSplitDonutProps {
  totalEmployees?: number;
  onsiteCount?: number;
  remoteCount?: number;
  growthPct?: string;
}

export function WorkforceSplitDonut({
  totalEmployees = 99,
  onsiteCount = 67,
  remoteCount = 32,
  growthPct = "↑ 8.5%",
}: WorkforceSplitDonutProps) {
  // Compute percentage split for smooth donut gradient rendering
  const total = (onsiteCount + remoteCount) || 1;
  const onsiteDeg = Math.round((onsiteCount / total) * 360);

  return (
    <div className="bg-white border border-black/[0.08] rounded-[14px] p-[22px] flex flex-col justify-between shadow-sm min-w-0 h-full font-sans">
      {/* Title */}
      <div className="flex items-center gap-[6px] text-[14.5px] font-bold text-[#17171A] mb-[16px]">
        Workforce Split
        <Info className="h-3.5 w-3.5 text-[#C6C6CC]" />
      </div>

      {/* Metric summary */}
      <div>
        <div className="text-[28px] font-bold tracking-[-0.5px] text-[#17171A]">{totalEmployees}</div>
        <div className="flex items-center gap-[6px] text-[12px] text-[#8B8B92] mt-[3px]">
          Total employees <span className="text-[#1FAA59] font-bold">{growthPct}</span>
        </div>
      </div>

      {/* Donut Chart Ring */}
      <div className="flex-1 flex items-center justify-center p-[10px_0]">
        <div
          className="w-[170px] h-[170px] rounded-full flex items-center justify-center relative shadow-sm transition-all duration-500"
          style={{
            background: `conic-gradient(#EB5A1E 0deg ${onsiteDeg}deg, #F6D3B8 ${onsiteDeg}deg 360deg)`,
          }}
        >
          {/* Inner cutout hole */}
          <div className="w-[96px] h-[96px] rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
            <span className="text-[20px] font-bold text-[#17171A] leading-none">{totalEmployees}</span>
            <span className="text-[10px] text-[#8B8B92] font-medium mt-0.5">Staff</span>
          </div>
        </div>
      </div>

      {/* Legend list */}
      <div className="flex flex-col gap-[10px] mt-[6px]">
        <div className="flex items-center justify-between text-[13px]">
          <div className="flex items-center gap-[8px]">
            <span className="w-[9px] h-[9px] rounded-full bg-[#EB5A1E]" />
            <span>On-site</span>
          </div>
          <span className="font-bold text-[#17171A]">{onsiteCount}</span>
        </div>

        <div className="flex items-center justify-between text-[13px]">
          <div className="flex items-center gap-[8px]">
            <span className="w-[9px] h-[9px] rounded-full bg-[#F6D3B8]" />
            <span>Remote</span>
          </div>
          <span className="font-bold text-[#17171A]">{remoteCount}</span>
        </div>
      </div>
    </div>
  );
}

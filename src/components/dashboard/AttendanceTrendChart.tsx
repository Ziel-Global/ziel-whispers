import React, { useState } from "react";
import { Info, ChevronDown } from "lucide-react";

export interface AttendanceTrendItem {
  name: string;
  attendancePct: number;
  late: number;
  heightPct: number;
}

export interface AttendanceTrendChartProps {
  data?: AttendanceTrendItem[];
  selectedYear?: string;
  yearsList?: string[];
  onYearChange?: (year: string) => void;
}

const DEFAULT_TREND_MONTHS: AttendanceTrendItem[] = [
  { name: "Jan", attendancePct: 65, late: 4, heightPct: 65 },
  { name: "Feb", attendancePct: 68, late: 3, heightPct: 68 },
  { name: "Mar", attendancePct: 62, late: 5, heightPct: 62 },
  { name: "Apr", attendancePct: 72, late: 2, heightPct: 72 },
  { name: "May", attendancePct: 75, late: 2, heightPct: 75 },
  { name: "Jun", attendancePct: 96, late: 1, heightPct: 96 },
  { name: "Jul", attendancePct: 64, late: 4, heightPct: 64 },
  { name: "Aug", attendancePct: 58, late: 6, heightPct: 58 },
  { name: "Sept", attendancePct: 92, late: 1, heightPct: 92 },
  { name: "Okt", attendancePct: 69, late: 3, heightPct: 69 },
  { name: "Nov", attendancePct: 67, late: 4, heightPct: 67 },
  { name: "Dec", attendancePct: 71, late: 2, heightPct: 71 },
];

export function AttendanceTrendChart({
  data = DEFAULT_TREND_MONTHS,
  selectedYear = "This Year",
  yearsList = ["This Year", "2025", "2024"],
  onYearChange,
}: AttendanceTrendChartProps) {
  // Automatically detect the current present month (0-indexed: Sept = 8)
  const currentMonthIdx = Math.min(11, Math.max(0, new Date().getMonth()));
  const [activeIdx, setActiveIdx] = useState<number>(currentMonthIdx);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);

  return (
    <div className="bg-white border border-black/[0.08] rounded-[14px] p-[22px] flex flex-col justify-between shadow-sm min-w-0 h-full font-sans">
      {/* Top Header Controls - Only Year Dropdown */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
        <div className="flex items-center gap-1.5 text-[14.5px] font-bold text-[#17171A]">
          Attendance Trend
          <Info className="h-3.5 w-3.5 text-[#C6C6CC]" />
        </div>

        {/* Year Selector Dropdown Only */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
            className="flex items-center gap-1.5 border border-black/[0.08] rounded-[9px] px-3 py-1.75 text-[12.5px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] transition-colors"
          >
            {selectedYear}
            <ChevronDown className="h-3 w-3 text-[#4B4B52]" />
          </button>
          {yearDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-black/[0.08] rounded-[9px] shadow-lg p-1 min-w-[110px] z-30">
              {yearsList.map((y) => (
                <div
                  key={y}
                  onClick={() => {
                    if (onYearChange) onYearChange(y);
                    setYearDropdownOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-[6px] text-[12px] font-medium text-[#4B4B52] hover:bg-[#F6F5F3] cursor-pointer"
                >
                  {y}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart Layout Container */}
      <div className="flex-1 flex items-stretch gap-3.5 min-h-[220px] pt-2">
        {/* Y-Axis Ticks */}
        <div className="flex flex-col justify-between text-[11.5px] text-[#B0B0B6] pb-5 text-right shrink-0 select-none font-medium">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0</span>
        </div>

        {/* 12 Bar Columns Container - On mouse leave, reverts to present month */}
        <div
          onMouseLeave={() => setActiveIdx(currentMonthIdx)}
          className="flex-1 grid grid-cols-12 items-end gap-2 relative pt-20 min-w-0"
        >
          {data.map((m, idx) => {
            const isHighlighted = idx === activeIdx;
            const barColor = isHighlighted ? "#EB5A1E" : "#F6ECE5";
            const labelColor = isHighlighted ? "#17171A" : "#8B8B92";
            const labelWeight = isHighlighted ? 700 : 500;

            return (
              <div
                key={m.name}
                onMouseEnter={() => setActiveIdx(idx)}
                className="flex flex-col items-center gap-2 h-full justify-end relative cursor-pointer group"
              >
                {/* Floating Tooltip */}
                {isHighlighted && (
                  <div className="absolute bottom-full mb-2.5 bg-[#17171A] text-white rounded-[9px] p-3 text-[11.5px] whitespace-nowrap z-20 shadow-[0_8px_18px_rgba(0,0,0,0.18)] left-1/2 -translate-x-1/2 pointer-events-none">
                    <div className="font-bold mb-1 text-white">{m.name}, 2026</div>
                    <div className="flex justify-between gap-4 text-white/70">
                      <span>Attendance</span>
                      <span className="text-white font-semibold">{m.attendancePct}%</span>
                    </div>
                    <div className="flex justify-between gap-4 text-white/70">
                      <span>Late logs</span>
                      <span className="text-white font-semibold">{m.late}</span>
                    </div>
                  </div>
                )}

                {/* Bar */}
                <div
                  className="w-full max-w-[26px] rounded-t-[6px] transition-colors duration-200"
                  style={{
                    backgroundColor: barColor,
                    height: `${m.heightPct}%`,
                    minHeight: "4px",
                  }}
                />

                {/* X-Axis Month Label */}
                <div
                  className="text-[11.5px] transition-colors duration-200"
                  style={{ color: labelColor, fontWeight: labelWeight }}
                >
                  {m.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

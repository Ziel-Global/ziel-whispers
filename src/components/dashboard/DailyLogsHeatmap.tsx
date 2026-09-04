import React from "react";

export interface HeatmapCell {
  count: number;
  dateStr?: string;
}

export interface HeatmapRow {
  label: string;
  cells: HeatmapCell[];
}

export interface DailyLogsHeatmapProps {
  rows?: HeatmapRow[];
  weekDays?: string[];
}

const DEFAULT_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_ROWS: HeatmapRow[] = [
  {
    label: "3 Wks Ago",
    cells: [
      { count: 12 }, { count: 18 }, { count: 25 }, { count: 30 }, { count: 22 }, { count: 5 }, { count: 0 },
    ],
  },
  {
    label: "2 Wks Ago",
    cells: [
      { count: 15 }, { count: 22 }, { count: 28 }, { count: 35 }, { count: 20 }, { count: 0 }, { count: 2 },
    ],
  },
  {
    label: "Last Week",
    cells: [
      { count: 18 }, { count: 24 }, { count: 32 }, { count: 40 }, { count: 26 }, { count: 4 }, { count: 0 },
    ],
  },
  {
    label: "This Week",
    cells: [
      { count: 20 }, { count: 29 }, { count: 38 }, { count: 45 }, { count: 12 }, { count: 0 }, { count: 0 },
    ],
  },
];

export function getHeatmapColor(count: number): string {
  if (count <= 0) return "#F3E9E3";
  if (count <= 15) return "#F6C29E";
  if (count <= 30) return "#F19257";
  return "#EB5A1E";
}

export function DailyLogsHeatmap({
  rows = DEFAULT_ROWS,
  weekDays = DEFAULT_WEEKDAYS,
}: DailyLogsHeatmapProps) {
  return (
    <div className="bg-white border border-black/[0.08] rounded-[14px] p-[22px] shadow-sm font-sans min-w-0 h-full flex flex-col justify-between">
      {/* Header & Legend */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
        <div className="text-[14.5px] font-bold text-[#17171A]">Daily Logs Activity</div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-[11.5px] text-[#8B8B92]">
          <span>Low</span>
          <div className="flex items-center gap-[3px]">
            <div className="w-[16px] h-[9px] rounded-[3px] bg-[#F3E9E3]" title="0 - 5 logs" />
            <div className="w-[16px] h-[9px] rounded-[3px] bg-[#F6C29E]" title="6 - 15 logs" />
            <div className="w-[16px] h-[9px] rounded-[3px] bg-[#F19257]" title="16 - 30 logs" />
            <div className="w-[16px] h-[9px] rounded-[3px] bg-[#EB5A1E]" title="31+ logs" />
          </div>
          <span>High</span>
        </div>
      </div>

      {/* Grid Matrix: 70px label column + 7 weekday columns */}
      <div className="grid grid-cols-[70px_repeat(7,1fr)] gap-2 items-center min-w-0">
        {/* Header Row: Empty top-left cell + Weekday labels */}
        <div />
        {weekDays.map((d) => (
          <div key={d} className="text-center text-[12px] text-[#8B8B92] font-semibold">
            {d}
          </div>
        ))}

        {/* Data Rows */}
        {rows.map((row, rIdx) => (
          <React.Fragment key={row.label || rIdx}>
            {/* Row Label */}
            <div className="text-[11.5px] text-[#8B8B92] font-medium whitespace-nowrap truncate">
              {row.label}
            </div>

            {/* 7 Cell Blocks */}
            {row.cells.slice(0, 7).map((cell, cIdx) => {
              const bg = getHeatmapColor(cell.count);

              return (
                <div
                  key={cIdx}
                  title={cell.dateStr ? `${cell.dateStr}: ${cell.count} logs` : `${cell.count} logs`}
                  className="h-[34px] rounded-[8px] transition-transform duration-150 hover:scale-105 cursor-pointer shadow-none"
                  style={{ backgroundColor: bg }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

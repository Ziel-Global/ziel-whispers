/**
 * Admin user-detail — Logged Hours tab (ud-* layout from zielAdmin mock).
 *
 * IMPLEMENTED (wired):
 *   - Summary card: month picker, hero, 4 stats with derived subs
 *   - Daily Hours Trend: one bar per working day in the selected month
 *   - Overtime hours always shown (even if overtime_enabled is false)
 *
 * NOTE vs mock: mock used a fixed 14-bar demo; we render all working days
 * for the selected month (scrollable when many).
 */
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { formatHours } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface EmployeeLoggedHoursTabProps {
  loggedHoursMonth: string;
  setLoggedHoursMonth: (v: string) => void;
  monthStart: string;
  monthlyStats: {
    expectedHours: number;
    loggedHours: number;
    unloggedHours: number;
    overtimeHours: number;
    overtimeEnabled: boolean;
    workingDayCount: number;
    coveragePct: number;
    overtimeEntryCount: number;
    expectedDailyHours: number;
    dailyBars: {
      date: string;
      dayLabel: string;
      hours: number;
      heightPct: number;
      isZero: boolean;
    }[];
  };
}

export function EmployeeLoggedHoursTab({
  loggedHoursMonth,
  setLoggedHoursMonth,
  monthStart,
  monthlyStats,
}: EmployeeLoggedHoursTabProps) {
  const barCount = Math.max(monthlyStats.dailyBars.length, 1);

  return (
    <div className="flex flex-col gap-4 w-full min-w-0">
      {/* Summary card */}
      <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
        <div className="flex items-start justify-between gap-3.5 mb-[17px] flex-wrap">
          <div className="min-w-0">
            <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Logged Hours</div>
            <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
              Monthly utilisation against expected working hours.
            </div>
          </div>
          <Input
            type="month"
            value={loggedHoursMonth}
            onChange={(e) => setLoggedHoursMonth(e.target.value)}
            className="h-9 w-[190px] text-[12px] rounded-[9px] border-black/10 bg-[#FBFBFA] shrink-0"
          />
        </div>

        {/* Hero */}
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-4 items-center border border-[#F2C9B7] bg-[#FFF9F6] rounded-[13px] px-[18px] py-[17px]">
          <div className="min-w-0">
            <div className="text-[10.5px] text-[#9C7768] mb-0.5">Selected Month</div>
            <div className="text-[18px] font-bold tracking-[-0.3px] text-[#17171A]">
              {format(new Date(monthStart + "T00:00:00"), "MMMM yyyy")}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-[10.5px] text-[#9C7768] mb-0.5">Expected Hours</div>
            <div className="text-[25px] font-bold tracking-[-0.5px] text-[#17171A]">
              {formatHours(monthlyStats.expectedHours)}
            </div>
          </div>
        </div>

        {/* 4 stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-3">
          <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
            <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Expected Hours</div>
            <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
              {formatHours(monthlyStats.expectedHours)}
            </div>
            <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">
              {monthlyStats.workingDayCount} working day{monthlyStats.workingDayCount === 1 ? "" : "s"}
            </div>
          </div>
          <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
            <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Logged Hours</div>
            <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
              {formatHours(monthlyStats.loggedHours)}
            </div>
            <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">
              {monthlyStats.coveragePct}% coverage
            </div>
          </div>
          <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
            <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Unlogged Hours</div>
            <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
              {formatHours(monthlyStats.unloggedHours)}
            </div>
            <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">
              {monthlyStats.unloggedHours > 0 ? "Needs completion" : "On track"}
            </div>
          </div>
          <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
            <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Overtime</div>
            <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
              {formatHours(monthlyStats.overtimeHours)}
            </div>
            <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">
              {monthlyStats.overtimeEntryCount} overtime entr
              {monthlyStats.overtimeEntryCount === 1 ? "y" : "ies"}
            </div>
          </div>
        </div>
      </section>

      {/* Daily Hours Trend */}
      <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
        <div className="flex items-start justify-between gap-3.5 mb-3.5 flex-wrap">
          <div className="min-w-0">
            <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Daily Hours Trend</div>
            <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
              Logged hours for each working day in the selected month.
            </div>
          </div>
          <span className="inline-flex items-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold bg-[#FDECE3] text-[#B84A1D] whitespace-nowrap">
            {monthlyStats.expectedDailyHours}h expected / day
          </span>
        </div>

        {monthlyStats.dailyBars.length === 0 ? (
          <div className="py-10 px-4 text-center border border-dashed border-[#D8D8DD] rounded-xl bg-[#FCFCFD]">
            <div className="text-[11px] font-bold text-[#66666D]">No working days in this month</div>
            <div className="text-[10px] text-[#9A9AA0] mt-1">Try another month or check leave coverage.</div>
          </div>
        ) : (
          <div className="border border-black/[0.08] rounded-xl p-4 bg-white min-h-[220px] overflow-x-auto">
            <div
              className="grid items-end gap-2 h-[165px] pt-3.5 min-w-0"
              style={{
                gridTemplateColumns: `repeat(${barCount}, minmax(16px, 1fr))`,
                minWidth: barCount > 14 ? `${barCount * 24}px` : undefined,
              }}
            >
              {monthlyStats.dailyBars.map((b) => (
                <div
                  key={b.date}
                  className="h-full flex flex-col justify-end items-center gap-[7px] min-w-0"
                  title={`${b.date}: ${formatHours(b.hours)}`}
                >
                  <div
                    className={cn(
                      "w-full max-w-6 rounded-t-[5px] rounded-b-[2px]",
                      b.isZero ? "bg-[#F0EAE6] min-h-[3px]" : "bg-[#EB5A1E] min-h-[3px]"
                    )}
                    style={{ height: `${b.heightPct}%` }}
                  />
                  <div className="text-[9px] text-[#A0A0A7] whitespace-nowrap">{b.dayLabel}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

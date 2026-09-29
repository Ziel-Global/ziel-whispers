/**
 * Admin user-detail — Log Edit Days tab (ud-* Log Edit Window from zielAdmin mock).
 *
 * UI restyle only. Save/load semantics unchanged via existing props:
 *   - blank → null in DB → product default 1 past day
 *   - 0 → today only
 *   - N → today + N past days (max 30)
 *
 * Preview strip / Current Effect use effectiveDays = blank ? 1 : Number(value)
 * for display only; they do not change what is saved.
 */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface EmployeeLogEditDaysTabProps {
  logEditDays: string;
  setLogEditDays: (v: string) => void;
  savingLogEditDays: boolean;
  handleSaveLogEditDays: () => Promise<void>;
}

const DAY_LABELS = [
  "Today",
  "Yesterday",
  "2 days ago",
  "3 days ago",
  "4 days ago",
  "5 days ago",
  "6 days ago",
];

export function EmployeeLogEditDaysTab({
  logEditDays,
  setLogEditDays,
  savingLogEditDays,
  handleSaveLogEditDays,
}: EmployeeLogEditDaysTabProps) {
  const effectiveDays = useMemo(() => {
    if (logEditDays === "") return 1;
    const n = Number(logEditDays);
    if (Number.isNaN(n)) return 1;
    return Math.min(30, Math.max(0, n));
  }, [logEditDays]);

  const previewDays = useMemo(
    () =>
      DAY_LABELS.map((label, offset) => {
        const allowed = offset <= effectiveDays;
        return {
          label,
          offset,
          allowed,
          state: allowed ? "Editable" : "Locked",
        };
      }),
    [effectiveDays]
  );

  const effectValue = (offset: number) =>
    offset <= effectiveDays ? "Can add / edit" : "Locked";

  return (
    <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start w-full min-w-0">
      {/* Main policy card */}
      <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
        <div className="flex items-start justify-between gap-3.5 mb-[17px] flex-wrap">
          <div className="min-w-0">
            <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Log Edit Window</div>
            <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
              Set how many past days this employee may add or edit logs. Today is always separate.
            </div>
          </div>
          <Button
            type="button"
            onClick={handleSaveLogEditDays}
            disabled={savingLogEditDays}
            className="h-[38px] rounded-[9px] px-3.5 bg-[#EB5A1E] hover:bg-[#C64715] text-white text-[12px] font-semibold shrink-0"
          >
            {savingLogEditDays ? "Saving…" : "Save Policy"}
          </Button>
        </div>

        <div className="max-w-[260px]">
          <div className="text-[11.5px] font-bold text-[#39393F] mb-[7px]">Number of Past Days</div>
          <Input
            type="number"
            min={0}
            max={30}
            placeholder="e.g. 3"
            value={logEditDays}
            onChange={(e) => setLogEditDays(e.target.value)}
            className="h-10 rounded-[9px] border-black/10 bg-[#FBFBFA] text-[12.5px]"
          />
          <p className="text-[10px] text-[#9A9AA0] leading-normal mt-1.5">
            {logEditDays === ""
              ? "Not set — defaults to today plus 1 past day. 0 = today only. Maximum: 30 (recommended: 7)."
              : `0 = today only. Employee can edit today and ${logEditDays} past day${Number(logEditDays) === 1 ? "" : "s"}. Maximum: 30.`}
          </p>
        </div>

        {/* 7-day preview strip */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-[7px] mt-3.5">
          {previewDays.map((d) => (
            <div
              key={d.offset}
              className={cn(
                "border rounded-[9px] px-1.5 py-2.5 text-center bg-white min-w-0",
                d.allowed ? "border-[#F1C7B5] bg-[#FFF9F6]" : "border-black/[0.07]"
              )}
            >
              <div className="text-[9.5px] text-[#9A9AA0] leading-tight">{d.label}</div>
              <div
                className={cn(
                  "text-[10px] font-bold mt-1",
                  d.allowed ? "text-[#B84A1D]" : "text-[#4B4B52]"
                )}
              >
                {d.state}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3.5 rounded-[11px] border border-[#F2C9B7] bg-[#FFF9F6] px-3.5 py-3 text-[11px] text-[#9C7768] leading-snug">
          Historical edits remain visible in the Audit Log, including who changed the log and when.
        </div>
      </section>

      {/* Current Effect sidebar */}
      <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
        <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Current Effect</div>
        <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
          How the selected policy affects this employee.
        </div>
        <div className="mt-3.5 flex flex-col">
          <div className="flex items-center justify-between gap-3 py-2.5 border-b border-black/[0.055]">
            <span className="text-[11px] text-[#8B8B92]">Today</span>
            <span className="text-[11.5px] font-semibold text-[#4B4B52]">Can add / edit</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5 border-b border-black/[0.055]">
            <span className="text-[11px] text-[#8B8B92]">Yesterday</span>
            <span className="text-[11.5px] font-semibold text-[#4B4B52]">{effectValue(1)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5 border-b border-black/[0.055]">
            <span className="text-[11px] text-[#8B8B92]">2 days ago</span>
            <span className="text-[11.5px] font-semibold text-[#4B4B52]">{effectValue(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-[11px] text-[#8B8B92]">Audit trail</span>
            <span className="text-[11.5px] font-semibold text-[#4B4B52]">Always recorded</span>
          </div>
        </div>
      </section>
    </div>
  );
}

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { getLeaveTypeName } from "@/lib/utils";

export interface LeaveCalendarTabProps {
  calMonth: Date;
  setCalMonth: (date: Date) => void;
  subMonths: (date: Date, amount: number) => Date;
  addMonths: (date: Date, amount: number) => Date;
  calDays: Date[];
  getLeavesForDay: (d: Date) => any[];
  namesModal: { date: string; leaves: any[] } | null;
  setNamesModal: (modal: { date: string; leaves: any[] } | null) => void;
}

export function LeaveCalendarTab({
  calMonth,
  setCalMonth,
  subMonths,
  addMonths,
  calDays,
  getLeavesForDay,
  namesModal,
  setNamesModal,
}: LeaveCalendarTabProps) {
  const getChipStyle = (index: number) => {
    const styles = [
      { bg: "bg-[#FDECE3]", text: "text-[#EB5A1E]", dot: "bg-[#EB5A1E]" },
      { bg: "bg-[#F6E6FF]", text: "text-[#9333EA]", dot: "bg-[#9333EA]" },
      { bg: "bg-[#EAF3FF]", text: "text-[#1C6FC9]", dot: "bg-[#1C6FC9]" },
      { bg: "bg-[#DFF6E4]", text: "text-[#1B8A46]", dot: "bg-[#1B8A46]" },
      { bg: "bg-[#FDF3E3]", text: "text-[#A9720B]", dot: "bg-[#A9720B]" },
    ];
    return styles[index % styles.length];
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const padCount = calDays[0] ? calDays[0].getDay() : 0;

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden shadow-sm">
        {/* Header Navigation */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.07]">
          <button
            type="button"
            onClick={() => setCalMonth(subMonths(calMonth, 1))}
            className="w-8 h-8 rounded-[8px] border border-black/[0.08] flex items-center justify-center hover:bg-[#F6F5F3] transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5 text-[#4B4B52]" />
          </button>
          <h3 className="text-[15px] font-bold text-[#17171A]">{format(calMonth, "MMMM yyyy")}</h3>
          <button
            type="button"
            onClick={() => setCalMonth(addMonths(calMonth, 1))}
            className="w-8 h-8 rounded-[8px] border border-black/[0.08] flex items-center justify-center hover:bg-[#F6F5F3] transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5 text-[#4B4B52]" />
          </button>
        </div>

        {/* Weekday Header Grid */}
        <div className="grid grid-cols-7 border-b border-black/[0.06]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
            <div key={w} className="py-2.5 px-2 text-center text-[11px] font-bold text-[#B0B0B6] tracking-[0.05em] uppercase">
              {w}
            </div>
          ))}
        </div>

        {/* Calendar Cells Grid */}
        <div className="grid grid-cols-7">
          {Array.from({ length: padCount }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[92px] border-r border-b border-black/[0.05] p-2 bg-[#F9F9FB]/30" />
          ))}

          {calDays.map((d) => {
            const leaves = getLeavesForDay(d);
            const isSunday = d.getDay() === 0;

            return (
              <div
                key={d.toISOString()}
                className={`min-h-[92px] border-r border-b border-black/[0.05] p-2 transition-colors ${
                  isSunday ? "bg-[#F9F9FB]/50" : "bg-white"
                }`}
              >
                <div className="text-[12px] font-bold text-[#17171A] mb-1.5">{d.getDate()}</div>
                <div className="flex flex-col gap-1">
                  {leaves.slice(0, 2).map((l: any, idx: number) => {
                    const style = getChipStyle(idx);
                    return (
                      <div
                        key={l.id}
                        className={`flex items-center gap-1.5 ${style.bg} ${style.text} rounded-[5px] px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap overflow-hidden text-ellipsis shadow-none cursor-pointer`}
                        title={`${l.users?.full_name} - ${getLeaveTypeName(l)}`}
                        onClick={() => {
                          const ds = format(d, "yyyy-MM-dd");
                          setNamesModal({ date: ds, leaves });
                        }}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`} />
                        <span className="truncate">{l.users?.full_name}</span>
                      </div>
                    );
                  })}

                  {leaves.length > 2 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const ds = format(d, "yyyy-MM-dd");
                        setNamesModal({ date: ds, leaves });
                      }}
                      className="text-[10px] text-[#8B8B92] font-semibold pl-0.5 hover:underline text-left"
                    >
                      +{leaves.length - 2} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Employees Dialog */}
      <Dialog open={!!namesModal} onOpenChange={() => setNamesModal(null)}>
        <DialogContent className="font-sans sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold text-[#17171A]">
              Employees on {namesModal?.date ? format(new Date(namesModal.date + "T00:00:00"), "MMM d, yyyy") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {namesModal?.leaves && namesModal.leaves.length > 0 ? (
              <div className="divide-y divide-black/[0.06]">
                {namesModal.leaves.map((l: any) => (
                  <div key={l.id} className="flex items-center gap-3 py-3">
                    <div className="h-8 w-8 rounded-full bg-[#FDECE3] text-[#EB5A1E] flex items-center justify-center text-[11.5px] font-bold shrink-0">
                      {getInitials(l.users?.full_name)}
                    </div>
                    <div>
                      <p className="text-[13.5px] font-bold text-[#17171A]">{l.users?.full_name}</p>
                      <p className="text-[12px] text-[#8B8B92]">
                        {getLeaveTypeName(l)} · {l.hours ? `${l.hours} hrs` : `${l.days_count} day(s)`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#8B8B92] text-center py-4">No employees on leave</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


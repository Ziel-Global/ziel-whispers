import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={() => setCalMonth(subMonths(calMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-semibold">{format(calMonth, "MMMM yyyy")}</h3>
          <Button variant="ghost" size="icon" onClick={() => setCalMonth(addMonths(calMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: calDays[0].getDay() }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {calDays.map((d) => {
            const leaves = getLeavesForDay(d);
            return (
              <div
                key={d.toISOString()}
                className={`min-h-[60px] p-1 rounded text-xs border ${
                  d.getDay() === 0 ? "bg-muted opacity-60 blur-sm" : "bg-card"
                }`}
              >
                <span className="font-medium">{d.getDate()}</span>
                <div className="mt-0.5 space-y-0.5">
                  {leaves.slice(0, 2).map((l: any) => {
                    const initials = l.users?.full_name
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);
                    return (
                      <div
                        key={l.id}
                        className="flex items-center gap-1"
                        title={`${l.users?.full_name} - ${getLeaveTypeName(l)}`}
                      >
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{l.users?.full_name?.split(" ")[0]}</span>
                      </div>
                    );
                  })}
                  {leaves.length > 2 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const ds = format(d, "yyyy-MM-dd");
                        setNamesModal({ date: ds, leaves });
                      }}
                      className="text-muted-foreground text-xs ml-1 underline"
                    >
                      +{leaves.length - 2}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={!!namesModal} onOpenChange={() => setNamesModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Employees on {namesModal?.date}</DialogTitle>
          </DialogHeader>
          <div className="p-3">
            {namesModal?.leaves && namesModal.leaves.length > 0 ? (
              <div className="divide-y divide-black/30">
                {namesModal.leaves.map((l: any) => (
                  <div key={l.id} className="flex items-center gap-3 py-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {(l.users?.full_name || "")
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{l.users?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getLeaveTypeName(l)} · {l.hours ? "0.5" : l.days_count} day(s)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No employees</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

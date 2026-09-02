import React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";

export interface LogProgressHeaderProps {
  selectedDate: string;
  expectedDailyHours: number;
  totalHoursForSelectedDate: number;
  submittedHours: number;
  progressPercentage: number;
  remainingHoursForTarget: number;
}

export function LogProgressHeader({
  selectedDate,
  expectedDailyHours,
  totalHoursForSelectedDate,
  submittedHours,
  progressPercentage,
  remainingHoursForTarget,
}: LogProgressHeaderProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Logs</h1>
          <p className="text-muted-foreground mt-1">
            {new Intl.DateTimeFormat("en-US", {
              timeZone: "Asia/Karachi",
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }).format(new Date())}
          </p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="text-xs font-mono">
            PKT Time
          </Badge>
        </div>
      </div>

      {/* Daily Progress Bar */}
      <div className="p-4 bg-muted rounded-xl border border-primary/10">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-black" />
            <span className="text-md font-semibold">
              Logging Progress for {format(parseISO(selectedDate), "MMM d")}
            </span>
          </div>
          <span className="text-xs font-medium px-2 py-0.5 bg-primary rounded-full">
            Target: {expectedDailyHours} Hours
          </span>
        </div>
        <Progress value={progressPercentage} className="h-2 bg-gray-200" />
        <div className="flex justify-between items-center mt-2 text-xs">
          <div>
            <p className="font-medium text-black">
              {totalHoursForSelectedDate} of {expectedDailyHours} hours total
            </p>
            {submittedHours > 0 && (
              <p className="text-[10px] text-muted-foreground">
                ({submittedHours}h already submitted)
              </p>
            )}
          </div>
          {remainingHoursForTarget > 0 ? (
            <p className="text-muted-foreground">{remainingHoursForTarget}h remaining</p>
          ) : (
            <p className="text-green-600 font-bold flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Day Limit Reached
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

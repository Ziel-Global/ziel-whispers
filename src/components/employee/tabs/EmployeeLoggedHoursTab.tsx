import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { formatHours } from "@/lib/utils";

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
  };
}

export function EmployeeLoggedHoursTab({
  loggedHoursMonth,
  setLoggedHoursMonth,
  monthStart,
  monthlyStats,
}: EmployeeLoggedHoursTabProps) {
  return (
    <div className="space-y-4">
      {/* Month filter */}
      <Input
        type="month"
        value={loggedHoursMonth}
        onChange={(e) => setLoggedHoursMonth(e.target.value)}
        className="w-[200px]"
      />

      {/* Title box */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Selected Month</p>
            <p className="text-xl font-bold">
              {format(new Date(monthStart + "T00:00:00"), "MMMM yyyy")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Expected Hours</p>
            <p className="text-2xl font-bold text-black">
              {formatHours(monthlyStats.expectedHours)}
            </p>
          </div>
        </div>
      </Card>

      {/* 4 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Expected Hours</p>
          <p className="text-2xl font-bold mt-1">{formatHours(monthlyStats.expectedHours)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Logged Hours</p>
          <p className="text-2xl font-bold mt-1">{formatHours(monthlyStats.loggedHours)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Unlogged Hours</p>
          <p className="text-2xl font-bold mt-1">{formatHours(monthlyStats.unloggedHours)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Overtime Hours</p>
          <p className="text-2xl font-bold mt-1">
            {monthlyStats.overtimeEnabled
              ? formatHours(monthlyStats.overtimeHours)
              : "—"}
          </p>
        </Card>
      </div>
    </div>
  );
}

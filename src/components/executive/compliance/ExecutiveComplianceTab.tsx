import React from "react";
import { RepeatLateTable } from "./RepeatLateTable";
import { DisciplineOverviewCards } from "./DisciplineOverviewCards";
import { useComplianceAndClientData } from "@/hooks/useComplianceAndClientData";
import { Skeleton } from "@/components/ui/skeleton";

interface ExecutiveComplianceTabProps {
  data: ReturnType<typeof useComplianceAndClientData>;
}

export function ExecutiveComplianceTab({ data }: ExecutiveComplianceTabProps) {
  const {
    isLoading,
    repeatLateOffenders,
    autoClockOutCount,
    standupAdherenceRate,
    lateLogsCount,
    missedLogsCount,
    onTimeLogsCount,
    wfhCount,
    officeCount,
  } = data;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 1. Discipline KPI Cards & Policy Mix Charts */}
      <DisciplineOverviewCards
        autoClockOuts={autoClockOutCount}
        standupAdherence={standupAdherenceRate}
        lateLogs={lateLogsCount}
        missedLogs={missedLogsCount}
        onTimeLogs={onTimeLogsCount}
        wfhCount={wfhCount}
        officeCount={officeCount}
      />

      {/* 2. Repeat Late Arrivals Punctuality Watch */}
      <RepeatLateTable offenders={repeatLateOffenders} />
    </div>
  );
}


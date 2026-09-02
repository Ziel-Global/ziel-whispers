import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatHours } from "@/lib/utils";
import { formatPKTTime, isLogSubmissionLate } from "@/hooks/useWorkSettings";

export interface SubmittedDateLogsHistoryProps {
  dateLogs: any[];
  selectedDate: string;
  resolvedShiftEnd: string | null;
}

export function SubmittedDateLogsHistory({
  dateLogs,
  selectedDate,
  resolvedShiftEnd,
}: SubmittedDateLogsHistoryProps) {
  if (dateLogs.length === 0) return null;

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-2 px-1">
        <History className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-muted-foreground">
          Submitted Logs for {format(parseISO(selectedDate), "MMM d")}
        </h2>
      </div>

      <div className="grid gap-3 opacity-75">
        {dateLogs.map((log: any) => (
          <Card
            key={log.id}
            className={`p-4 border-none shadow-none ${
              log.is_overtime ? "bg-purple-50 border-l-4 border-purple-400" : "bg-muted"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap gap-2 items-center">
                  {log.projects?.name && (
                    <Badge variant="secondary" className="text-sm tracking-tighter bg-primary">
                      {log.projects.name}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-sm tracking-tighter bg-primary">
                    {log.category}
                  </Badge>
                  <span className="text-sm font-medium">{formatHours(log.hours)}</span>
                  {log.is_overtime && (
                    <Badge className="bg-purple-100 text-purple-700 text-[10px]">Overtime</Badge>
                  )}
                  {log.submitted_at &&
                    isLogSubmissionLate(log.submitted_at, resolvedShiftEnd, log.log_date) && (
                      <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Late</Badge>
                    )}
                </div>
                <p className="text-sm text-black">{log.description}</p>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="text-[12px] text-muted-foreground font-mono">
                  {formatPKTTime(log.submitted_at)}
                </span>
                <Badge variant="secondary" className="text-[12px] bg-primary">
                  Submitted
                </Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { RepeatLateEmployee } from "@/hooks/useComplianceAndClientData";
import { getInitials } from "@/lib/utils";

interface RepeatLateTableProps {
  offenders: RepeatLateEmployee[];
}

export function RepeatLateTable({ offenders }: RepeatLateTableProps) {
  return (
    <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl bg-card">
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">
              Repeat Late Arrivals (Punctuality Watch)
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Staff members with repeated shift start delays during selected period
            </p>
          </div>
        </div>

        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">
          {offenders.length} Flagged
        </Badge>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 font-medium">Employee</th>
              <th className="py-2 font-medium">Department</th>
              <th className="py-2 font-medium text-right">Late Days</th>
              <th className="py-2 font-medium text-right">Cumulative Delay</th>
              <th className="py-2 font-medium text-right">Last Occurrence</th>
              <th className="py-2 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {offenders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1 opacity-80" />
                  100% Punctuality: Zero repeat late arrivals recorded in this period.
                </td>
              </tr>
            ) : (
              offenders.map((o) => (
                <tr key={o.userId} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
                  <td className="py-2.5 font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={o.avatarUrl || undefined} />
                        <AvatarFallback className="text-[9px]">{getInitials(o.name)}</AvatarFallback>
                      </Avatar>
                      <span>{o.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-muted-foreground">{o.department}</td>
                  <td className="py-2.5 text-right font-bold text-amber-600">{o.lateDaysCount} days</td>
                  <td className="py-2.5 text-right text-muted-foreground font-mono">{o.totalMinutesLate} mins</td>
                  <td className="py-2.5 text-right text-muted-foreground font-mono">{o.lastLateDate}</td>
                  <td className="py-2.5 text-center">
                    <Badge
                      variant="outline"
                      className={`text-[9.5px] ${
                        o.lateDaysCount >= 3
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {o.lateDaysCount >= 3 ? "Chronic (≥ 3)" : "Warning"}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}


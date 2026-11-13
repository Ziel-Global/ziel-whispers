import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DepartmentMemberRow } from "@/hooks/useDepartmentAnalyticsData";
import { Users, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { TruncatedTitle } from "@/components/ui/truncated-title";

interface DepartmentRosterTableProps {
  members: DepartmentMemberRow[];
}

export function DepartmentRosterTable({ members }: DepartmentRosterTableProps) {
  return (
    <Card className="p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Department Roster & Capacity Tracking
            </h3>
            <p className="text-xs text-muted-foreground">
              Individual utilization pacing, live attendance, and active assignments
            </p>
          </div>
        </div>

        <Badge variant="outline" className="text-xs font-semibold">
          {members.length} Members
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2.5 font-semibold">Employee</th>
              <th className="py-2.5 font-semibold">Designation</th>
              <th className="py-2.5 font-semibold text-center">Status Today</th>
              <th className="py-2.5 font-semibold text-right">Logged / Net Cap</th>
              <th className="py-2.5 font-semibold text-center w-36">Utilization</th>
              <th className="py-2.5 font-semibold">Current Task</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {members.map((m) => {
              const isOver = m.utilizationRate > 100;
              const isUnder = m.utilizationRate < 70;

              return (
                <tr key={m.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors">
                  {/* Name + Avatar */}
                  <td className="py-3 font-semibold text-foreground">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7 text-xs">
                        <AvatarImage src={m.avatarUrl || undefined} alt={m.fullName} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {m.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{m.fullName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Designation */}
                  <td className="py-3 text-muted-foreground font-medium truncate max-w-[150px]">
                    {m.designation}
                  </td>

                  {/* Status Today */}
                  <td className="py-3 text-center">
                    {m.isClockedIn ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-semibold"
                      >
                        ● Active ({m.workMode || "Onsite"})
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                        Not Clocked In
                      </Badge>
                    )}
                  </td>

                  {/* Logged / Cap */}
                  <td className="py-3 text-right font-medium text-foreground whitespace-nowrap">
                    <span className="font-bold">{m.loggedHours}h</span>
                    <span className="text-muted-foreground"> / {m.netCapacity}h</span>
                  </td>

                  {/* Utilization Progress Bar */}
                  <td className="py-3 text-center">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span
                          className={
                            isOver
                              ? "text-rose-600 dark:text-rose-400"
                              : isUnder
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }
                        >
                          {m.utilizationRate}%
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {isOver ? "Over" : isUnder ? "Under" : "Balanced"}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOver
                              ? "bg-rose-500"
                              : isUnder
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, m.utilizationRate)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Current Task */}
                  <td className="py-3 text-muted-foreground truncate max-w-[180px]">
                    {m.activeTaskTitle ? (
                      <TruncatedTitle
                        text={m.activeTaskTitle}
                        className="text-foreground font-medium truncate block"
                      />
                    ) : (
                      <span className="text-muted-foreground/60 italic">No task in progress</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}


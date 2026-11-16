import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutGrid, AlertCircle, CheckCircle2 } from "lucide-react";
import { TruncatedTitle } from "@/components/ui/truncated-title";

interface AllocationMatrixProps {
  projects: { id: string; name: string }[];
  rows: {
    user: {
      id: string;
      full_name: string;
      email: string;
      avatar_url?: string | null;
      designation?: string;
    };
    allocations: Record<string, number>;
    totalAllocation: number;
  }[];
}

export function DepartmentAllocationMatrix({ projects, rows }: AllocationMatrixProps) {
  if (rows.length === 0) {
    return (
      <Card className="p-6 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl text-center">
        <p className="text-xs text-muted-foreground">No department members found for allocation matrix.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Member × Project Allocation Matrix
            </h3>
            <p className="text-xs text-muted-foreground">
              Capacity dedication across active project streams (Target = 100% FTE)
            </p>
          </div>
        </div>

        <Badge variant="outline" className="text-xs font-semibold">
          {projects.length} Active Streams
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2.5 font-semibold sticky left-0 bg-card z-10 min-w-[180px]">Employee</th>
              {projects.map((p) => (
                <th key={p.id} className="py-2.5 font-semibold text-center px-3 min-w-[110px]">
                  <TruncatedTitle
                    text={p.name}
                    className="truncate block max-w-[120px] mx-auto"
                  />
                </th>
              ))}
              <th className="py-2.5 font-semibold text-center px-3 min-w-[100px]">Total FTE</th>
              <th className="py-2.5 font-semibold text-center px-3 min-w-[90px]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {rows.map((row) => {
              const isOver = row.totalAllocation > 100;
              const isUnder = row.totalAllocation < 80;
              const isOptimal = row.totalAllocation >= 80 && row.totalAllocation <= 100;

              return (
                <tr key={row.user.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors">
                  {/* Employee Name */}
                  <td className="py-2.5 font-medium text-foreground sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 text-[10px]">
                        <AvatarImage src={row.user.avatar_url || undefined} alt={row.user.full_name} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {row.user.full_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span className="truncate block font-semibold text-xs text-foreground">
                          {row.user.full_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate block">
                          {(row.user as any).designation || "Member"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Project Allocations */}
                  {projects.map((p) => {
                    const alloc = row.allocations[p.id] || 0;
                    return (
                      <td key={p.id} className="py-2.5 text-center px-3">
                        {alloc > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary">
                            {alloc}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30 font-mono text-[11px]">-</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Total FTE */}
                  <td className="py-2.5 text-center px-3">
                    <span
                      className={`font-mono font-bold text-xs ${
                        isOver
                          ? "text-rose-600 dark:text-rose-400"
                          : isUnder
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {row.totalAllocation}%
                    </span>
                  </td>

                  {/* Status Pill */}
                  <td className="py-2.5 text-center px-3">
                    {isOver ? (
                      <Badge
                        variant="outline"
                        className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 text-[10px] font-semibold gap-1"
                      >
                        <AlertCircle className="h-2.5 w-2.5" /> Over
                      </Badge>
                    ) : isUnder ? (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 text-[10px] font-semibold"
                      >
                        Under
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-semibold gap-1"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" /> Balanced
                      </Badge>
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


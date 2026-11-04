import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Briefcase, UserCheck } from "lucide-react";
import { getInitials } from "@/lib/utils";

interface BenchReportTableProps {
  benchList: {
    id: string;
    name: string;
    department: string;
    avatarUrl?: string | null;
    loggedHours: number;
    netCapacity: number;
    utilizationRate: number;
  }[];
}

export function BenchReportTable({ benchList }: BenchReportTableProps) {
  return (
    <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl bg-card">
      <div className="flex items-center justify-between pb-3 border-b">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/40">
            <Briefcase className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">
              Bench Report (Free Allocation &gt; 30%)
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Staff with substantial unallocated bandwidth in current cycle
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {benchList.length} Available Members
        </Badge>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 font-medium">Employee</th>
              <th className="py-2 font-medium">Department</th>
              <th className="py-2 font-medium text-right">Logged Hours</th>
              <th className="py-2 font-medium text-right">Capacity</th>
              <th className="py-2 font-medium text-right">Free Capacity</th>
              <th className="py-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {benchList.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  <UserCheck className="h-6 w-6 text-emerald-500 mx-auto mb-1 opacity-80" />
                  Optimal staffing: No staff members idle on bench (&gt;30% capacity).
                </td>
              </tr>
            ) : (
              benchList.map((m) => {
                const freeHours = Math.max(0, m.netCapacity - m.loggedHours);
                const freePercent = m.netCapacity > 0 ? Math.round((freeHours / m.netCapacity) * 100) : 0;

                return (
                  <tr key={m.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
                    <td className="py-2.5 font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={m.avatarUrl || undefined} />
                          <AvatarFallback className="text-[9px]">{getInitials(m.name)}</AvatarFallback>
                        </Avatar>
                        <span>{m.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-muted-foreground">{m.department}</td>
                    <td className="py-2.5 text-right">{m.loggedHours}h</td>
                    <td className="py-2.5 text-right">{m.netCapacity}h</td>
                    <td className="py-2.5 text-right font-medium text-blue-600">
                      {freeHours}h ({freePercent}%)
                    </td>
                    <td className="py-2.5 text-right">
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                        Available
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}


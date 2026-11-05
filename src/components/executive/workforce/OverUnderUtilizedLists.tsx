import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Flame, Clock, AlertTriangle } from "lucide-react";
import { getInitials } from "@/lib/utils";

interface OverUnderListsProps {
  overUtilized: {
    id: string;
    name: string;
    department: string;
    avatarUrl?: string | null;
    loggedHours: number;
    netCapacity: number;
    utilizationRate: number;
  }[];
  underUtilized: {
    id: string;
    name: string;
    department: string;
    avatarUrl?: string | null;
    loggedHours: number;
    netCapacity: number;
    utilizationRate: number;
  }[];
}

export function OverUnderUtilizedLists({ overUtilized, underUtilized }: OverUnderListsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Over-Utilized List (Burnout Alert) */}
      <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl bg-card">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-rose-50 text-rose-600 dark:bg-rose-950/40">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">
                High Utilization & Overtime Watch (&gt; 85%)
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Sustained load risking delivery burnout or attrition
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-rose-600 border-rose-200 text-[10px]">
            {overUtilized.length} Staff
          </Badge>
        </div>

        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04] mt-1 max-h-64 overflow-y-auto">
          {overUtilized.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No staff members exceeding 85% utilization threshold
            </div>
          ) : (
            overUtilized.map((u) => (
              <div key={u.id} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={u.avatarUrl || undefined} />
                    <AvatarFallback className="text-[9px]">{getInitials(u.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{u.department}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-rose-600">{u.utilizationRate}%</span>
                  <span className="text-[10px] text-muted-foreground block">{u.loggedHours}h / {u.netCapacity}h</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Under-Utilized List (Bench Capacity) */}
      <Card className="p-4 border border-black/[0.08] dark:border-white/[0.08] rounded-xl bg-card">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/40">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">
                Low Utilization & Available Bench (&lt; 70%)
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Available capacity ready for project reassignment
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-amber-600 border-amber-200 text-[10px]">
            {underUtilized.length} Staff
          </Badge>
        </div>

        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04] mt-1 max-h-64 overflow-y-auto">
          {underUtilized.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No staff members under 70% utilization threshold
            </div>
          ) : (
            underUtilized.map((u) => (
              <div key={u.id} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={u.avatarUrl || undefined} />
                    <AvatarFallback className="text-[9px]">{getInitials(u.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{u.department}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-amber-600">{u.utilizationRate}%</span>
                  <span className="text-[10px] text-muted-foreground block">{u.loggedHours}h / {u.netCapacity}h</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}


import React from "react";
import { Card } from "@/components/ui/card";
import { ShieldAlert, AlertTriangle, Info, BellOff } from "lucide-react";

interface AlertsSummaryCardsProps {
  totalActive: number;
  critical: number;
  warning: number;
  snoozed: number;
}

export function AlertsSummaryCards({
  totalActive,
  critical,
  warning,
  snoozed,
}: AlertsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* 1. Total Active */}
      <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold tracking-tight uppercase text-muted-foreground">
            Active Alerts
          </span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {totalActive}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">Requiring attention</p>
        </div>
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
          <ShieldAlert className="h-5 w-5" />
        </div>
      </Card>

      {/* 2. Critical Breaches */}
      <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold tracking-tight uppercase text-rose-600 dark:text-rose-400">
            Critical Breaches
          </span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {critical}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">SLA & Burnout risks</p>
        </div>
        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
          <ShieldAlert className="h-5 w-5" />
        </div>
      </Card>

      {/* 3. Operational Warnings */}
      <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold tracking-tight uppercase text-amber-600 dark:text-amber-400">
            Warnings
          </span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {warning}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">Threshold warnings</p>
        </div>
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
      </Card>

      {/* 4. Snoozed */}
      <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold tracking-tight uppercase text-muted-foreground">
            Snoozed Alerts
          </span>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {snoozed}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">Temporarily muted</p>
        </div>
        <div className="p-2.5 rounded-xl bg-muted text-muted-foreground">
          <BellOff className="h-5 w-5" />
        </div>
      </Card>
    </div>
  );
}


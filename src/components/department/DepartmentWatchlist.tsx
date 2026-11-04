import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Flame, BatteryLow, Clock, ArrowRight, CheckCircle2 } from "lucide-react";

interface WatchlistItem {
  id: string;
  type: "burnout" | "underutilized" | "late";
  title: string;
  subtitle: string;
  severity: "danger" | "warning";
}

interface DepartmentWatchlistProps {
  alerts: WatchlistItem[];
  onMemberClick?: (id: string) => void;
}

export function DepartmentWatchlist({ alerts, onMemberClick }: DepartmentWatchlistProps) {
  return (
    <Card className="p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Manager Watchlist & Risk Alerts
              </h3>
              <p className="text-xs text-muted-foreground">
                Proactive signals for burnout, under-utilization, and capacity imbalances
              </p>
            </div>
          </div>

          <Badge
            variant={alerts.length > 0 ? "destructive" : "outline"}
            className="text-xs font-semibold"
          >
            {alerts.length} {alerts.length === 1 ? "Alert" : "Alerts"}
          </Badge>
        </div>

        {alerts.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-foreground">Department Capacity Balanced</p>
            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
              All team members are pacing between 70% and 100% net capacity without burnout risk.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {alerts.map((alert) => {
              const isBurnout = alert.type === "burnout";
              const isUnder = alert.type === "underutilized";

              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                    alert.severity === "danger"
                      ? "bg-rose-50/50 border-rose-200/60 text-rose-900 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-200"
                      : "bg-amber-50/50 border-amber-200/60 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-1.5 rounded-full ${
                        alert.severity === "danger"
                          ? "bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300"
                          : "bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300"
                      }`}
                    >
                      {isBurnout ? (
                        <Flame className="h-3.5 w-3.5" />
                      ) : isUnder ? (
                        <BatteryLow className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{alert.title}</p>
                      <p className="text-[11px] opacity-80 truncate">{alert.subtitle}</p>
                    </div>
                  </div>

                  <span className="shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-black/5 dark:bg-white/10">
                    {isBurnout ? "Burnout Risk" : isUnder ? "Bench Capacity" : "Punctuality"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-3 mt-3 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Evaluated against SSoT capacity metrics</span>
        <span className="font-medium text-primary flex items-center gap-1">
          Auto-updated <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Card>
  );
}


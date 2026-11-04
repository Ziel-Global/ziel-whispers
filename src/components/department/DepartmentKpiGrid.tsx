import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, CheckCircle2, AlertTriangle, AlertCircle, Target } from "lucide-react";
import { DepartmentKpiItem } from "@/hooks/useDepartmentAnalyticsData";

interface DepartmentKpiGridProps {
  items: DepartmentKpiItem[];
}

export function DepartmentKpiGrid({ items }: DepartmentKpiGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((kpi) => {
        const isSuccess = kpi.status === "success";
        const isDanger = kpi.status === "danger";
        const isWarning = kpi.status === "warning";

        return (
          <Card
            key={kpi.id}
            className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex flex-col justify-between hover:shadow-sm transition-all"
          >
            <div>
              {/* Header: Title + Formula Tooltip */}
              <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                <span className="text-xs font-semibold tracking-tight uppercase text-muted-foreground truncate">
                  {kpi.title}
                </span>

                <TooltipProvider>
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="View metric formula"
                        className="text-muted-foreground/60 hover:text-foreground transition-colors p-0.5"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs p-2.5">
                      <p className="font-semibold text-foreground mb-1">Calculation Formula (SSoT):</p>
                      <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-primary">
                        {kpi.formula}
                      </code>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Metric Value */}
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {kpi.value}
                </span>
                {kpi.unit && (
                  <span className="text-xs font-semibold text-muted-foreground">
                    {kpi.unit}
                  </span>
                )}
              </div>

              {/* Sub-value descriptor */}
              {kpi.subValue && (
                <p className="text-[11px] text-muted-foreground font-medium truncate mt-0.5">
                  {kpi.subValue}
                </p>
              )}
            </div>

            {/* Target indicator footer */}
            <div className="pt-2.5 mt-2.5 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between gap-1 text-[11px]">
              <span className="text-muted-foreground/80 font-mono text-[10px] truncate">
                {kpi.target || "Standard"}
              </span>

              {kpi.targetMet ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                  <CheckCircle2 className="h-3 w-3" /> Target Met
                </span>
              ) : isDanger ? (
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold text-[11px]">
                  <AlertCircle className="h-3 w-3" /> Breach
                </span>
              ) : isWarning ? (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                  <AlertTriangle className="h-3 w-3" /> Attention
                </span>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}


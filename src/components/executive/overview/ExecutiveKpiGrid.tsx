import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ExecutiveKpiItem } from "@/hooks/useExecutiveAnalyticsData";

interface ExecutiveKpiGridProps {
  items: ExecutiveKpiItem[];
}

export function ExecutiveKpiGrid({ items }: ExecutiveKpiGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {items.map((kpi) => {
        const isPositiveDelta = (kpi.deltaPercent ?? 0) > 0;
        const isNegativeDelta = (kpi.deltaPercent ?? 0) < 0;

        return (
          <Card
            key={kpi.id}
            className="p-3.5 flex flex-col justify-between bg-card hover:shadow-md transition-shadow duration-150 border border-black/[0.08] dark:border-white/[0.08] rounded-xl"
          >
            {/* Header: Title + Formula Tooltip */}
            <div className="flex items-start justify-between gap-1.5">
              <span className="text-[12px] font-semibold text-muted-foreground leading-tight line-clamp-1">
                {kpi.title}
              </span>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
                      aria-label="Formula info"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs font-mono p-2">
                    <p className="font-bold text-[11px] text-primary mb-1">Standard Formula (SSoT):</p>
                    <p className="text-muted-foreground">{kpi.formula}</p>
                    {kpi.target && (
                      <p className="mt-1.5 pt-1.5 border-t border-border/40 text-[10px] text-foreground font-sans font-medium">
                        Target benchmark: <span className="font-bold">{kpi.target}</span>
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Metric Value & Unit */}
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {kpi.value}
                </span>
                {kpi.unit && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {kpi.unit}
                  </span>
                )}
              </div>

              {kpi.subValue && (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                  {kpi.subValue}
                </p>
              )}
            </div>

            {/* Bottom Row: Comparison Delta + Target Met Badge */}
            <div className="flex items-center justify-between pt-2 border-t border-black/[0.04] dark:border-white/[0.04] text-[11px]">
              {kpi.deltaPercent !== undefined ? (
                <div
                  className={`flex items-center gap-0.5 font-semibold ${
                    isPositiveDelta
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isNegativeDelta
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {isPositiveDelta ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : isNegativeDelta ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  <span>
                    {isPositiveDelta ? `+${kpi.deltaPercent}%` : `${kpi.deltaPercent}%`}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground">Baseline</span>
              )}

              {kpi.target && (
                <Badge
                  variant="outline"
                  className={`text-[9.5px] px-1.5 py-0 font-medium ${
                    kpi.targetMet
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
                  }`}
                >
                  {kpi.targetMet ? "Target Met" : "Off Target"}
                </Badge>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}


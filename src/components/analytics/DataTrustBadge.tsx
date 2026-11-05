import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShieldCheck, ShieldAlert, AlertTriangle, Info } from "lucide-react";

export interface DataTrustBadgeProps {
  complianceRate?: number; // 0 to 100
  loggedHours?: number;
  expectedHours?: number;
  missingHours?: number;
  className?: string;
  compact?: boolean;
}

export function DataTrustBadge({
  complianceRate = 96,
  loggedHours,
  expectedHours,
  missingHours,
  className,
  compact = false,
}: DataTrustBadgeProps) {
  // RAG categorization per Blueprint Section 1.5
  const isHigh = complianceRate >= 95;
  const isModerate = complianceRate >= 85 && complianceRate < 95;
  const isLow = complianceRate < 85;

  const config = isHigh
    ? {
        label: "High Confidence",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
        icon: ShieldCheck,
        description: "Log compliance exceeds 95%. Metric calculations are statistically reliable.",
      }
    : isModerate
    ? {
        label: "Moderate Confidence",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
        icon: AlertTriangle,
        description: "Log compliance is between 85% and 94%. Slight reporting lag may affect utilization and delivery estimates.",
      }
    : {
        label: "Low Confidence",
        badgeClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
        icon: ShieldAlert,
        description: "Log compliance is below 85%. Missing logs distort utilization, burn rates, and project delivery forecasts.",
      };

  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center gap-1.5 cursor-help transition-all ${className || ""}`}
          >
            <Badge
              variant="outline"
              className={`h-7 px-2.5 text-xs font-semibold rounded-md border flex items-center gap-1.5 ${config.badgeClass}`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>
                {compact ? `${Math.round(complianceRate)}%` : `Trust Score: ${Math.round(complianceRate)}%`}
              </span>
              {!compact && (
                <span className="text-[10px] font-medium opacity-80 border-l border-current/20 pl-1.5 ml-0.5">
                  {config.label}
                </span>
              )}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          className="max-w-xs p-3 text-xs bg-popover text-popover-foreground border shadow-md space-y-2"
        >
          <div className="flex items-center justify-between font-bold border-b pb-1.5">
            <span className="flex items-center gap-1.5">
              <Icon className="h-4 w-4 text-primary" />
              Data Trust Index
            </span>
            <span className="text-sm font-extrabold">{Math.round(complianceRate)}%</span>
          </div>

          <p className="text-muted-foreground leading-relaxed">{config.description}</p>

          {(loggedHours !== undefined || expectedHours !== undefined) && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t text-[11px]">
              {loggedHours !== undefined && (
                <div>
                  <span className="text-muted-foreground">Logged Hours:</span>{" "}
                  <strong className="text-foreground">{Math.round(loggedHours)}h</strong>
                </div>
              )}
              {expectedHours !== undefined && (
                <div>
                  <span className="text-muted-foreground">Expected:</span>{" "}
                  <strong className="text-foreground">{Math.round(expectedHours)}h</strong>
                </div>
              )}
              {missingHours !== undefined && missingHours > 0 && (
                <div className="col-span-2 text-red-600 dark:text-red-400">
                  <span>Missing Logs:</span> <strong>{Math.round(missingHours)}h unlogged</strong>
                </div>
              )}
            </div>
          )}

          <div className="text-[10px] text-muted-foreground flex items-center gap-1 pt-0.5">
            <Info className="h-3 w-3 shrink-0" />
            <span>Based on employee daily shift log submission rate in active scope.</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, BarChart3, Table as TableIcon, ExternalLink, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export interface AnalyticsChartCardProps {
  question: string; // The core business question (Blueprint 6.4)
  title: string;
  subtitle?: string;
  formula?: string; // SSoT Formula description shown on hover
  target?: string; // Target reference line (e.g. "Target: 75% – 85%")
  targetMet?: boolean | null; // Indicator color for target
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  tableContent?: React.ReactNode; // Optional tabular view of the same data
  onDrilldown?: () => void; // Drill-down trigger to open underlying rows drawer/modal
  drilldownLabel?: string;
  action?: React.ReactNode;
  className?: string;
}

export function AnalyticsChartCard({
  question,
  title,
  subtitle,
  formula,
  target,
  targetMet,
  isLoading = false,
  isEmpty = false,
  emptyMessage = "No data available for the selected filters",
  children,
  tableContent,
  onDrilldown,
  drilldownLabel = "View details",
  action,
  className = "",
}: AnalyticsChartCardProps) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  return (
    <Card
      className={`p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm hover:shadow transition-all flex flex-col justify-between ${className}`}
    >
      {/* Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 mb-3 border-b border-black/[0.05] dark:border-white/[0.05] pb-3">
        <div className="space-y-1 min-w-0 flex-1">
          {/* Question title per Blueprint 6.4 */}
          <p className="text-xs font-semibold tracking-tight text-[#EB5A1E] dark:text-[#EB5A1E]">
            {question}
          </p>

          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
              {title}
            </h3>

            {formula && (
              <TooltipProvider>
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="View metric formula"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs p-2.5">
                    <p className="font-semibold text-foreground mb-1">Standard Formula (SSoT):</p>
                    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-primary">
                      {formula}
                    </code>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {target && (
              <Badge
                variant="outline"
                className={`text-[10px] h-5 px-1.5 font-semibold flex items-center gap-1 ${
                  targetMet === true
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : targetMet === false
                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                <Target className="h-2.5 w-2.5" />
                {target}
              </Badge>
            )}
          </div>

          {subtitle && (
            <p className="text-xs text-muted-foreground line-clamp-1">{subtitle}</p>
          )}
        </div>

        {/* Action buttons (Table toggle, drill-down, custom action) */}
        <div className="flex items-center gap-1.5 shrink-0 self-start pt-0.5">
          {action}

          {tableContent && (
            <div className="flex items-center bg-muted/60 rounded-lg p-0.5 border border-black/[0.04]">
              <Button
                variant={viewMode === "chart" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-[10px] font-semibold"
                onClick={() => setViewMode("chart")}
              >
                <BarChart3 className="h-3 w-3 mr-1" /> Chart
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-[10px] font-semibold"
                onClick={() => setViewMode("table")}
              >
                <TableIcon className="h-3 w-3 mr-1" /> Table
              </Button>
            </div>
          )}

          {onDrilldown && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={onDrilldown}
            >
              <span className="hidden sm:inline mr-1">{drilldownLabel}</span>
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-[220px] flex flex-col justify-center">
        {isLoading ? (
          <div className="space-y-3 w-full py-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-[180px] w-full rounded-lg" />
          </div>
        ) : isEmpty ? (
          <div className="py-8">
            <EmptyState message={emptyMessage} />
          </div>
        ) : viewMode === "table" && tableContent ? (
          <div className="w-full overflow-x-auto max-h-[360px] overflow-y-auto">
            {tableContent}
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col justify-center">{children}</div>
        )}
      </div>
    </Card>
  );
}

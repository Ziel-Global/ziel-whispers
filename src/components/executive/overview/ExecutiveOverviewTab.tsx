import React from "react";
import { ExecutiveKpiGrid } from "./ExecutiveKpiGrid";
import { ExecutiveExceptionsPanel } from "./ExecutiveExceptionsPanel";
import { ExecutiveOverviewCharts } from "./ExecutiveOverviewCharts";
import { useExecutiveAnalyticsData } from "@/hooks/useExecutiveAnalyticsData";
import { Skeleton } from "@/components/ui/skeleton";

interface ExecutiveOverviewTabProps {
  analyticsData: ReturnType<typeof useExecutiveAnalyticsData>;
  onDrilldown?: (title: string) => void;
}

export function ExecutiveOverviewTab({ analyticsData, onDrilldown }: ExecutiveOverviewTabProps) {
  const {
    isLoading,
    kpiCards,
    needsAttentionItems,
    clientHoursDistribution,
    categoryDistribution,
    summary,
  } = analyticsData;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 1. 10 Executive KPI Cards (Blueprint 2.1) */}
      <ExecutiveKpiGrid items={kpiCards} />

      {/* 2. Middle Row: Visual Charts + Exceptions Action Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <ExecutiveOverviewCharts
            clientHours={clientHoursDistribution}
            categoryHours={categoryDistribution}
            portfolioHealth={{
              healthy: summary.activeProjectsCount - summary.delayedProjectsCount,
              delayed: summary.delayedProjectsCount,
            }}
            attendanceSplit={{
              onsite: summary.onsiteCount,
              remote: summary.remoteCount,
            }}
            onDrilldown={onDrilldown}
          />
        </div>

        {/* Operational Exception Priority Panel */}
        <div className="lg:col-span-1">
          <ExecutiveExceptionsPanel items={needsAttentionItems} />
        </div>
      </div>
    </div>
  );
}


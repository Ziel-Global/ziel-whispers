import React from "react";
import { ThroughputAndWipCharts } from "./ThroughputAndWipCharts";
import { LeadCycleAndQualityCards } from "./LeadCycleAndQualityCards";
import { useProjectAndDeliveryData } from "@/hooks/useProjectAndDeliveryData";
import { Skeleton } from "@/components/ui/skeleton";

interface ExecutiveDeliveryTabProps {
  data: ReturnType<typeof useProjectAndDeliveryData>;
}

export function ExecutiveDeliveryTab({ data }: ExecutiveDeliveryTabProps) {
  const { isLoading, deliveryMetrics } = data;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 1. Cycle Time, Lead Time, Rework Rate & OKR Progress */}
      <LeadCycleAndQualityCards metrics={deliveryMetrics} />

      {/* 2. Throughput Trend and Work In Progress (WIP) Stages */}
      <ThroughputAndWipCharts
        weeklyThroughput={deliveryMetrics.weeklyThroughput}
        wipByStatus={deliveryMetrics.wipByStatus}
      />
    </div>
  );
}


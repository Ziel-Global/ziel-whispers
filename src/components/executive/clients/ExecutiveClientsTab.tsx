import React from "react";
import { ClientPortfolioView } from "./ClientPortfolioView";
import { KpiTargetsSection } from "./KpiTargetsSection";
import { useComplianceAndClientData } from "@/hooks/useComplianceAndClientData";
import { Skeleton } from "@/components/ui/skeleton";

interface ExecutiveClientsTabProps {
  data: ReturnType<typeof useComplianceAndClientData>;
}

export function ExecutiveClientsTab({ data }: ExecutiveClientsTabProps) {
  const { isLoading, clientPortfolio } = data;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 1. Client Portfolio & Concentration Analysis */}
      <ClientPortfolioView clients={clientPortfolio} />

      {/* 2. Configurable KPI Targets Section */}
      <KpiTargetsSection />
    </div>
  );
}

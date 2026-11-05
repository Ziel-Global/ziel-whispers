import React from "react";
import { PortfolioMasterTable } from "./PortfolioMasterTable";
import { PortfolioVisualizations } from "./PortfolioVisualizations";
import { ProjectProfitabilityTable } from "./ProjectProfitabilityTable";
import { useProjectAndDeliveryData } from "@/hooks/useProjectAndDeliveryData";
import { Skeleton } from "@/components/ui/skeleton";

interface ExecutiveProjectPortfolioTabProps {
  data: ReturnType<typeof useProjectAndDeliveryData>;
}

export function ExecutiveProjectPortfolioTab({ data }: ExecutiveProjectPortfolioTabProps) {
  const { isLoading, portfolioItems } = data;

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
      {/* 1. Master Sortable Portfolio Table */}
      <PortfolioMasterTable projects={portfolioItems} />

      {/* 2. Visual Trajectory & Staffing Analysis */}
      <PortfolioVisualizations projects={portfolioItems} />

      {/* 3. Project Profitability & Financial Margins */}
      <ProjectProfitabilityTable />
    </div>
  );
}

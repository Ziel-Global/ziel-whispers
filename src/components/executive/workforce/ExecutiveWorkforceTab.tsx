import React from "react";
import { DepartmentUtilizationChart } from "./DepartmentUtilizationChart";
import { UtilizationHistogram } from "./UtilizationHistogram";
import { OverUnderUtilizedLists } from "./OverUnderUtilizedLists";
import { BenchReportTable } from "./BenchReportTable";
import { SkillsStaffingSection } from "./SkillsStaffingSection";
import { useExecutiveAnalyticsData } from "@/hooks/useExecutiveAnalyticsData";
import { Skeleton } from "@/components/ui/skeleton";

interface ExecutiveWorkforceTabProps {
  analyticsData: ReturnType<typeof useExecutiveAnalyticsData>;
}

export function ExecutiveWorkforceTab({ analyticsData }: ExecutiveWorkforceTabProps) {
  const {
    isLoading,
    departmentBreakdown,
    utilizationHistogram,
    overUtilizedList,
    underUtilizedList,
    benchReportList,
  } = analyticsData;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Row 1: Department Utilization Horizontal Bar + 5-Bucket Distribution Histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DepartmentUtilizationChart departments={departmentBreakdown} />
        <UtilizationHistogram histogram={utilizationHistogram} />
      </div>

      {/* Row 2: Over & Under Utilized Ranked Lists (Blueprint Section 2.2) */}
      <OverUnderUtilizedLists
        overUtilized={overUtilizedList}
        underUtilized={underUtilizedList}
      />

      {/* Row 3: Bench Report (Staff with >30% free capacity) */}
      <BenchReportTable benchList={benchReportList} />

      {/* Row 4: Skills Staffing & Single Point of Failure (SPOF) Analysis */}
      <SkillsStaffingSection />
    </div>
  );
}

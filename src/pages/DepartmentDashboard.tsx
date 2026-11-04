import React from "react";
import { GlobalFilterBar } from "@/components/analytics/GlobalFilterBar";
import { AnalyticsBreadcrumbs, BreadcrumbSegment } from "@/components/analytics/AnalyticsBreadcrumbs";
import { DepartmentKpiGrid } from "@/components/department/DepartmentKpiGrid";
import { DepartmentRosterTable } from "@/components/department/DepartmentRosterTable";
import { DepartmentAllocationMatrix } from "@/components/department/DepartmentAllocationMatrix";
import { DepartmentCategoryChart } from "@/components/department/DepartmentCategoryChart";
import { DepartmentWatchlist } from "@/components/department/DepartmentWatchlist";
import { useDepartmentAnalyticsData } from "@/hooks/useDepartmentAnalyticsData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Building2, Share2 } from "lucide-react";
import { toast } from "sonner";

export default function DepartmentDashboardPage() {
  const {
    selectedDepartment,
    setSelectedDepartment,
    availableDepartments,
    kpiCards,
    rosterRows,
    allocationMatrix,
    categoryDistribution,
    departmentWatchlist,
    isLoading,
  } = useDepartmentAnalyticsData();

  const copyShareableUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Shareable URL copied to clipboard!");
  };

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Executive Control Room", href: "/analytics" },
    { label: "Departments", level: "department" },
    { label: selectedDepartment, level: "department" },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto w-full pb-16">
      {/* 1. Header Toolbar & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="space-y-1">
          <AnalyticsBreadcrumbs segments={breadcrumbs} />
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Department Performance Hub
            </h1>
            {/* Department Selector */}
            <div className="w-[180px]">
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                  <div className="flex items-center gap-1.5 truncate">
                    <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <SelectValue placeholder="Select Department" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableDepartments.map((dept) => (
                    <SelectItem key={dept} value={dept} className="text-xs">
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Capacity management, team member pacing, project dedication, and operational health
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={copyShareableUrl}
            className="text-xs h-8 gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share View
          </Button>
        </div>
      </div>

      {/* 2. Global Filter Bar */}
      <GlobalFilterBar />

      {/* 3. 8 SSoT KPI Cards */}
      <DepartmentKpiGrid items={kpiCards} />

      {/* 4. Category Breakdown & Manager Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DepartmentCategoryChart data={categoryDistribution} isLoading={isLoading} />
        <DepartmentWatchlist alerts={departmentWatchlist} />
      </div>

      {/* 5. Member x Project Allocation Matrix */}
      <DepartmentAllocationMatrix
        projects={allocationMatrix.projects}
        rows={allocationMatrix.rows}
      />

      {/* 6. Member Roster Table */}
      <DepartmentRosterTable members={rosterRows} />
    </div>
  );
}


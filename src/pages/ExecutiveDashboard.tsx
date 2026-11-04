import React, { useState } from "react";
import { GlobalFilterBar } from "@/components/analytics/GlobalFilterBar";
import { ExecutiveOverviewTab } from "@/components/executive/overview/ExecutiveOverviewTab";
import { ExecutiveWorkforceTab } from "@/components/executive/workforce/ExecutiveWorkforceTab";
import { ExecutiveProjectPortfolioTab } from "@/components/executive/portfolio/ExecutiveProjectPortfolioTab";
import { ExecutiveDeliveryTab } from "@/components/executive/delivery/ExecutiveDeliveryTab";
import { ExecutiveComplianceTab } from "@/components/executive/compliance/ExecutiveComplianceTab";
import { ExecutiveClientsTab } from "@/components/executive/clients/ExecutiveClientsTab";
import { ExecutiveAlertsTab } from "@/components/executive/alerts/ExecutiveAlertsTab";
import { AnalyticsBreadcrumbs, BreadcrumbSegment } from "@/components/analytics/AnalyticsBreadcrumbs";
import { useExecutiveAnalyticsData } from "@/hooks/useExecutiveAnalyticsData";
import { useProjectAndDeliveryData } from "@/hooks/useProjectAndDeliveryData";
import { useComplianceAndClientData } from "@/hooks/useComplianceAndClientData";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Share2,
  BarChart3,
  Users,
  FolderKanban,
  CheckSquare,
  ShieldCheck,
  Briefcase,
  AlertCircle,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function ExecutiveDashboardPage() {
  const analyticsData = useExecutiveAnalyticsData();
  const projectDeliveryData = useProjectAndDeliveryData();
  const complianceData = useComplianceAndClientData();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [drilldownModalTitle, setDrilldownModalTitle] = useState<string | null>(null);

  const { summary } = analyticsData;

  const copyShareableUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Shareable URL copied to clipboard!");
  };

  const getTabLabel = (tab: string) => {
    switch (tab) {
      case "overview":
        return "Overview";
      case "workforce":
        return "Workforce & Skills";
      case "projects":
        return "Projects & Financials";
      case "delivery":
        return "Delivery & SLAs";
      case "compliance":
        return "Discipline & Compliance";
      case "alerts":
        return "Alerts & Exceptions";
      case "clients_targets":
        return "Clients & Targets";
      default:
        return "Overview";
    }
  };

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Executive Control Room", level: "company" },
    { label: getTabLabel(activeTab), level: "department" },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto w-full pb-16">
      {/* 1. Header Toolbar & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="space-y-1">
          <AnalyticsBreadcrumbs segments={breadcrumbs} />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Executive Control Room
          </h1>
          <p className="text-xs text-muted-foreground">
            Enterprise portfolio health, cross-functional utilization pacing, and compliance audit
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab("alerts")}
            className="h-8 text-xs font-semibold gap-1.5 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 hover:bg-rose-50"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Alerts & Rules
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab("clients_targets")}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <Sliders className="h-3.5 w-3.5 text-primary" />
            KPI Targets
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5"
            onClick={copyShareableUrl}
          >
            <Share2 className="h-3.5 w-3.5" /> Share View
          </Button>
        </div>
      </div>

      {/* 2. Global Filter Bar */}
      <GlobalFilterBar
        complianceRate={
          summary.totalNetCapacity > 0
            ? Math.min(100, Math.round((summary.totalLoggedHours / summary.totalNetCapacity) * 100))
            : 95
        }
        loggedHours={Math.round(summary.totalLoggedHours)}
        expectedHours={Math.round(summary.totalNetCapacity)}
        missingHours={Math.max(0, Math.round(summary.totalNetCapacity - summary.totalLoggedHours))}
      />

      {/* 3. Executive Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="border-b border-black/[0.08] dark:border-white/[0.08] overflow-x-auto">
          <TabsList className="bg-transparent h-10 p-0 space-x-1 flex justify-start">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-10 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>

            <TabsTrigger
              value="workforce"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-10 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap"
            >
              <Users className="h-3.5 w-3.5" />
              Workforce & Skills
            </TabsTrigger>

            <TabsTrigger
              value="projects"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-10 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap"
            >
              <FolderKanban className="h-3.5 w-3.5" />
              Projects & Financials
            </TabsTrigger>

            <TabsTrigger
              value="delivery"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-10 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Delivery & SLAs
            </TabsTrigger>

            <TabsTrigger
              value="compliance"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-10 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Discipline & Compliance
            </TabsTrigger>

            <TabsTrigger
              value="alerts"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-10 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap"
            >
              <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
              Alerts & Exceptions
            </TabsTrigger>

            <TabsTrigger
              value="clients_targets"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-10 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Clients & KPI Targets
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="outline-none focus:outline-none">
          <ExecutiveOverviewTab
            analyticsData={analyticsData}
            onDrilldown={(title) => setDrilldownModalTitle(title)}
          />
        </TabsContent>

        {/* Tab 2: Workforce & Skills */}
        <TabsContent value="workforce" className="outline-none focus:outline-none">
          <ExecutiveWorkforceTab analyticsData={analyticsData} />
        </TabsContent>

        {/* Tab 3: Projects & Financials */}
        <TabsContent value="projects" className="outline-none focus:outline-none">
          <ExecutiveProjectPortfolioTab data={projectDeliveryData} />
        </TabsContent>

        {/* Tab 4: Delivery & SLAs */}
        <TabsContent value="delivery" className="outline-none focus:outline-none">
          <ExecutiveDeliveryTab data={projectDeliveryData} />
        </TabsContent>

        {/* Tab 5: Discipline & Compliance */}
        <TabsContent value="compliance" className="outline-none focus:outline-none">
          <ExecutiveComplianceTab data={complianceData} />
        </TabsContent>

        {/* Tab 6: Alerts & Exceptions */}
        <TabsContent value="alerts" className="outline-none focus:outline-none">
          <ExecutiveAlertsTab />
        </TabsContent>

        {/* Tab 7: Clients & KPI Targets */}
        <TabsContent value="clients_targets" className="outline-none focus:outline-none">
          <ExecutiveClientsTab data={complianceData} />
        </TabsContent>
      </Tabs>

      {/* Drill-down modal */}
      <Dialog open={!!drilldownModalTitle} onOpenChange={(open) => !open && setDrilldownModalTitle(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{drilldownModalTitle}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Detailed audit trail and aggregated data view for the active date range.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-xs text-muted-foreground">
            Displaying filtered operational metrics for {analyticsData.summary.activeProjectsCount} active projects across {analyticsData.departmentBreakdown.length} departments.
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

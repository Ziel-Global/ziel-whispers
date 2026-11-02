import React, { useState } from "react";
import { GlobalFilterBar } from "@/components/analytics/GlobalFilterBar";
import { ExecutiveOverviewTab } from "@/components/executive/overview/ExecutiveOverviewTab";
import { ExecutiveWorkforceTab } from "@/components/executive/workforce/ExecutiveWorkforceTab";
import { useExecutiveAnalyticsData } from "@/hooks/useExecutiveAnalyticsData";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Share2, BarChart3, Users, FolderKanban, CheckSquare, ShieldCheck, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function ExecutiveDashboardPage() {
  const analyticsData = useExecutiveAnalyticsData();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [drilldownModalTitle, setDrilldownModalTitle] = useState<string | null>(null);

  const { summary } = analyticsData;

  const copyShareableUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Shareable URL with current filter scope copied!");
  };

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto w-full pb-16">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Executive Control Room
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enterprise portfolio health, cross-functional utilization pacing, and delivery risks.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs font-semibold gap-1.5 self-start sm:self-auto"
          onClick={copyShareableUrl}
        >
          <Share2 className="h-3.5 w-3.5" /> Share View
        </Button>
      </div>

      {/* 2. Global Filter Bar & Data Trust Badge */}
      <GlobalFilterBar
        complianceRate={summary.totalNetCapacity > 0 ? Math.min(100, Math.round((summary.totalLoggedHours / summary.totalNetCapacity) * 100)) : 95}
        loggedHours={Math.round(summary.totalLoggedHours)}
        expectedHours={Math.round(summary.totalNetCapacity)}
        missingHours={Math.max(0, Math.round(summary.totalNetCapacity - summary.totalLoggedHours))}
      />

      {/* 3. Executive Tabs Navigation (Sections 2.1 – 2.8) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="border-b border-black/[0.08] dark:border-white/[0.08]">
          <TabsList className="bg-transparent h-10 p-0 space-x-2">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-10 px-3.5 text-xs font-semibold gap-1.5"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>

            <TabsTrigger
              value="workforce"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-10 px-3.5 text-xs font-semibold gap-1.5"
            >
              <Users className="h-3.5 w-3.5" />
              Workforce & Utilization
            </TabsTrigger>

            <TabsTrigger
              value="projects"
              disabled
              className="opacity-50 border-b-2 border-transparent rounded-none h-10 px-3 text-xs font-medium gap-1.5 cursor-not-allowed"
              title="Delivering in Module 5"
            >
              <FolderKanban className="h-3.5 w-3.5" />
              Projects (M5)
            </TabsTrigger>

            <TabsTrigger
              value="delivery"
              disabled
              className="opacity-50 border-b-2 border-transparent rounded-none h-10 px-3 text-xs font-medium gap-1.5 cursor-not-allowed"
              title="Delivering in Module 5"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Delivery & Quality (M5)
            </TabsTrigger>

            <TabsTrigger
              value="compliance"
              disabled
              className="opacity-50 border-b-2 border-transparent rounded-none h-10 px-3 text-xs font-medium gap-1.5 cursor-not-allowed"
              title="Delivering in Module 6"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Compliance (M6)
            </TabsTrigger>

            <TabsTrigger
              value="clients"
              disabled
              className="opacity-50 border-b-2 border-transparent rounded-none h-10 px-3 text-xs font-medium gap-1.5 cursor-not-allowed"
              title="Delivering in Module 6"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Clients (M6)
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

        {/* Tab 2: Workforce & Utilization */}
        <TabsContent value="workforce" className="outline-none focus:outline-none">
          <ExecutiveWorkforceTab analyticsData={analyticsData} />
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


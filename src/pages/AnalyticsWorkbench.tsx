import React, { useState } from "react";
import { GlobalFilterBar } from "@/components/analytics/GlobalFilterBar";
import { AnalyticsChartCard } from "@/components/analytics/AnalyticsChartCard";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Share2,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";

export default function AnalyticsWorkbenchPage() {
  const [drilldownModal, setDrilldownModal] = useState<string | null>(null);

  const copyShareableUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Shareable URL with all active filters copied to clipboard!");
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Workforce Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cross-departmental performance metrics, utilization rates, and delivery predictability.
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

      {/* 1. Global Filter Bar */}
      <GlobalFilterBar
        complianceRate={94}
        loggedHours={1240}
        expectedHours={1320}
        missingHours={80}
      />

      {/* 2. Executive Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Billable Utilization */}
        <AnalyticsChartCard
          question="Are we spending hours faster than we finish work?"
          title="Billable Utilization vs. Net Capacity"
          subtitle="Pacing for the selected period across active projects"
          formula="(Billable Logged Hours / Net Working Capacity) × 100"
          target="Target: 75% – 85%"
          targetMet={true}
          onDrilldown={() => setDrilldownModal("Billable Utilization Details")}
          tableContent={
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 font-medium">Project</th>
                  <th className="py-1.5 font-medium">Logged</th>
                  <th className="py-1.5 font-medium">Capacity</th>
                  <th className="py-1.5 font-medium">Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                <tr>
                  <td className="py-1.5 font-semibold">Acme Portal v2</td>
                  <td className="py-1.5">142h</td>
                  <td className="py-1.5">160h</td>
                  <td className="py-1.5 text-emerald-600 font-bold">88.7%</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-semibold">Internal Automation</td>
                  <td className="py-1.5">48h</td>
                  <td className="py-1.5">60h</td>
                  <td className="py-1.5 text-blue-600 font-bold">80.0%</td>
                </tr>
              </tbody>
            </table>
          }
        >
          <div className="h-44 flex flex-col justify-center items-center bg-black/[0.01] dark:bg-white/[0.01] rounded-lg border border-dashed p-4 text-center">
            <BarChart2 className="h-8 w-8 text-primary mb-2 opacity-80" />
            <p className="text-xs font-semibold text-foreground">Utilization Trend</p>
            <p className="text-[11px] text-muted-foreground max-w-sm mt-0.5">
              Toggle between visual chart and data table above, or view formula details.
            </p>
          </div>
        </AnalyticsChartCard>

        {/* Card 2: On-Time Delivery */}
        <AnalyticsChartCard
          question="How predictable is our sprint delivery across teams?"
          title="On-Time Delivery Rate & Estimate Accuracy"
          subtitle="Sprint tasks completed on or before baseline due dates"
          formula="(Tasks Completed On Time / Total Completed Tasks) × 100"
          target="Target: > 85%"
          targetMet={true}
          onDrilldown={() => setDrilldownModal("On-Time Delivery Breakdown")}
          tableContent={
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 font-medium">Sprint / Phase</th>
                  <th className="py-1.5 font-medium">Completed</th>
                  <th className="py-1.5 font-medium">On-Time</th>
                  <th className="py-1.5 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                <tr>
                  <td className="py-1.5 font-semibold">Sprint 14: Mobile App</td>
                  <td className="py-1.5">28 tasks</td>
                  <td className="py-1.5">26 tasks</td>
                  <td className="py-1.5 text-emerald-600 font-bold">92.8%</td>
                </tr>
                <tr>
                  <td className="py-1.5 font-semibold">Sprint 15: Payment Flow</td>
                  <td className="py-1.5">19 tasks</td>
                  <td className="py-1.5">17 tasks</td>
                  <td className="py-1.5 text-emerald-600 font-bold">89.4%</td>
                </tr>
              </tbody>
            </table>
          }
        >
          <div className="h-44 flex flex-col justify-center items-center bg-black/[0.01] dark:bg-white/[0.01] rounded-lg border border-dashed p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-80" />
            <p className="text-xs font-semibold text-foreground">89.6% Overall Predictability</p>
            <p className="text-[11px] text-muted-foreground max-w-sm mt-0.5">
              Target reference line active. Click details to inspect breakdown.
            </p>
          </div>
        </AnalyticsChartCard>
      </div>
    </div>
  );
}

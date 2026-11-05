import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";

// Sub-report tab components
import { CatalogReportTab } from "@/components/reports/tabs/CatalogReportTab";
import { UtilizationReport } from "@/components/reports/tabs/UtilizationReport";
import { HeatmapReport } from "@/components/reports/tabs/HeatmapReport";
import { MonthlySummaryReport } from "@/components/reports/tabs/MonthlySummaryReport";
import { AttendanceTrendReport } from "@/components/reports/tabs/AttendanceTrendReport";
import { DailyLogsReport } from "@/components/reports/tabs/DailyLogsReport";
import { LeaveReport } from "@/components/reports/tabs/LeaveReport";
import { MissedLogsReport } from "@/components/reports/tabs/MissedLogsReport";

// Modals
import { ScheduledReportsModal } from "@/components/reports/ScheduledReportsModal";
import { ReportGeneratorModal } from "@/components/reports/ReportGeneratorModal";

const REPORT_TABS = [
  { value: "catalog", label: "Report Library (13)" },
  { value: "utilization", label: "Utilization" },
  { value: "heatmap", label: "Heatmap" },
  { value: "monthly", label: "Monthly Summary" },
  { value: "attendance", label: "Attendance Trends" },
  { value: "logs", label: "Daily Logs" },
  { value: "leave", label: "Leave Report" },
  { value: "missed", label: "Missed Logs" },
] as const;

export default function ReportsPage() {
  const [tab, setTab] = useState<string>("catalog");
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string>("REPORT_01_EXEC_WEEKLY");

  const handleOpenGenerator = (reportId?: string) => {
    if (reportId) setSelectedReportId(reportId);
    setIsGeneratorModalOpen(true);
  };

  const tabBodyClass =
    "mt-0 flex-1 min-h-0 overflow-y-auto data-[state=inactive]:hidden focus-visible:outline-none";

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 gap-4 overflow-hidden">
      {/* Top Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.55px] leading-[1.15] text-[#17171A]">
            Reports & Intelligence Hub
          </h1>
          <p className="text-[12px] text-[#8B8B92] mt-[5px] leading-relaxed">
            13 scheduled and on-demand blueprints, workforce capacity, attendance, and compliance audits
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsScheduleModalOpen(true)}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            <Calendar className="h-3.5 w-3.5 text-primary" />
            Scheduled Deliveries
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenGenerator()}
            className="text-xs h-8 gap-1.5 font-semibold bg-rose-600 hover:bg-rose-700 text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Export Any Report (PDF / XLSX)
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0 overflow-hidden gap-4">
        <TabsList className="flex w-full h-auto gap-1 bg-[#F6F5F3] border border-black/[0.06] rounded-[11px] p-[5px] overflow-x-auto justify-start scrollbar-none shrink-0">
          {REPORT_TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className={cn(
                "h-[34px] px-3.5 rounded-lg text-[11.5px] font-medium text-[#7D7D84] whitespace-nowrap shrink-0 shadow-none",
                "data-[state=active]:bg-[#17171A] data-[state=active]:text-white data-[state=active]:font-bold",
                "hover:text-[#3F3F45] data-[state=inactive]:bg-transparent"
              )}
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab Contents */}
        <TabsContent value="catalog" className={tabBodyClass}>
          <CatalogReportTab onSelectReport={handleOpenGenerator} />
        </TabsContent>
        <TabsContent value="utilization" className={tabBodyClass}>
          <UtilizationReport />
        </TabsContent>
        <TabsContent value="heatmap" className={tabBodyClass}>
          <HeatmapReport />
        </TabsContent>
        <TabsContent value="monthly" className={tabBodyClass}>
          <MonthlySummaryReport />
        </TabsContent>
        <TabsContent value="attendance" className={tabBodyClass}>
          <AttendanceTrendReport />
        </TabsContent>
        <TabsContent value="logs" className={tabBodyClass}>
          <DailyLogsReport />
        </TabsContent>
        <TabsContent value="leave" className={tabBodyClass}>
          <LeaveReport />
        </TabsContent>
        <TabsContent value="missed" className={tabBodyClass}>
          <MissedLogsReport />
        </TabsContent>
      </Tabs>

      {/* Scheduled Deliveries Modal */}
      <ScheduledReportsModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />

      {/* On-Demand Report Generator Modal */}
      <ReportGeneratorModal
        isOpen={isGeneratorModalOpen}
        onClose={() => setIsGeneratorModalOpen(false)}
        initialReportId={selectedReportId}
      />
    </div>
  );
}

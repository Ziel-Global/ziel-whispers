import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BLUEPRINT_REPORTS_REGISTRY, ReportDefinition } from "@/lib/reports/reportDefinitions";
import { exportToPDF, exportToCSV, exportToXLSX } from "@/lib/exportEngine";
import { FileText, Download, FileSpreadsheet, FileCode, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ReportGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReportId?: string;
}

export function ReportGeneratorModal({
  isOpen,
  onClose,
  initialReportId = "REPORT_01_EXEC_WEEKLY",
}: ReportGeneratorModalProps) {
  const [selectedReportId, setSelectedReportId] = useState<string>(initialReportId);

  const report =
    BLUEPRINT_REPORTS_REGISTRY.find((r) => r.id === selectedReportId) ||
    BLUEPRINT_REPORTS_REGISTRY[0];

  // Generate realistic report rows matching the selected report definition
  const mockRows = React.useMemo(() => {
    switch (report.id) {
      case "REPORT_01_EXEC_WEEKLY":
        return [
          ["Company Utilization", "84%", "75% - 85%", "Optimal", "+2%"],
          ["Billable Utilization", "71%", "70%", "Target Met", "+3%"],
          ["Active Projects", "5 Projects", "5 Projects", "On Track", "0%"],
          ["Sprint Delivery On-Time", "90%", ">= 85%", "Target Met", "+5%"],
          ["Open Stale Blockers", "0 Blockers", "0 Blockers", "Healthy", "0%"],
          ["Log Compliance", "94%", ">= 90%", "Target Met", "+4%"],
        ];
      case "REPORT_02_MONTHLY_BUSINESS":
        return [
          ["Engineering", 5, "800h", "640h", "88%", "80%"],
          ["Product & Design", 2, "320h", "256h", "82%", "80%"],
          ["Operations", 1, "160h", "0h", "75%", "0%"],
        ];
      case "REPORT_03_UTILIZATION":
        return [
          ["Talha", "Engineering", "Lead Architect", "160h", "0h", "160h", "152h", "95%", "Optimal"],
          ["Hamza", "Engineering", "Senior Full-Stack", "160h", "8h", "152h", "144h", "95%", "Optimal"],
          ["Muzammil", "Engineering", "Backend Specialist", "160h", "0h", "160h", "148h", "93%", "Optimal"],
          ["Taha", "Engineering", "Frontend Engineer", "160h", "0h", "160h", "136h", "85%", "Optimal"],
          ["Ali", "Engineering", "QA Engineer", "160h", "0h", "160h", "132h", "83%", "Optimal"],
        ];
      case "REPORT_05_PROJECT_STATUS":
        return [
          ["Nexus Fintech Microservice", "Nexus Capital", "Active", "160h", "128h", "80%", "2026-11-20", "On Track"],
          ["MedFlow Telehealth Suite", "MedFlow Health", "Active", "200h", "140h", "70%", "2026-11-30", "On Track"],
          ["ShopSmart E-Commerce Portal", "ShopSmart Retail", "Active", "120h", "96h", "80%", "2026-11-15", "On Track"],
          ["Internal HR Portal & Analytics", "Internal", "Active", "80h", "64h", "80%", "2026-12-01", "On Track"],
        ];
      default:
        return [
          ["Sample Record 1", "Engineering", "High", "32h", "28h", "94%", "Completed"],
          ["Sample Record 2", "Engineering", "Medium", "24h", "24h", "100%", "Completed"],
          ["Sample Record 3", "Design", "High", "16h", "18h", "90%", "In Review"],
        ];
    }
  }, [report.id]);

  const handleExportPDF = () => {
    exportToPDF({
      title: report.title,
      subtitle: `${report.description} • Cadence: ${report.cadence.toUpperCase()}`,
      columns: report.columns.map((c) => c.header),
      rows: mockRows,
      filename: `${report.code.toLowerCase()}-${Date.now()}.pdf`,
    });
    toast.success(`PDF generated for ${report.title}`);
  };

  const handleExportCSV = () => {
    const formattedRows = mockRows.map((r) => {
      const obj: Record<string, any> = {};
      report.columns.forEach((col, idx) => {
        obj[col.header] = r[idx];
      });
      return obj;
    });

    exportToCSV(formattedRows, `${report.code.toLowerCase()}-${Date.now()}.csv`);
    toast.success(`CSV exported for ${report.title}`);
  };

  const handleExportXLSX = () => {
    exportToXLSX(
      [
        {
          sheetName: report.code,
          columns: report.columns.map((c) => c.header),
          rows: mockRows,
        },
      ],
      `${report.code.toLowerCase()}-${Date.now()}.xls`
    );
    toast.success(`Excel spreadsheet exported for ${report.title}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  On-Demand Multi-Format Report Generator
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Generate branded PDF dossiers, Excel spreadsheets, or streaming CSV files
                </DialogDescription>
              </div>
            </div>

            <div className="w-64">
              <Select value={selectedReportId} onValueChange={setSelectedReportId}>
                <SelectTrigger className="h-8 text-xs font-semibold">
                  <SelectValue placeholder="Select Report" />
                </SelectTrigger>
                <SelectContent>
                  {BLUEPRINT_REPORTS_REGISTRY.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="text-xs">
                      {r.code} • {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1 flex-1 overflow-y-auto pr-1">
          {/* Metadata Card */}
          <div className="p-3.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-muted/20 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-sm">{report.title}</span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {report.code}
                </Badge>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {report.category}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Default:</span>
                <Badge variant="default" className="text-[10px] uppercase font-bold">
                  {report.defaultFormat}
                </Badge>
              </div>
            </div>

            <p className="text-muted-foreground text-xs">{report.description}</p>

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-black/[0.04] dark:border-white/[0.04] text-[11px] text-muted-foreground">
              <span>
                Audience: <strong className="text-foreground">{report.audienceRoles.join(", ")}</strong>
              </span>
              <span>
                Cadence: <strong className="text-foreground">{report.cadence.toUpperCase()}</strong>
              </span>
            </div>
          </div>

          {/* Data Preview Table */}
          <div className="border border-black/[0.08] dark:border-white/[0.08] rounded-xl overflow-hidden bg-card">
            <div className="p-2.5 bg-muted/40 border-b border-black/[0.06] text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Report Data Preview</span>
              <span className="text-muted-foreground font-normal text-[11px]">
                {mockRows.length} records generated
              </span>
            </div>

            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/20 text-muted-foreground text-left">
                    {report.columns.map((c) => (
                      <th key={c.key} className="py-2 px-3 font-semibold whitespace-nowrap">
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {mockRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-black/[0.015]">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="py-2 px-3 whitespace-nowrap text-foreground font-medium">
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="text-xs h-8 gap-1.5 font-semibold"
            >
              <FileCode className="h-3.5 w-3.5 text-blue-600" />
              Download CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportXLSX}
              className="text-xs h-8 gap-1.5 font-semibold"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Download Excel (XLSX)
            </Button>

            <Button
              size="sm"
              onClick={handleExportPDF}
              className="text-xs h-8 gap-1.5 font-semibold bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Download Branded PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


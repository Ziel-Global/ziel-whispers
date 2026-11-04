import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BLUEPRINT_REPORTS_REGISTRY, ReportDefinition } from "@/lib/reports/reportDefinitions";
import { FileText, Download, Search, Play, FileSpreadsheet, FileCode } from "lucide-react";

interface CatalogReportTabProps {
  onSelectReport: (reportId: string) => void;
}

export function CatalogReportTab({ onSelectReport }: CatalogReportTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredReports = BLUEPRINT_REPORTS_REGISTRY.filter((r) => {
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categories = [
    { value: "all", label: "All Reports (13)" },
    { value: "executive", label: "Executive (2)" },
    { value: "workforce", label: "Workforce (3)" },
    { value: "project", label: "Projects & Clients (3)" },
    { value: "compliance", label: "Compliance & Timesheets (3)" },
    { value: "delivery", label: "Sprint Delivery (2)" },
  ];

  return (
    <div className="space-y-4">
      {/* Category Buttons & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map((c) => (
            <Button
              key={c.value}
              variant={categoryFilter === c.value ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(c.value)}
              className="text-xs h-7 px-2.5 rounded-lg"
            >
              {c.label}
            </Button>
          ))}
        </div>

        <div className="relative w-56">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search report catalog..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Grid of Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredReports.map((report) => (
          <Card
            key={report.id}
            className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm flex flex-col justify-between hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="font-mono text-[10px] font-bold">
                  {report.code}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                    {report.category}
                  </Badge>
                  <Badge variant="default" className="text-[10px] uppercase font-bold">
                    {report.defaultFormat}
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground leading-tight">{report.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {report.description}
                </p>
              </div>

              <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04] text-[11px] text-muted-foreground space-y-0.5">
                <p>
                  Cadence: <strong className="text-foreground">{report.cadence.toUpperCase()}</strong>
                </p>
                <p>
                  Columns: <strong className="text-foreground">{report.columns.length} metric fields</strong>
                </p>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-black/[0.05] dark:border-white/[0.05] flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">
                For: {report.audienceRoles.slice(0, 2).join(", ")}
              </span>

              <Button
                size="sm"
                onClick={() => onSelectReport(report.id)}
                className="h-7 text-xs px-2.5 gap-1.5 font-semibold"
              >
                <Play className="h-3 w-3" /> Generate
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}


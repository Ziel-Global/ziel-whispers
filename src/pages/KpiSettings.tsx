import React, { useState } from "react";
import { AnalyticsBreadcrumbs, BreadcrumbSegment } from "@/components/analytics/AnalyticsBreadcrumbs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  loadKpiTargets,
  saveKpiTargets,
  resetKpiTargets,
  KpiTargetConfig,
  DEFAULT_KPI_TARGETS,
} from "@/lib/kpiTargetConfig";
import { Sliders, RotateCcw, Save, CheckCircle2, Target, Info } from "lucide-react";
import { toast } from "sonner";

export default function KpiSettingsPage() {
  const [config, setConfig] = useState<KpiTargetConfig>(loadKpiTargets);

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Executive Control Room", href: "/analytics" },
    { label: "Configurable KPI Targets", level: "company" },
  ];

  const handleSave = () => {
    saveKpiTargets(config);
    toast.success("KPI target thresholds saved and applied across all analytics modules!");
  };

  const handleReset = () => {
    const defaults = resetKpiTargets();
    setConfig(defaults);
    toast.info("KPI targets reset to Blueprint SSoT defaults.");
  };

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto w-full pb-16">
      {/* 1. Header Toolbar & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="space-y-1">
          <AnalyticsBreadcrumbs segments={breadcrumbs} />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Configurable KPI Targets & RAG Thresholds
          </h1>
          <p className="text-xs text-muted-foreground">
            Customize target benchmarks and SLA trigger parameters across all workforce cockpits
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Defaults
          </Button>

          <Button size="sm" onClick={handleSave} className="text-xs h-8 gap-1.5 font-semibold">
            <Save className="h-3.5 w-3.5" />
            Save Targets
          </Button>
        </div>
      </div>

      {/* 2. Target Configuration Cards */}
      <div className="space-y-4">
        {/* Workforce Utilization & Burnout */}
        <Card className="p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
            <Target className="h-4 w-4 text-primary" />
            <div>
              <h3 className="text-sm font-bold text-foreground">Workforce Utilization & Burnout Targets</h3>
              <p className="text-xs text-muted-foreground">SSoT bounds for balanced employee engagement</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Min Target Utilization %</label>
              <p className="text-[10px] text-muted-foreground mb-1">Below this triggers 'Watch' band</p>
              <Input
                type="number"
                value={config.companyUtilizationMin}
                onChange={(e) => setConfig({ ...config, companyUtilizationMin: Number(e.target.value) })}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Max Target Utilization %</label>
              <p className="text-[10px] text-muted-foreground mb-1">Upper optimal utilization boundary</p>
              <Input
                type="number"
                value={config.companyUtilizationMax}
                onChange={(e) => setConfig({ ...config, companyUtilizationMax: Number(e.target.value) })}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Burnout Threshold %</label>
              <p className="text-[10px] text-muted-foreground mb-1">Triggers overutilization warning</p>
              <Input
                type="number"
                value={config.burnoutUtilizationPct}
                onChange={(e) => setConfig({ ...config, burnoutUtilizationPct: Number(e.target.value) })}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        </Card>

        {/* Delivery SLAs & Compliance */}
        <Card className="p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-foreground">Delivery SLAs & Compliance Benchmarks</h3>
              <p className="text-xs text-muted-foreground">Thresholds for sprints, daily logging, and blocker escalation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Billable Utilization Target %</label>
              <p className="text-[10px] text-muted-foreground mb-1">Company-wide billable ratio goal</p>
              <Input
                type="number"
                value={config.billableUtilizationTarget}
                onChange={(e) => setConfig({ ...config, billableUtilizationTarget: Number(e.target.value) })}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Daily Log Compliance %</label>
              <p className="text-[10px] text-muted-foreground mb-1">On-time daily submission threshold</p>
              <Input
                type="number"
                value={config.logComplianceTarget}
                onChange={(e) => setConfig({ ...config, logComplianceTarget: Number(e.target.value) })}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">On-Time Sprint Delivery %</label>
              <p className="text-[10px] text-muted-foreground mb-1">SLA for completed sprint tasks</p>
              <Input
                type="number"
                value={config.onTimeDeliveryTarget}
                onChange={(e) => setConfig({ ...config, onTimeDeliveryTarget: Number(e.target.value) })}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        </Card>

        {/* Project Health & Financial Margin */}
        <Card className="p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
            <Sliders className="h-4 w-4 text-purple-600" />
            <div>
              <h3 className="text-sm font-bold text-foreground">Project Budget & Financial Margins</h3>
              <p className="text-xs text-muted-foreground">Alert points for budget burn and profit margins</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Target Gross Margin %</label>
              <p className="text-[10px] text-muted-foreground mb-1">Standard profitability target</p>
              <Input
                type="number"
                value={config.grossMarginTarget}
                onChange={(e) => setConfig({ ...config, grossMarginTarget: Number(e.target.value) })}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Budget Burn Warning %</label>
              <p className="text-[10px] text-muted-foreground mb-1">First alert threshold</p>
              <Input
                type="number"
                value={config.budgetBurnWarningPct}
                onChange={(e) => setConfig({ ...config, budgetBurnWarningPct: Number(e.target.value) })}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Max Blocker Age (Days)</label>
              <p className="text-[10px] text-muted-foreground mb-1">Unresolved blocker alert threshold</p>
              <Input
                type="number"
                value={config.maxBlockerAgeDays}
                onChange={(e) => setConfig({ ...config, maxBlockerAgeDays: Number(e.target.value) })}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}


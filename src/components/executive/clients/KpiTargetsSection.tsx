import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  loadKpiTargets,
  saveKpiTargets,
  resetKpiTargets,
  KpiTargetConfig,
} from "@/lib/kpiTargetConfig";
import { Target, RotateCcw, Save, Sliders } from "lucide-react";
import { toast } from "sonner";

export function KpiTargetsSection() {
  const [config, setConfig] = useState<KpiTargetConfig>(loadKpiTargets);

  const handleSave = () => {
    saveKpiTargets(config);
    toast.success("KPI Target Benchmarks updated successfully!");
  };

  const handleReset = () => {
    const defaults = resetKpiTargets();
    setConfig(defaults);
    toast.info("Targets reset to SSoT defaults.");
  };

  return (
    <Card className="p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Configurable KPI Targets & RAG Thresholds
            </h3>
            <p className="text-xs text-muted-foreground">
              Adjust operational target bounds dynamically across company dashboards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> Reset Defaults
          </Button>
          <Button size="sm" onClick={handleSave} className="text-xs h-7 gap-1 font-semibold">
            <Save className="h-3 w-3" /> Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Min Utilization %</label>
          <Input
            type="number"
            value={config.companyUtilizationMin}
            onChange={(e) => setConfig({ ...config, companyUtilizationMin: Number(e.target.value) })}
            className="h-8 text-xs font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Max Utilization %</label>
          <Input
            type="number"
            value={config.companyUtilizationMax}
            onChange={(e) => setConfig({ ...config, companyUtilizationMax: Number(e.target.value) })}
            className="h-8 text-xs font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Billable Target %</label>
          <Input
            type="number"
            value={config.billableUtilizationTarget}
            onChange={(e) => setConfig({ ...config, billableUtilizationTarget: Number(e.target.value) })}
            className="h-8 text-xs font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Target Gross Margin %</label>
          <Input
            type="number"
            value={config.grossMarginTarget}
            onChange={(e) => setConfig({ ...config, grossMarginTarget: Number(e.target.value) })}
            className="h-8 text-xs font-mono"
          />
        </div>
      </div>
    </Card>
  );
}


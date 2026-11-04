import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface ProjectSettingsModalProps {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  projectSettings: any;
  project?: any;
  saveProjectSettings: (vals: any) => Promise<void>;
  updateProjectCommercials?: (vals: any) => Promise<void>;
}

export function ProjectSettingsModal(props: ProjectSettingsModalProps) {
  const {
    settingsOpen,
    setSettingsOpen,
    projectSettings,
    project,
    saveProjectSettings,
    updateProjectCommercials,
  } = props;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // 1. Threshold settings for project_settings table
    const settingsVals = {
      at_risk_variance_percent: Number(fd.get("at_risk_variance_percent")),
      delayed_variance_percent: Number(fd.get("delayed_variance_percent")),
      blocker_warning_days: Number(fd.get("blocker_warning_days")),
      critical_blocker_warning_days: Number(fd.get("critical_blocker_warning_days")),
      hours_per_day: Number(fd.get("hours_per_day")),
    };

    // 2. Budget and baseline dates for projects table
    const budgetVal = fd.get("budget_hours");
    const baselineDate = fd.get("baseline_end_date");
    const billingType = fd.get("billing_type") as string;
    const isBillable = fd.get("is_billable") === "on";

    const projectVals = {
      budget_hours: budgetVal ? Number(budgetVal) : null,
      baseline_end_date: baselineDate ? String(baselineDate) : null,
      billing_type: billingType || "t_and_m",
      is_billable: isBillable,
    };

    if (updateProjectCommercials) {
      await updateProjectCommercials(projectVals);
    }
    await saveProjectSettings(settingsVals);
  };

  return (
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Project Configuration & Analytics Parameters</DialogTitle>
        </DialogHeader>

        {projectSettings ? (
          <form onSubmit={handleSubmit} className="space-y-5 pt-1">
            {/* 1. Commercials & Budget Baseline (Blueprint Module 1 & 5) */}
            <div className="space-y-3">
              <div className="pb-1.5 border-b">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Commercials & Capacity Budget
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Budget Hours (Capacity Cap)</Label>
                  <Input
                    name="budget_hours"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 160"
                    defaultValue={project?.budget_hours ?? ""}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Used to calculate Project Burn % in Analytics</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Baseline Delivery Date</Label>
                  <Input
                    name="baseline_end_date"
                    type="date"
                    defaultValue={project?.baseline_end_date ?? ""}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Contract target for Schedule Variance calculation</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Billing Type</Label>
                  <Select name="billing_type" defaultValue={project?.billing_type || "t_and_m"}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="t_and_m">Time & Materials (T&M)</SelectItem>
                      <SelectItem value="fixed">Fixed Price</SelectItem>
                      <SelectItem value="retainer">Retainer</SelectItem>
                      <SelectItem value="internal">Internal Project</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-4 pr-1">
                  <div>
                    <Label className="text-xs font-medium">Billable Project</Label>
                    <p className="text-[10px] text-muted-foreground">Logged hours count as billable</p>
                  </div>
                  <input
                    type="checkbox"
                    name="is_billable"
                    defaultChecked={project?.is_billable !== false}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* 2. Health & Variance Thresholds */}
            <div className="space-y-3 pt-1">
              <div className="pb-1.5 border-b">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Health & Risk Thresholds
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">At Risk Variance (%)</Label>
                  <Input
                    name="at_risk_variance_percent"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={projectSettings.at_risk_variance_percent}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Burndown variance % moving health to "At Risk"</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Delayed Variance (%)</Label>
                  <Input
                    name="delayed_variance_percent"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={projectSettings.delayed_variance_percent}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Burndown variance % moving health to "Delayed"</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Blocker Warning (days)</Label>
                  <Input
                    name="blocker_warning_days"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={projectSettings.blocker_warning_days}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Open blocker age threshold</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">Critical Blocker Warning (days)</Label>
                  <Input
                    name="critical_blocker_warning_days"
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={projectSettings.critical_blocker_warning_days}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Critical path blocker age threshold</p>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-medium">Working Hours Per Day</Label>
                  <Input
                    name="hours_per_day"
                    type="number"
                    min="1"
                    step="0.5"
                    defaultValue={projectSettings.hours_per_day}
                    className="h-8 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">Converts estimated hours to calendar days</p>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button type="button" variant="outline" size="sm" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-semibold px-5">
                Save Settings
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground py-4">Loading settings...</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

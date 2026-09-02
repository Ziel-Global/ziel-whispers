import { Input } from "@/components/ui/input";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface ProjectSettingsModalProps {
  settingsOpen: boolean; setSettingsOpen: (open: boolean) => void;
  projectSettings: any;
saveProjectSettings: (e: React.FormEvent) => void;
}

export function ProjectSettingsModal(props: ProjectSettingsModalProps) {
  const { settingsOpen, setSettingsOpen, projectSettings, saveProjectSettings } = props;

  return (
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
          </DialogHeader>
          {projectSettings ? (
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); saveProjectSettings({ at_risk_variance_percent: Number(fd.get("at_risk_variance_percent")), delayed_variance_percent: Number(fd.get("delayed_variance_percent")), blocker_warning_days: Number(fd.get("blocker_warning_days")), critical_blocker_warning_days: Number(fd.get("critical_blocker_warning_days")), hours_per_day: Number(fd.get("hours_per_day")) }); }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">At Risk Variance (%)</label>
                <Input name="at_risk_variance_percent" type="number" min="0" step="1" defaultValue={projectSettings.at_risk_variance_percent} />
                <p className="text-[11px] text-muted-foreground">Burndown variance % that moves health to "at risk"</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Delayed Variance (%)</label>
                <Input name="delayed_variance_percent" type="number" min="0" step="1" defaultValue={projectSettings.delayed_variance_percent} />
                <p className="text-[11px] text-muted-foreground">Burndown variance % that moves health to "delayed"</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Blocker Warning (days)</label>
                <Input name="blocker_warning_days" type="number" min="1" step="1" defaultValue={projectSettings.blocker_warning_days} />
                <p className="text-[11px] text-muted-foreground">Open blocker age in days before it contributes to "delayed"</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Critical Blocker Warning (days)</label>
                <Input name="critical_blocker_warning_days" type="number" min="1" step="1" defaultValue={projectSettings.critical_blocker_warning_days} />
                <p className="text-[11px] text-muted-foreground">Blocker on critical-path task age in days before "delayed"</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Hours Per Day</label>
                <Input name="hours_per_day" type="number" min="1" step="0.5" defaultValue={projectSettings.hours_per_day} />
                <p className="text-[11px] text-muted-foreground">Used to convert estimated hours to calendar days for critical path</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground py-4">Loading settings...</p>
          )}
        </DialogContent>
      </Dialog>
  );
}

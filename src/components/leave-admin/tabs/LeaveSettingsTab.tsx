import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save } from "lucide-react";
import { LEAVE_CATEGORIES } from "@/hooks/useLeaveAdminData";

export interface LeaveSettingsTabProps {
  annualEntitlement: string;
  setAnnualEntitlement: (v: string) => void;
  savingEntitlement: boolean;
  handleSaveEntitlement: () => Promise<void>;
  bulkRemoteFrom: string;
  setBulkRemoteFrom: (v: string) => void;
  bulkRemoteTo: string;
  setBulkRemoteTo: (v: string) => void;
  bulkRemoteSubmitting: boolean;
  setShowBulkEnableConfirm: (v: boolean) => void;
  setShowBulkDisableConfirm: (v: boolean) => void;
}

export function LeaveSettingsTab({
  annualEntitlement,
  setAnnualEntitlement,
  savingEntitlement,
  handleSaveEntitlement,
  bulkRemoteFrom,
  setBulkRemoteFrom,
  bulkRemoteTo,
  setBulkRemoteTo,
  bulkRemoteSubmitting,
  setShowBulkEnableConfirm,
  setShowBulkDisableConfirm,
}: LeaveSettingsTabProps) {
  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Leave Configuration</h3>
          <Button onClick={handleSaveEntitlement} disabled={savingEntitlement} className="rounded-button">
            <Save className="h-4 w-4 mr-2" />
            {savingEntitlement ? "Saving…" : "Save"}
          </Button>
        </div>

        <div className="space-y-1 max-w-xs">
          <Label>Annual Leave Entitlement (days)</Label>
          <Input
            type="number"
            value={annualEntitlement}
            onChange={(e) => setAnnualEntitlement(e.target.value)}
            min="0"
            max="365"
          />
          <p className="text-xs text-muted-foreground">
            Total annual leave days each employee is entitled to per year. All leave types draw from this single pool.
          </p>
        </div>

        <div className="mt-4">
          <Label className="text-sm font-medium">Leave Categories (for tracking)</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {LEAVE_CATEGORIES.map((c) => (
              <Badge key={c} variant="outline">
                {c}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            These categories are fixed and used for tracking purposes only. All draw from the single annual pool.
          </p>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Remote Access</h3>
        <p className="text-sm text-muted-foreground">
          Enable or disable remote work for all non-admin users at once. Employees who already have individual remote
          access enabled will be skipped.
        </p>

        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <div className="space-y-1">
            <Label>From Date</Label>
            <Input type="date" value={bulkRemoteFrom} onChange={(e) => setBulkRemoteFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>To Date</Label>
            <Input type="date" value={bulkRemoteTo} onChange={(e) => setBulkRemoteTo(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setShowBulkEnableConfirm(true)} disabled={bulkRemoteSubmitting}>
            Enable Remote Access
          </Button>
          <Button variant="outline" onClick={() => setShowBulkDisableConfirm(true)} disabled={bulkRemoteSubmitting}>
            Disable Remote Access
          </Button>
        </div>
      </Card>
    </div>
  );
}

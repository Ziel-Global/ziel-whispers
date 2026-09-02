import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save } from "lucide-react";

export interface EmployeeAccessControlsTabProps {
  employeeRemoteAccess: boolean;
  setEmployeeRemoteAccess: (v: boolean) => void;
  employeeRemoteAccessFrom: string;
  setEmployeeRemoteAccessFrom: (v: string) => void;
  employeeRemoteAccessTo: string;
  setEmployeeRemoteAccessTo: (v: string) => void;
  employeeIsOnLeave: boolean;
  setEmployeeIsOnLeave: (v: boolean) => void;
  employeeIsOnLeaveFrom: string;
  setEmployeeIsOnLeaveFrom: (v: string) => void;
  employeeIsOnLeaveTo: string;
  setEmployeeIsOnLeaveTo: (v: string) => void;
  savingAccessControls: boolean;
  handleSaveAccessControls: () => Promise<void>;
}

export function EmployeeAccessControlsTab({
  employeeRemoteAccess,
  setEmployeeRemoteAccess,
  employeeRemoteAccessFrom,
  setEmployeeRemoteAccessFrom,
  employeeRemoteAccessTo,
  setEmployeeRemoteAccessTo,
  employeeIsOnLeave,
  setEmployeeIsOnLeave,
  employeeIsOnLeaveFrom,
  setEmployeeIsOnLeaveFrom,
  employeeIsOnLeaveTo,
  setEmployeeIsOnLeaveTo,
  savingAccessControls,
  handleSaveAccessControls,
}: EmployeeAccessControlsTabProps) {
  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Access Controls</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Manage per-employee access settings. Changes take effect immediately.
        </p>
      </div>
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Remote Access</Label>
              <p className="text-xs text-muted-foreground">
                Allows the employee to clock in as remote within the specified date range.
              </p>
            </div>
            <Switch
              checked={employeeRemoteAccess}
              onCheckedChange={setEmployeeRemoteAccess}
            />
          </div>
          {employeeRemoteAccess && (
            <div className="grid grid-cols-2 gap-3 pl-2">
              <div className="space-y-1">
                <Label className="text-xs">From Date</Label>
                <Input
                  type="date"
                  value={employeeRemoteAccessFrom}
                  onChange={(e) => setEmployeeRemoteAccessFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To Date</Label>
                <Input
                  type="date"
                  value={employeeRemoteAccessTo}
                  onChange={(e) => setEmployeeRemoteAccessTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Mark as On Leave</Label>
              <p className="text-xs text-muted-foreground">
                Marks the employee as on leave within the specified date range.
              </p>
            </div>
            <Switch
              checked={employeeIsOnLeave}
              onCheckedChange={setEmployeeIsOnLeave}
            />
          </div>
          {employeeIsOnLeave && (
            <div className="grid grid-cols-2 gap-3 pl-2">
              <div className="space-y-1">
                <Label className="text-xs">From Date</Label>
                <Input
                  type="date"
                  value={employeeIsOnLeaveFrom}
                  onChange={(e) => setEmployeeIsOnLeaveFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To Date</Label>
                <Input
                  type="date"
                  value={employeeIsOnLeaveTo}
                  onChange={(e) => setEmployeeIsOnLeaveTo(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={handleSaveAccessControls} disabled={savingAccessControls}>
          <Save className="h-4 w-4 mr-2" />
          {savingAccessControls ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

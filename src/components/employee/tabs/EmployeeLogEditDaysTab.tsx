import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

export interface EmployeeLogEditDaysTabProps {
  logEditDays: string;
  setLogEditDays: (v: string) => void;
  savingLogEditDays: boolean;
  handleSaveLogEditDays: () => Promise<void>;
}

export function EmployeeLogEditDaysTab({
  logEditDays,
  setLogEditDays,
  savingLogEditDays,
  handleSaveLogEditDays,
}: EmployeeLogEditDaysTabProps) {
  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Log Edit Days</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Set how many past days this employee can edit or add logs for. The current day is not counted.
          Leave blank to allow 1 past day by default. Set to 0 to restrict to today only.
        </p>
      </div>
      <div className="space-y-2 max-w-xs">
        <Label>Number of Past Days</Label>
        <Input
          type="number"
          min="0"
          max="30"
          placeholder="e.g. 3"
          value={logEditDays}
          onChange={(e) => setLogEditDays(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {logEditDays === ""
            ? "Not set — employee can log for today and 1 past day (default)."
            : `Employee can edit logs for today and ${logEditDays} past day${Number(logEditDays) === 1 ? "" : "s"}.`}
        </p>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSaveLogEditDays} disabled={savingLogEditDays}>
          <Save className="h-4 w-4 mr-2" />
          {savingLogEditDays ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

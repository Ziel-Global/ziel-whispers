import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export interface EmployeeChangePasswordCardProps {
  adminNewPassword: string;
  setAdminNewPassword: (v: string) => void;
  adminConfirmPassword: string;
  setAdminConfirmPassword: (v: string) => void;
  adminPwError: string;
  settingPassword: boolean;
  handleUpdatePassword: () => Promise<void>;
}

export function EmployeeChangePasswordCard({
  adminNewPassword,
  setAdminNewPassword,
  adminConfirmPassword,
  setAdminConfirmPassword,
  adminPwError,
  settingPassword,
  handleUpdatePassword,
}: EmployeeChangePasswordCardProps) {
  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-semibold">Change Password</h3>
        <p className="text-sm text-muted-foreground mt-1">Set a new password for this employee. They will use it on their next login.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>New Password <span className="text-destructive">*</span></Label>
          <PasswordInput value={adminNewPassword} onChange={(e) => setAdminNewPassword(e.target.value)} showStrength />
        </div>
        <div className="space-y-2">
          <Label>Confirm New Password <span className="text-destructive">*</span></Label>
          <PasswordInput value={adminConfirmPassword} onChange={(e) => setAdminConfirmPassword(e.target.value)} />
        </div>
      </div>
      {adminPwError && <p className="text-sm text-destructive">{adminPwError}</p>}
      <div className="flex justify-end">
        <Button
          variant="outline"
          disabled={settingPassword}
          onClick={handleUpdatePassword}
        >
          {settingPassword ? "Updating…" : "Update Password"}
        </Button>
      </div>
    </Card>
  );
}

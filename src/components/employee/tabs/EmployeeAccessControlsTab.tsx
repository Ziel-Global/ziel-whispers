/**
 * Admin user-detail — Access Controls tab (ud-* layout from zielAdmin mock).
 *
 * IMPLEMENTED (wired — existing save path):
 *   - Remote Access toggle + From/To dates
 *   - Mark as On Leave toggle + From/To dates
 *   - Save Changes → handleSaveAccessControls
 *   - Security & Password → handleUpdatePassword (admin editing others only)
 *
 * READ-ONLY (display only; edit elsewhere):
 *   - Overtime Logging badge ← Profile → Work Schedule (overtime_enabled)
 *   - Historical Log Editing badge ← Log Edit Days tab (log_edit_days)
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

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
  /** Read-only summary / badges */
  employee?: {
    status?: string | null;
    role?: string | null;
    overtime_enabled?: boolean | null;
  } | null;
  logEditDays?: string;
  /** Password reset — only when showPasswordCard */
  showPasswordCard?: boolean;
  adminNewPassword?: string;
  setAdminNewPassword?: (v: string) => void;
  adminConfirmPassword?: string;
  setAdminConfirmPassword?: (v: string) => void;
  adminPwError?: string;
  settingPassword?: boolean;
  handleUpdatePassword?: () => Promise<void>;
}

function UdToggle({
  on,
  onClick,
  "aria-label": ariaLabel,
}: {
  on: boolean;
  onClick: () => void;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "relative w-[38px] h-[22px] rounded-[20px] shrink-0 transition-colors",
        on ? "bg-[#EB5A1E]" : "bg-[#E5E5E8]"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.16)] transition-[left] duration-150",
          on ? "left-[19px]" : "left-[3px]"
        )}
      />
    </button>
  );
}

function roleLabel(r?: string | null) {
  if (!r) return "—";
  if (r === "admin") return "Administrator";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function statusLabel(s?: string | null) {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  employee,
  logEditDays = "",
  showPasswordCard = false,
  adminNewPassword = "",
  setAdminNewPassword,
  adminConfirmPassword = "",
  setAdminConfirmPassword,
  adminPwError = "",
  settingPassword = false,
  handleUpdatePassword,
}: EmployeeAccessControlsTabProps) {
  const otAllowed = !!employee?.overtime_enabled;
  const effectiveEditDays = logEditDays === "" ? 1 : Number(logEditDays) || 0;

  return (
    <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start w-full min-w-0">
      <div className="flex flex-col gap-4 min-w-0">
        <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
          <div className="flex items-start justify-between gap-3.5 mb-[17px] flex-wrap">
            <div className="min-w-0">
              <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Access Controls</div>
              <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
                Employee-specific attendance, leave and account permissions.
              </div>
            </div>
            <Button
              type="button"
              onClick={handleSaveAccessControls}
              disabled={savingAccessControls}
              className="h-[38px] rounded-[9px] px-3.5 bg-[#EB5A1E] hover:bg-[#C64715] text-white text-[12px] font-semibold shrink-0"
            >
              {savingAccessControls ? "Saving…" : "Save Changes"}
            </Button>
          </div>

          <div className="border border-black/[0.08] rounded-xl overflow-hidden">
            {/* Remote Access — wired */}
            <div className="px-[15px] py-3.5 border-b border-black/[0.055] bg-white">
              <div className="flex items-center justify-between gap-3.5">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[#252529]">Remote Access</div>
                  <div className="text-[10.5px] text-[#8B8B92] mt-0.5 leading-snug">
                    Allow remote clock-in and clock-out for approved periods.
                  </div>
                </div>
                <UdToggle
                  on={employeeRemoteAccess}
                  aria-label="Remote access"
                  onClick={() => setEmployeeRemoteAccess(!employeeRemoteAccess)}
                />
              </div>
              {employeeRemoteAccess && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">From</div>
                    <Input
                      type="date"
                      value={employeeRemoteAccessFrom}
                      onChange={(e) => setEmployeeRemoteAccessFrom(e.target.value)}
                      className="h-9 text-[12px] rounded-[9px] border-black/10 bg-[#FBFBFA]"
                    />
                  </div>
                  <div>
                    <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">To</div>
                    <Input
                      type="date"
                      value={employeeRemoteAccessTo}
                      onChange={(e) => setEmployeeRemoteAccessTo(e.target.value)}
                      className="h-9 text-[12px] rounded-[9px] border-black/10 bg-[#FBFBFA]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* On Leave — wired */}
            <div className="px-[15px] py-3.5 border-b border-black/[0.055] bg-white">
              <div className="flex items-center justify-between gap-3.5">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[#252529]">Mark as On Leave</div>
                  <div className="text-[10.5px] text-[#8B8B92] mt-0.5 leading-snug">
                    Exclude this employee from attendance and log expectations for the configured period.
                  </div>
                </div>
                <UdToggle
                  on={employeeIsOnLeave}
                  aria-label="On leave"
                  onClick={() => setEmployeeIsOnLeave(!employeeIsOnLeave)}
                />
              </div>
              {employeeIsOnLeave && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">From</div>
                    <Input
                      type="date"
                      value={employeeIsOnLeaveFrom}
                      onChange={(e) => setEmployeeIsOnLeaveFrom(e.target.value)}
                      className="h-9 text-[12px] rounded-[9px] border-black/10 bg-[#FBFBFA]"
                    />
                  </div>
                  <div>
                    <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">To</div>
                    <Input
                      type="date"
                      value={employeeIsOnLeaveTo}
                      onChange={(e) => setEmployeeIsOnLeaveTo(e.target.value)}
                      className="h-9 text-[12px] rounded-[9px] border-black/10 bg-[#FBFBFA]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Overtime — read-only */}
            <div className="px-[15px] py-3.5 border-b border-black/[0.055] bg-white flex items-center justify-between gap-3.5">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-[#252529]">Overtime Logging</div>
                <div className="text-[10.5px] text-[#8B8B92] mt-0.5 leading-snug">
                  Permit weekend logs and hours above the normal working-day threshold. Edit on Profile → Work Schedule.
                </div>
              </div>
              <span
                className={cn(
                  "inline-flex items-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold whitespace-nowrap shrink-0",
                  otAllowed ? "bg-[#DFF6E4] text-[#1B8A46]" : "bg-[#F1F1F3] text-[#66666D]"
                )}
              >
                {otAllowed ? "Allowed" : "Disabled"}
              </span>
            </div>

            {/* Historical log editing — read-only */}
            <div className="px-[15px] py-3.5 bg-white flex items-center justify-between gap-3.5">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-[#252529]">Historical Log Editing</div>
                <div className="text-[10.5px] text-[#8B8B92] mt-0.5 leading-snug">
                  Edit today plus {effectiveEditDays} past day{effectiveEditDays === 1 ? "" : "s"}, with full audit
                  history. Configure on Log Edit Days.
                </div>
              </div>
              <span className="inline-flex items-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold bg-[#F1F1F3] text-[#66666D] whitespace-nowrap shrink-0">
                Configured
              </span>
            </div>
          </div>
        </section>

        {showPasswordCard && setAdminNewPassword && setAdminConfirmPassword && handleUpdatePassword && (
          <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
            <div className="mb-[17px]">
              <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Security & Password</div>
              <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
                Reset credentials without exposing the current password.
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">New Password</div>
                <PasswordInput
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  showStrength
                  className="h-9 rounded-[9px] border-black/10 bg-[#FBFBFA] text-[12.5px]"
                />
              </div>
              <div>
                <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">
                  Confirm Password
                </div>
                <PasswordInput
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="h-9 rounded-[9px] border-black/10 bg-[#FBFBFA] text-[12.5px]"
                />
              </div>
            </div>
            {adminPwError ? (
              <p className="text-[11px] text-[#C23A3A] mt-2.5">{adminPwError}</p>
            ) : null}
            <div className="flex justify-end mt-3.5">
              <Button
                type="button"
                onClick={handleUpdatePassword}
                disabled={settingPassword}
                className="h-[38px] rounded-[9px] px-3.5 bg-[#17171A] hover:bg-[#2C2C31] text-white text-[12px] font-semibold"
              >
                {settingPassword ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </section>
        )}
      </div>

      <div className="flex flex-col gap-4 min-w-0">
        <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px]">
          <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Access Summary</div>
          <div className="mt-3.5 flex flex-col">
            <div className="flex items-center justify-between gap-3 py-2.5 border-b border-black/[0.055]">
              <span className="text-[11px] text-[#8B8B92]">Account status</span>
              <span className="text-[11.5px] font-semibold text-[#4B4B52]">{statusLabel(employee?.status)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5 border-b border-black/[0.055]">
              <span className="text-[11px] text-[#8B8B92]">App role</span>
              <span className="text-[11.5px] font-semibold text-[#4B4B52]">{roleLabel(employee?.role)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5 border-b border-black/[0.055]">
              <span className="text-[11px] text-[#8B8B92]">Remote</span>
              <span className="text-[11.5px] font-semibold text-[#4B4B52]">
                {employeeRemoteAccess ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[11px] text-[#8B8B92]">Leave override</span>
              <span className="text-[11.5px] font-semibold text-[#4B4B52]">
                {employeeIsOnLeave ? "On leave" : "Working"}
              </span>
            </div>
          </div>
        </section>

        <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px]">
          <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Governance</div>
          <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
            High-impact changes should remain permission-controlled and auditable.
          </div>
          <div className="mt-[13px] rounded-[11px] border border-[#F2C9B7] bg-[#FFF9F6] px-3.5 py-3 text-[11px] text-[#9C7768] leading-snug">
            Deactivation preserves existing project assignments, attendance records, work logs and audit history. It
            only blocks future access.
          </div>
        </section>
      </div>
    </div>
  );
}

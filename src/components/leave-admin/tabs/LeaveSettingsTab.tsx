import React from "react";
import { Save } from "lucide-react";
import { LEAVE_CATEGORIES } from "@/hooks/useLeaveAdminData";
import { CompanyHolidaysCard } from "@/components/leave-admin/CompanyHolidaysCard";

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
    <div className="space-y-5 font-sans">
      {/* Leave Configuration Card */}
      <div className="bg-white border border-black/[0.08] rounded-[14px] p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-[#17171A]">Leave Configuration</h3>
          <button
            type="button"
            onClick={handleSaveEntitlement}
            disabled={savingEntitlement}
            className="flex items-center gap-2 bg-[#EB5A1E] hover:bg-[#C64715] text-white font-semibold rounded-[10px] px-4 py-2 text-[13px] transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5 text-white" />
            {savingEntitlement ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="max-w-[340px] space-y-1.5">
          <label className="block text-[12.5px] font-semibold text-[#4B4B52]">Annual Leave Entitlement (days)</label>
          <input
            type="number"
            value={annualEntitlement}
            onChange={(e) => setAnnualEntitlement(e.target.value)}
            min="0"
            max="365"
            className="w-full bg-white border border-black/10 rounded-[10px] px-3.5 py-2.5 text-[13.5px] text-[#17171A] focus:outline-none font-sans shadow-sm"
          />
          <p className="text-[12px] text-[#8B8B92] leading-relaxed pt-0.5">
            Total annual leave days each employee is entitled to per year. All leave types draw from this single pool.
          </p>
        </div>
      </div>

      {/* Bulk Remote Work Management */}
      <div className="bg-white border border-black/[0.08] rounded-[14px] p-6 shadow-sm space-y-5">
        <div>
          <h3 className="text-[15px] font-bold text-[#17171A]">Company-Wide Remote Work</h3>
          <p className="text-[12px] text-[#8B8B92] mt-0.5">
            Allow all employees to clock in remotely for a date range (e.g. extreme weather, office maintenance).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1.5">
            <label className="block text-[12.5px] font-semibold text-[#4B4B52]">From Date</label>
            <input
              type="date"
              value={bulkRemoteFrom}
              onChange={(e) => setBulkRemoteFrom(e.target.value)}
              className="bg-white border border-black/10 rounded-[10px] px-3 py-2 text-[13px] text-[#4B4B52] focus:outline-none font-sans shadow-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[12.5px] font-semibold text-[#4B4B52]">To Date</label>
            <input
              type="date"
              value={bulkRemoteTo}
              onChange={(e) => setBulkRemoteTo(e.target.value)}
              className="bg-white border border-black/10 rounded-[10px] px-3 py-2 text-[13px] text-[#4B4B52] focus:outline-none font-sans shadow-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => setShowBulkEnableConfirm(true)}
            disabled={bulkRemoteSubmitting}
            className="bg-white border border-black/10 hover:bg-[#F6F5F3] text-[#4B4B52] font-semibold rounded-[10px] px-4.5 py-2.5 text-[13px] transition-colors shadow-sm disabled:opacity-50"
          >
            Enable Remote Access
          </button>
          <button
            type="button"
            onClick={() => setShowBulkDisableConfirm(true)}
            disabled={bulkRemoteSubmitting}
            className="bg-white border border-black/10 hover:bg-[#F6F5F3] text-[#4B4B52] font-semibold rounded-[10px] px-4.5 py-2.5 text-[13px] transition-colors shadow-sm disabled:opacity-50"
          >
            Disable Remote Access
          </button>
        </div>
      </div>

      {/* Official Company Holidays (Blueprint Module 1 & 4) */}
      <CompanyHolidaysCard />
    </div>
  );
}

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeaveAdminData } from "@/hooks/useLeaveAdminData";
import { LeaveRequestsTab } from "@/components/leave-admin/tabs/LeaveRequestsTab";
import { WFHRequestsTab } from "@/components/leave-admin/tabs/WFHRequestsTab";
import { LeaveCalendarTab } from "@/components/leave-admin/tabs/LeaveCalendarTab";
import { LeaveSettingsTab } from "@/components/leave-admin/tabs/LeaveSettingsTab";
import { LeaveAdminModals } from "@/components/leave-admin/dialogs/LeaveAdminModals";
import { Plus } from "lucide-react";

export default function LeaveAdminPage() {
  const data = useLeaveAdminData();

  const pendingLeaveCount = data.requests.filter((r: any) => r.status === "pending").length;
  const pendingWfhCount = data.wfhRequests.filter((r: any) => r.status === "pending").length;

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between pb-1 flex-wrap gap-3">
        <h1 className="text-[26px] font-bold tracking-[-0.5px] text-[#17171A]">Leave Management</h1>
        <button
          type="button"
          onClick={() => {
            // Trigger balance / leave modal
            data.setShowBalanceDialog(true);
          }}
          className="flex items-center gap-2 bg-[#EB5A1E] hover:bg-[#C64715] text-white font-semibold rounded-[10px] px-4 py-2 text-[13px] transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5 text-white" />
          Apply Leave
        </button>
      </div>

      <Tabs defaultValue="requests">
        <TabsList className="bg-white border border-black/[0.08] rounded-[11px] p-[5px] h-auto flex items-center gap-1 w-fit">
          <TabsTrigger
            value="requests"
            className="rounded-[8px] px-4 py-2 text-[13px] font-semibold text-[#8B8B92] data-[state=active]:bg-[#17171A] data-[state=active]:text-white transition-all shadow-none flex items-center gap-2"
          >
            Leave Requests
            {pendingLeaveCount > 0 && (
              <span className="bg-[#E5484D] text-white text-[10px] font-bold rounded-full h-4.5 min-w-[18px] flex items-center justify-center px-1">
                {pendingLeaveCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="wfh"
            className="rounded-[8px] px-4 py-2 text-[13px] font-medium text-[#8B8B92] data-[state=active]:bg-[#17171A] data-[state=active]:text-white transition-all shadow-none flex items-center gap-2"
          >
            Remote Requests
            {pendingWfhCount > 0 && (
              <span className="bg-[#E5484D] text-white text-[10px] font-bold rounded-full h-4.5 min-w-[18px] flex items-center justify-center px-1">
                {pendingWfhCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="calendar"
            className="rounded-[8px] px-4 py-2 text-[13px] font-medium text-[#8B8B92] data-[state=active]:bg-[#17171A] data-[state=active]:text-white transition-all shadow-none"
          >
            Calendar
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="rounded-[8px] px-4 py-2 text-[13px] font-medium text-[#8B8B92] data-[state=active]:bg-[#17171A] data-[state=active]:text-white transition-all shadow-none"
          >
            Leave Settings
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Leave Requests */}
        <TabsContent value="requests" className="space-y-4">
          <LeaveRequestsTab
            statusFilter={data.statusFilter}
            setStatusFilter={data.setStatusFilter}
            selectedYear={data.selectedYear}
            setSelectedYear={data.setSelectedYear}
            leaveTypeFilter={data.leaveTypeFilter}
            setLeaveTypeFilter={data.setLeaveTypeFilter}
            submittedDate={data.submittedDate}
            setSubmittedDate={data.setSubmittedDate}
            summaryStats={data.summaryStats}
            setShowBalanceDialog={data.setShowBalanceDialog}
            filtered={data.filtered}
            selectedLeaveIds={data.selectedLeaveIds}
            setSelectedLeaveIds={data.setSelectedLeaveIds}
            setBulkDeleteLeaveOpen={data.setBulkDeleteLeaveOpen}
            setActionModal={data.setActionModal}
          />
        </TabsContent>

        {/* Tab 2: WFH / Remote Requests */}
        <TabsContent value="wfh" className="space-y-4">
          <WFHRequestsTab
            wfhStatusFilter={data.wfhStatusFilter}
            setWfhStatusFilter={data.setWfhStatusFilter}
            wfhFiltered={data.wfhFiltered}
            selectedWfhIds={data.selectedWfhIds}
            setSelectedWfhIds={data.setSelectedWfhIds}
            setBulkDeleteWfhOpen={data.setBulkDeleteWfhOpen}
            expandedId={data.expandedId}
            setExpandedId={data.setExpandedId}
            handleWfhAction={data.handleWfhAction}
            setWfhDeleteId={data.setWfhDeleteId}
          />
        </TabsContent>

        {/* Tab 3: Leave Calendar */}
        <TabsContent value="calendar" className="space-y-4">
          <LeaveCalendarTab
            calMonth={data.calMonth}
            setCalMonth={data.setCalMonth}
            subMonths={data.subMonths}
            addMonths={data.addMonths}
            calDays={data.calDays}
            getLeavesForDay={data.getLeavesForDay}
            namesModal={data.namesModal}
            setNamesModal={data.setNamesModal}
          />
        </TabsContent>

        {/* Tab 4: Leave Settings */}
        <TabsContent value="settings" className="space-y-4">
          <LeaveSettingsTab
            annualEntitlement={data.annualEntitlement}
            setAnnualEntitlement={data.setAnnualEntitlement}
            savingEntitlement={data.savingEntitlement}
            handleSaveEntitlement={data.handleSaveEntitlement}
            bulkRemoteFrom={data.bulkRemoteFrom}
            setBulkRemoteFrom={data.setBulkRemoteFrom}
            bulkRemoteTo={data.bulkRemoteTo}
            setBulkRemoteTo={data.setBulkRemoteTo}
            bulkRemoteSubmitting={data.bulkRemoteSubmitting}
            setShowBulkEnableConfirm={data.setShowBulkEnableConfirm}
            setShowBulkDisableConfirm={data.setShowBulkDisableConfirm}
          />
        </TabsContent>
      </Tabs>

      {/* Modal Dialogs */}
      <LeaveAdminModals
        showBalanceDialog={data.showBalanceDialog}
        setShowBalanceDialog={data.setShowBalanceDialog}
        employeeBalanceData={data.employeeBalanceData}
        actionModal={data.actionModal}
        setActionModal={data.setActionModal}
        adminComment={data.adminComment}
        setAdminComment={data.setAdminComment}
        handleAction={data.handleAction}
        processing={data.processing}
        deleteId={data.deleteId}
        setDeleteId={data.setDeleteId}
        handleDelete={data.handleDelete}
        deleting={data.deleting}
        wfhDeleteId={data.wfhDeleteId}
        setWfhDeleteId={data.setWfhDeleteId}
        handleWfhDelete={data.handleWfhDelete}
        wfhDeleting={data.wfhDeleting}
        bulkDeleteLeaveOpen={data.bulkDeleteLeaveOpen}
        setBulkDeleteLeaveOpen={data.setBulkDeleteLeaveOpen}
        selectedLeaveIds={data.selectedLeaveIds}
        handleBulkDeleteLeave={data.handleBulkDeleteLeave}
        bulkDeleteWfhOpen={data.bulkDeleteWfhOpen}
        setBulkDeleteWfhOpen={data.setBulkDeleteWfhOpen}
        selectedWfhIds={data.selectedWfhIds}
        handleBulkDeleteWfh={data.handleBulkDeleteWfh}
        showBulkEnableConfirm={data.showBulkEnableConfirm}
        setShowBulkEnableConfirm={data.setShowBulkEnableConfirm}
        bulkRemoteFrom={data.bulkRemoteFrom}
        bulkRemoteTo={data.bulkRemoteTo}
        handleBulkEnable={data.handleBulkEnable}
        bulkRemoteSubmitting={data.bulkRemoteSubmitting}
        showBulkDisableConfirm={data.showBulkDisableConfirm}
        setShowBulkDisableConfirm={data.setShowBulkDisableConfirm}
        handleBulkDisable={data.handleBulkDisable}
      />
    </div>
  );
}

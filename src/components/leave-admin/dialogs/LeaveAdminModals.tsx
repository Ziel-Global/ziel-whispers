import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader as ShadcnTableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";

export interface LeaveAdminModalsProps {
  showBalanceDialog: boolean;
  setShowBalanceDialog: (v: boolean) => void;
  employeeBalanceData: any[];
  actionModal: { type: "approve" | "reject"; request: any } | null;
  setActionModal: (modal: { type: "approve" | "reject"; request: any } | null) => void;
  adminComment: string;
  setAdminComment: (comment: string) => void;
  handleAction: () => Promise<void>;
  processing: boolean;
  deleteId: string | null;
  setDeleteId: (id: string | null) => void;
  handleDelete: () => Promise<void>;
  deleting: boolean;
  wfhDeleteId: string | null;
  setWfhDeleteId: (id: string | null) => void;
  handleWfhDelete: () => Promise<void>;
  wfhDeleting: boolean;
  bulkDeleteLeaveOpen: boolean;
  setBulkDeleteLeaveOpen: (open: boolean) => void;
  selectedLeaveIds: Set<string>;
  handleBulkDeleteLeave: () => Promise<void>;
  bulkDeleteWfhOpen: boolean;
  setBulkDeleteWfhOpen: (open: boolean) => void;
  selectedWfhIds: Set<string>;
  handleBulkDeleteWfh: () => Promise<void>;
  showBulkEnableConfirm: boolean;
  setShowBulkEnableConfirm: (open: boolean) => void;
  bulkRemoteFrom: string;
  bulkRemoteTo: string;
  handleBulkEnable: () => Promise<void>;
  bulkRemoteSubmitting: boolean;
  showBulkDisableConfirm: boolean;
  setShowBulkDisableConfirm: (open: boolean) => void;
  handleBulkDisable: () => Promise<void>;
}

export function LeaveAdminModals({
  showBalanceDialog,
  setShowBalanceDialog,
  employeeBalanceData,
  actionModal,
  setActionModal,
  adminComment,
  setAdminComment,
  handleAction,
  processing,
  deleteId,
  setDeleteId,
  handleDelete,
  deleting,
  wfhDeleteId,
  setWfhDeleteId,
  handleWfhDelete,
  wfhDeleting,
  bulkDeleteLeaveOpen,
  setBulkDeleteLeaveOpen,
  selectedLeaveIds,
  handleBulkDeleteLeave,
  bulkDeleteWfhOpen,
  setBulkDeleteWfhOpen,
  selectedWfhIds,
  handleBulkDeleteWfh,
  showBulkEnableConfirm,
  setShowBulkEnableConfirm,
  bulkRemoteFrom,
  bulkRemoteTo,
  handleBulkEnable,
  bulkRemoteSubmitting,
  showBulkDisableConfirm,
  setShowBulkDisableConfirm,
  handleBulkDisable,
}: LeaveAdminModalsProps) {
  return (
    <>
      {/* Employee Leave Balance Dialog */}
      <Dialog open={showBalanceDialog} onOpenChange={setShowBalanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Employee Leave Balance</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <ShadcnTableHeader>
                <TableRow>
                  <TableHead>Employee Name</TableHead>
                  <TableHead className="text-right">Remaining Leave Days</TableHead>
                </TableRow>
              </ShadcnTableHeader>
              <TableBody>
                {employeeBalanceData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  employeeBalanceData.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell className="text-right font-medium">{emp.remaining}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve / Reject Dialog */}
      <Dialog open={!!actionModal} onOpenChange={(o) => !o && setActionModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionModal?.type === "approve" ? "Approve" : "Reject"} Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{actionModal?.request?.users?.full_name}</strong> — {actionModal?.request?.leave_types?.name} (
              {actionModal?.request?.days_count} days)
            </p>
            <div className="space-y-1">
              <Label>{actionModal?.type === "reject" ? "Rejection Reason *" : "Comment (optional)"}</Label>
              <Textarea value={adminComment} onChange={(e) => setAdminComment(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              className={
                actionModal?.type === "approve"
                  ? ""
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              {processing ? "Processing…" : actionModal?.type === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Enable Confirmation */}
      <AlertDialog open={showBulkEnableConfirm} onOpenChange={setShowBulkEnableConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable Remote Access for All Users?</AlertDialogTitle>
            <AlertDialogDescription>
              This will enable remote access for all non-admin users from <strong>{bulkRemoteFrom || "—"}</strong> to{" "}
              <strong>{bulkRemoteTo || bulkRemoteFrom || "—"}</strong>. Users who already have individual remote access
              settings will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkRemoteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkEnable} disabled={bulkRemoteSubmitting}>
              {bulkRemoteSubmitting ? "Enabling…" : "Enable"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Disable Confirmation */}
      <AlertDialog open={showBulkDisableConfirm} onOpenChange={setShowBulkDisableConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Bulk Remote Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disable remote access for all non-admin users who were previously enabled via the bulk action.
              Users with individual remote access settings will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkRemoteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDisable} disabled={bulkRemoteSubmitting}>
              {bulkRemoteSubmitting ? "Disabling…" : "Disable"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Single Leave Request */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this leave request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Single WFH Request */}
      <AlertDialog open={!!wfhDeleteId} onOpenChange={(o) => !o && setWfhDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Remote Work Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this remote work request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={wfhDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWfhDelete}
              disabled={wfhDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {wfhDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Bulk Leave Requests */}
      <AlertDialog open={bulkDeleteLeaveOpen} onOpenChange={setBulkDeleteLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedLeaveIds.size} Leave Request{selectedLeaveIds.size > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {selectedLeaveIds.size} leave request
              {selectedLeaveIds.size > 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteLeave}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Bulk WFH Requests */}
      <AlertDialog open={bulkDeleteWfhOpen} onOpenChange={setBulkDeleteWfhOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedWfhIds.size} Remote Work Request{selectedWfhIds.size > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {selectedWfhIds.size} remote work request
              {selectedWfhIds.size > 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={wfhDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteWfh}
              disabled={wfhDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {wfhDeleting ? "Deleting..." : "Delete all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

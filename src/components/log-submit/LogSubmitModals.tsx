import React from "react";
import { Badge } from "@/components/ui/badge";
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
import { Send, AlertCircle } from "lucide-react";
import { getStatusDisplay, getStatusColor } from "@/lib/workflow";

export interface LogSubmitModalsProps {
  showSubmitConfirm: boolean;
  setShowSubmitConfirm: (open: boolean) => void;
  pendingLogs: any[];
  declaredMoves: any[];
  logsAreAllForToday: boolean;
  handleSubmitAll: () => Promise<void>;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  removePendingLog: (id: string) => Promise<void>;
  bulkDeleteDraftOpen: boolean;
  setBulkDeleteDraftOpen: (open: boolean) => void;
  selectedDraftIds: Set<string>;
  handleBulkDeleteDrafts: () => Promise<void>;
}

export function LogSubmitModals({
  showSubmitConfirm,
  setShowSubmitConfirm,
  pendingLogs,
  declaredMoves,
  logsAreAllForToday,
  handleSubmitAll,
  deleteConfirmId,
  setDeleteConfirmId,
  removePendingLog,
  bulkDeleteDraftOpen,
  setBulkDeleteDraftOpen,
  selectedDraftIds,
  handleBulkDeleteDrafts,
}: LogSubmitModalsProps) {
  return (
    <>
      {/* Final Submission Confirmation Dialog */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary">
              <Send className="h-5 w-5" /> Final Submission
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p className="font-semibold text-foreground">
                Are you sure you want to submit all {pendingLogs.length} logs?
              </p>
              {declaredMoves.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-md text-blue-900 text-xs flex gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {declaredMoves.length === 1
                        ? "This will also move the task to its next stage:"
                        : `This will also move ${declaredMoves.length} tasks to their next stages:`}
                    </p>
                    {declaredMoves.map((m: any) => (
                      <p key={m.taskId}>
                        <span className="font-medium">{m.title}:</span>{" "}
                        <Badge className={getStatusColor(m.statuses, m.fromStatusId)}>
                          {getStatusDisplay(m.statuses, m.fromStatusId).name}
                        </Badge>{" "}
                        →{" "}
                        <Badge className={getStatusColor(m.statuses, m.toStatusId)}>
                          {getStatusDisplay(m.statuses, m.toStatusId).name}
                        </Badge>
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {logsAreAllForToday && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-md text-amber-800 text-xs flex gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div className="space-y-1">
                    <p>
                      <strong>Warning:</strong> This action is irreversible.
                    </p>
                    <p>
                      You will be automatically clocked out from your current attendance session when these logs are submitted.
                    </p>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitAll}
              className="rounded-button bg-primary hover:bg-primary/90 text-white"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Draft Delete Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This unsubmitted log will be removed from your list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && removePendingLog(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Draft Delete Dialog */}
      <AlertDialog open={bulkDeleteDraftOpen} onOpenChange={setBulkDeleteDraftOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedDraftIds.size} Draft Log{selectedDraftIds.size > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>This unsubmitted log will be removed from your list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteDrafts}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Send, Trash2, Pencil } from "lucide-react";
import { DataRow, RowPrimary, RowSecondary, RowDataItem, RowActions, TableHeader, editButtonClass } from "@/components/ui/data-row";
import { format, parseISO } from "date-fns";
import { formatHours } from "@/lib/utils";

export interface PendingDraftLogsListProps {
  pendingLogs: any[];
  selectedDraftIds: Set<string>;
  setSelectedDraftIds: (ids: Set<string>) => void;
  setBulkDeleteDraftOpen: (open: boolean) => void;
  setShowSubmitConfirm: (open: boolean) => void;
  submitting: boolean;
  startEdit: (log: any) => void;
  setDeleteConfirmId: (id: string | null) => void;
}

export function PendingDraftLogsList({
  pendingLogs,
  selectedDraftIds,
  setSelectedDraftIds,
  setBulkDeleteDraftOpen,
  setShowSubmitConfirm,
  submitting,
  startEdit,
  setDeleteConfirmId,
}: PendingDraftLogsListProps) {
  if (pendingLogs.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1 pt-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-black" />
          <h2 className="text-lg font-semibold">Unsubmitted Logs</h2>
          <Badge variant="secondary" className="ml-1 bg-primary">
            {pendingLogs.length}
          </Badge>
        </div>
        <Button
          onClick={() => setShowSubmitConfirm(true)}
          disabled={submitting}
          className="rounded-button bg-primary hover:bg-primary/90 text-white px-6"
        >
          <Send className="h-4 w-4 mr-2" />
          {submitting ? "Submitting..." : "Submit All Logs"}
        </Button>
      </div>

      <div>
        <TableHeader gridCols="40px 1fr 112px 80px 200px 80px">
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={selectedDraftIds.size === pendingLogs.length && pendingLogs.length > 0}
              onChange={(e) => {
                if (e.target.checked) setSelectedDraftIds(new Set(pendingLogs.map((log: any) => log.id)));
                else setSelectedDraftIds(new Set());
              }}
            />
          </div>
          <span>PROJECT</span>
          <span>DATE</span>
          <span>HOURS</span>
          <span>DESCRIPTION</span>
          <span className="text-right">ACTIONS</span>
        </TableHeader>

        {selectedDraftIds.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
            <span className="text-sm text-blue-700">
              {selectedDraftIds.size} draft{selectedDraftIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDraftIds(new Set())}
                className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg bg-white"
              >
                Clear selection
              </button>
              <button
                onClick={() => setBulkDeleteDraftOpen(true)}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete selected
              </button>
            </div>
          </div>
        )}

        {pendingLogs.map((log: any) => (
          <DataRow key={log.id} gridCols="40px 1fr 112px 80px 200px 80px">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={selectedDraftIds.has(log.id)}
                onChange={(e) => {
                  const next = new Set(selectedDraftIds);
                  if (e.target.checked) next.add(log.id);
                  else next.delete(log.id);
                  setSelectedDraftIds(next);
                }}
              />
            </div>
            <div className="min-w-0">
              <RowPrimary>{log.projects?.name || "Project"}</RowPrimary>
              <RowSecondary>
                {log.category.replace(/_/g, " ")} · {log.tasks?.title || "No task"}
                {log.declared_outcome_status_id && (
                  <span className="text-blue-600 font-medium"> · will move to next stage</span>
                )}
              </RowSecondary>
            </div>
            <RowDataItem label="DATE">{format(parseISO(log.log_date), "MMM d, yyyy")}</RowDataItem>
            <RowDataItem label="HOURS">{formatHours(log.hours)}</RowDataItem>
            <RowDataItem label="DESCRIPTION" className="truncate">
              {log.description}
            </RowDataItem>
            <RowActions className="justify-self-end">
              <button onClick={() => startEdit(log)} className={editButtonClass} title="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeleteConfirmId(log.id)}
                className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-destructive"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </RowActions>
          </DataRow>
        ))}
      </div>
    </div>
  );
}

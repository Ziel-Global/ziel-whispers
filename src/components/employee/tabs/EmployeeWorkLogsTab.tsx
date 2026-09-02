import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DataRow, RowPrimary, RowSecondary, RowDataItem, RowActions, TableHeader } from "@/components/ui/data-row";
import { Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { formatHours, MISC_PROJECT_ID, getProjectName } from "@/lib/utils";

export interface EmployeeWorkLogsTabProps {
  totalLoggedHours: number;
  logDateFilter: string;
  setLogDateFilter: (v: string) => void;
  logProjectFilter: string;
  setLogProjectFilter: (v: string) => void;
  employeeProjects: any[];
  exportWorkLogs: () => void;
  workLogs: any[];
  selectedLogIds: Set<string>;
  setSelectedLogIds: (ids: Set<string>) => void;
  setBulkDeleteLogOpen: (open: boolean) => void;
  setDeleteLogId: (id: string | null) => void;
  deleteLogId: string | null;
  handleDeleteLog: (id: string) => Promise<void>;
  bulkDeleteLogOpen: boolean;
  handleBulkDeleteLogs: () => Promise<void>;
}

export function EmployeeWorkLogsTab({
  totalLoggedHours,
  logDateFilter,
  setLogDateFilter,
  logProjectFilter,
  setLogProjectFilter,
  employeeProjects,
  exportWorkLogs,
  workLogs,
  selectedLogIds,
  setSelectedLogIds,
  setBulkDeleteLogOpen,
  setDeleteLogId,
  deleteLogId,
  handleDeleteLog,
  bulkDeleteLogOpen,
  handleBulkDeleteLogs,
}: EmployeeWorkLogsTabProps) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="p-4">
        <p className="text-sm font-medium">Total Logged Hours (filtered): <strong>{formatHours(totalLoggedHours)}</strong></p>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          type="date"
          value={logDateFilter}
          onChange={(e) => setLogDateFilter(e.target.value)}
          className="w-[170px]"
          placeholder="Filter by date"
        />
        {logDateFilter && (
          <Button variant="ghost" size="sm" onClick={() => setLogDateFilter("")}>Clear date</Button>
        )}
        <Select value={logProjectFilter} onValueChange={setLogProjectFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {employeeProjects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            <SelectItem value={MISC_PROJECT_ID}>Miscellaneous</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportWorkLogs}>
          <Download className="h-4 w-4 mr-1" />CSV
        </Button>
      </div>

      {/* Table */}
      {workLogs.length === 0 ? (
        <Card><div className="py-12 text-center text-muted-foreground">No logs found</div></Card>
      ) : (
        <div>
          <TableHeader gridCols="40px 1fr 112px 80px 112px 80px">
            <div className="flex items-center justify-center">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                checked={selectedLogIds.size === workLogs.length && workLogs.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedLogIds(new Set(workLogs.map((log: any) => log.id)));
                  else setSelectedLogIds(new Set());
                }} />
            </div>
            <span>PROJECT</span>
            <span>DATE</span>
            <span>HOURS</span>
            <span>SUBMITTED AT</span>
            <span className="text-right">ACTIONS</span>
          </TableHeader>
          {selectedLogIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
              <span className="text-sm text-blue-700">{selectedLogIds.size} log{selectedLogIds.size > 1 ? "s" : ""} selected</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedLogIds(new Set())} className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg bg-white">Clear selection</button>
                <button onClick={() => setBulkDeleteLogOpen(true)} className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> Delete selected
                </button>
              </div>
            </div>
          )}
          {workLogs.map((log: any) => (
            <DataRow key={log.id} gridCols="40px 1fr 112px 80px 112px 80px">
              <div className="flex items-center justify-center">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                  checked={selectedLogIds.has(log.id)}
                  onChange={(e) => {
                    const next = new Set(selectedLogIds);
                    if (e.target.checked) next.add(log.id); else next.delete(log.id);
                    setSelectedLogIds(next);
                  }} />
              </div>
              <div>
                <RowPrimary>{getProjectName(log)}</RowPrimary>
                <RowSecondary>{log.description}</RowSecondary>
              </div>
              <RowDataItem label="DATE">{format(new Date(log.log_date + "T00:00:00"), "MMM d, yyyy")}</RowDataItem>
              <RowDataItem label="HOURS"><span className="font-medium">{formatHours(log.hours)}</span></RowDataItem>
              <RowDataItem label="SUBMITTED AT">{format(new Date(log.submitted_at), "h:mm a")}</RowDataItem>
              <RowActions className="justify-self-end">
                <button onClick={() => setDeleteLogId(log.id)} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-destructive" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </RowActions>
            </DataRow>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLogId} onOpenChange={(open) => !open && setDeleteLogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this log?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent and cannot be undone. This log entry will be removed from the employee's record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLogId && handleDeleteLog(deleteLogId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={bulkDeleteLogOpen} onOpenChange={setBulkDeleteLogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedLogIds.size} Log{selectedLogIds.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This action is permanent and cannot be undone. These log entries will be removed from the employee's record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteLogs} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

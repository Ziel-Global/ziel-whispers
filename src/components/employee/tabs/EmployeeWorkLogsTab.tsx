/**
 * Admin user-detail — Work Logs tab (ud-* layout from zielAdmin mock).
 *
 * IMPLEMENTED (wired):
 *   - 4 KPIs from filtered logs (hours, avg, distinct projects, late count)
 *   - Card + toolbar: day date picker, project, activity type; Export CSV
 *   - Table: project/work, date, hours, activity badge, submitted, Late/Submitted
 *   - Task title subtitle when present; else description
 *
 * BEYOND MOCK (kept extras):
 *   - Row checkboxes, selection bar, single + bulk delete (+ audit in hook)
 *
 * DEFERRED FROM MOCK:
 *   - Month period control (“Aug 2026”) — product chose exact-day filter instead
 */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { formatHours, MISC_PROJECT_ID, getProjectName } from "@/lib/utils";
import { CATEGORIES } from "@/utils/logDateUtils";
import { cn } from "@/lib/utils";

export interface EmployeeWorkLogsTabProps {
  totalLoggedHours: number;
  logDateFilter: string;
  setLogDateFilter: (v: string) => void;
  logProjectFilter: string;
  setLogProjectFilter: (v: string) => void;
  logActivityFilter: string;
  setLogActivityFilter: (v: string) => void;
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

function categoryLabel(cat?: string | null) {
  if (!cat) return "—";
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function workSubtitle(log: any) {
  const taskTitle = log.tasks?.title?.trim();
  if (taskTitle) return taskTitle;
  return log.description?.trim() || "";
}

export function EmployeeWorkLogsTab({
  totalLoggedHours,
  logDateFilter,
  setLogDateFilter,
  logProjectFilter,
  setLogProjectFilter,
  logActivityFilter,
  setLogActivityFilter,
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
  const stats = useMemo(() => {
    const count = workLogs.length;
    const hours = totalLoggedHours;
    const avg = count > 0 ? hours / count : 0;
    const projectKeys = new Set(
      workLogs.map((l: any) => l.project_id || MISC_PROJECT_ID)
    );
    const lateCount = workLogs.filter((l: any) => l.is_late).length;
    return {
      hours,
      count,
      avg,
      projectCount: projectKeys.size,
      lateCount,
    };
  }, [workLogs, totalLoggedHours]);

  const allSelected = selectedLogIds.size === workLogs.length && workLogs.length > 0;

  return (
    <div className="flex flex-col gap-4 w-full min-w-0">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
          <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Filtered Hours</div>
          <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
            {formatHours(stats.hours)}
          </div>
          <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">
            {stats.count} work-log entr{stats.count === 1 ? "y" : "ies"}
          </div>
        </div>
        <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
          <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Avg. per Log</div>
          <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
            {stats.count > 0 ? formatHours(stats.avg) : "—"}
          </div>
          <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">Across filtered entries</div>
        </div>
        <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
          <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Projects</div>
          <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
            {stats.projectCount}
          </div>
          <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">With submitted work</div>
        </div>
        <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
          <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Late Logs</div>
          <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
            {stats.lateCount}
          </div>
          <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">
            {stats.lateCount > 0 ? "Requires review" : "None late in filter"}
          </div>
        </div>
      </div>

      <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
        <div className="flex items-start justify-between gap-3.5 mb-3.5 flex-wrap">
          <div className="min-w-0">
            <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">Work Logs</div>
            <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
              Submitted time entries for this employee.
            </div>
          </div>
          <Button
            type="button"
            onClick={exportWorkLogs}
            className="h-[38px] rounded-[9px] px-3.5 bg-[#17171A] hover:bg-[#2C2C31] text-white text-[12px] font-semibold gap-1.5 shrink-0"
          >
            <Download className="h-[13px] w-[13px]" />
            Export CSV
          </Button>
        </div>

        {/* Toolbar — day picker kept (mock showed month; deferred) */}
        <div className="flex flex-wrap items-center gap-2.5 mb-3.5">
          <Input
            type="date"
            value={logDateFilter}
            onChange={(e) => setLogDateFilter(e.target.value)}
            className="h-9 w-[160px] text-[12px] rounded-[9px] border-black/10 bg-[#FBFBFA]"
          />
          {logDateFilter && (
            <button
              type="button"
              onClick={() => setLogDateFilter("")}
              className="h-9 px-3 text-[11px] text-[#66666D] border border-black/[0.08] rounded-[9px] bg-white hover:bg-[#F8F7F6]"
            >
              Clear date
            </button>
          )}
          <Select value={logProjectFilter} onValueChange={setLogProjectFilter}>
            <SelectTrigger className="h-9 w-[180px] text-[12px] rounded-[9px] border-black/10 bg-[#FBFBFA]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {employeeProjects.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
              <SelectItem value={MISC_PROJECT_ID}>Miscellaneous</SelectItem>
            </SelectContent>
          </Select>
          <Select value={logActivityFilter} onValueChange={setLogActivityFilter}>
            <SelectTrigger className="h-9 w-[180px] text-[12px] rounded-[9px] border-black/10 bg-[#FBFBFA]">
              <SelectValue placeholder="All Activity Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activity Types</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* BEYOND MOCK: selection bar */}
        {selectedLogIds.size > 0 && (
          <div className="flex items-center justify-between px-3.5 py-2 mb-3 bg-[#EAF3FF] border border-[#C5DBF5] rounded-[11px]">
            <span className="text-[12px] text-[#1C6FC9] font-medium">
              {selectedLogIds.size} log{selectedLogIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedLogIds(new Set())}
                className="h-8 px-3 text-[11px] text-[#55555C] border border-black/[0.08] rounded-lg bg-white hover:bg-[#F6F5F3]"
              >
                Clear selection
              </button>
              <button
                type="button"
                onClick={() => setBulkDeleteLogOpen(true)}
                className="h-8 px-3 text-[11px] bg-[#C23A3A] text-white rounded-lg hover:bg-[#A83030] flex items-center gap-1 font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete selected
              </button>
            </div>
          </div>
        )}

        {workLogs.length === 0 ? (
          <div className="py-10 px-4 text-center border border-dashed border-[#D8D8DD] rounded-xl bg-[#FCFCFD]">
            <div className="text-[11px] font-bold text-[#66666D]">No logs found</div>
            <div className="text-[10px] text-[#9A9AA0] mt-1">Try adjusting the date, project, or activity filters.</div>
          </div>
        ) : (
          <div className="border border-black/[0.08] rounded-xl overflow-hidden bg-white">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full border-collapse min-w-[860px]">
                <thead>
                  <tr>
                    {/* BEYOND MOCK: select-all */}
                    <th className="bg-[#F8F7F6] px-3 py-2.5 text-left text-[9.5px] font-bold text-[#A0A0A7] tracking-wider border-b border-black/[0.07] w-10">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-gray-300"
                        checked={allSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedLogIds(new Set(workLogs.map((log: any) => log.id)));
                          else setSelectedLogIds(new Set());
                        }}
                      />
                    </th>
                    <th className="bg-[#F8F7F6] px-3 py-2.5 text-left text-[9.5px] font-bold text-[#A0A0A7] tracking-wider border-b border-black/[0.07]">
                      PROJECT / WORK
                    </th>
                    <th className="bg-[#F8F7F6] px-3 py-2.5 text-left text-[9.5px] font-bold text-[#A0A0A7] tracking-wider border-b border-black/[0.07]">
                      DATE
                    </th>
                    <th className="bg-[#F8F7F6] px-3 py-2.5 text-left text-[9.5px] font-bold text-[#A0A0A7] tracking-wider border-b border-black/[0.07]">
                      HOURS
                    </th>
                    <th className="bg-[#F8F7F6] px-3 py-2.5 text-left text-[9.5px] font-bold text-[#A0A0A7] tracking-wider border-b border-black/[0.07]">
                      ACTIVITY
                    </th>
                    <th className="bg-[#F8F7F6] px-3 py-2.5 text-left text-[9.5px] font-bold text-[#A0A0A7] tracking-wider border-b border-black/[0.07]">
                      SUBMITTED
                    </th>
                    <th className="bg-[#F8F7F6] px-3 py-2.5 text-left text-[9.5px] font-bold text-[#A0A0A7] tracking-wider border-b border-black/[0.07]">
                      STATUS
                    </th>
                    {/* BEYOND MOCK: actions */}
                    <th className="bg-[#F8F7F6] px-3 py-2.5 text-right text-[9.5px] font-bold text-[#A0A0A7] tracking-wider border-b border-black/[0.07]">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workLogs.map((log: any) => {
                    const subtitle = workSubtitle(log);
                    const late = !!log.is_late;
                    return (
                      <tr key={log.id} className="hover:bg-[#FCFBFA]">
                        <td className="px-3 py-3 border-b border-black/[0.055] align-middle">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-gray-300"
                            checked={selectedLogIds.has(log.id)}
                            onChange={(e) => {
                              const next = new Set(selectedLogIds);
                              if (e.target.checked) next.add(log.id);
                              else next.delete(log.id);
                              setSelectedLogIds(next);
                            }}
                          />
                        </td>
                        <td className="px-3 py-3 border-b border-black/[0.055] align-middle min-w-0">
                          <div className="text-[12px] font-bold text-[#303035] truncate">
                            {getProjectName(log)}
                          </div>
                          {subtitle ? (
                            <div className="text-[10.5px] text-[#8B8B92] mt-0.5 line-clamp-1">{subtitle}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 border-b border-black/[0.055] align-middle text-[11.5px] text-[#4B4B52] whitespace-nowrap">
                          {format(new Date(log.log_date + "T00:00:00"), "MMM d, yyyy")}
                        </td>
                        <td className="px-3 py-3 border-b border-black/[0.055] align-middle text-[11.5px] font-semibold text-[#4B4B52] whitespace-nowrap">
                          {formatHours(log.hours)}
                        </td>
                        <td className="px-3 py-3 border-b border-black/[0.055] align-middle">
                          <span className="inline-flex items-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold bg-[#F1F1F3] text-[#66666D] whitespace-nowrap">
                            {categoryLabel(log.category)}
                          </span>
                        </td>
                        <td className="px-3 py-3 border-b border-black/[0.055] align-middle text-[11.5px] text-[#4B4B52] whitespace-nowrap">
                          {log.submitted_at ? format(new Date(log.submitted_at), "h:mm a") : "—"}
                        </td>
                        <td className="px-3 py-3 border-b border-black/[0.055] align-middle">
                          <span
                            className={cn(
                              "inline-flex items-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold whitespace-nowrap",
                              late ? "bg-[#FDF3E3] text-[#A9720B]" : "bg-[#DFF6E4] text-[#1B8A46]"
                            )}
                          >
                            {late ? "Late" : "Submitted"}
                          </span>
                        </td>
                        <td className="px-3 py-3 border-b border-black/[0.055] align-middle text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteLogId(log.id)}
                            className="inline-flex w-7 h-7 items-center justify-center rounded-lg border border-black/[0.08] text-[#C23A3A] hover:bg-[#FDECEC]"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <AlertDialog open={!!deleteLogId} onOpenChange={(open) => !open && setDeleteLogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this log?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent and cannot be undone. This log entry will be removed from the
              employee's record.
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
            <AlertDialogTitle>
              Delete {selectedLogIds.size} Log{selectedLogIds.size > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent and cannot be undone. These log entries will be removed from
              the employee's record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteLogs}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

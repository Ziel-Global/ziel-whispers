import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { formatHours, getInitials } from "@/lib/utils";
import { isLogSubmissionLate } from "@/hooks/useWorkSettings";
import { Flag, Trash2, Pencil, Lock, ChevronDown, ChevronRight } from "lucide-react";

export interface LogsAdminTableProps {
  groupedRows: any[];
  expandedEmployeeId: string | null;
  setExpandedEmployeeId: (id: string | null) => void;
  selectedLogIds: Set<string>;
  setSelectedLogIds: (ids: Set<string>) => void;
  setBulkDeleteLogOpen: (open: boolean) => void;
  toggleAllLogsForEmployee: (logs: any[]) => void;
  employees: any[];
  globalShiftEnd: string;
  selectedDate: string;
  onEditLog: (log: any) => void;
  toggleFlag: (log: any) => void;
  toggleLock: (log: any) => void;
  onDeleteLog: (id: string) => void;
}

export function LogsAdminTable({
  groupedRows,
  expandedEmployeeId,
  setExpandedEmployeeId,
  selectedLogIds,
  setSelectedLogIds,
  setBulkDeleteLogOpen,
  toggleAllLogsForEmployee,
  employees,
  globalShiftEnd,
  selectedDate,
  onEditLog,
  toggleFlag,
  toggleLock,
  onDeleteLog,
}: LogsAdminTableProps) {
  return (
    <div className="flex-1 min-h-0 bg-white border border-black/[0.08] rounded-[14px] overflow-hidden shadow-sm flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white grid grid-cols-[40px_2.2fr_0.9fr_0.7fr_1fr_0.7fr_0.8fr_1fr] gap-2 px-5 py-3 border-b border-black/[0.06] text-[11px] font-bold text-[#B0B0B6] tracking-[0.05em] uppercase">
          <div />
          <span>EMPLOYEE</span>
          <span>DATE</span>
          <span>HOURS</span>
          <span>STATUS</span>
          <span>LATE</span>
          <span>FLAGGED</span>
          <span className="text-right pr-2">ACTIONS</span>
        </div>

        {selectedLogIds.size > 0 && (
          <div className="sticky top-[45px] z-10 flex items-center justify-between px-5 py-2.5 bg-[#17171A] text-white">
            <span className="text-xs font-semibold">
              {selectedLogIds.size} log{selectedLogIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedLogIds(new Set())}
                className="px-3 py-1 text-xs font-medium text-white/80 hover:text-white border border-white/20 rounded-md bg-transparent"
              >
                Clear selection
              </button>
              <button
                onClick={() => setBulkDeleteLogOpen(true)}
                className="px-3 py-1 text-xs bg-[#E5484D] text-white rounded-md hover:bg-red-700 flex items-center gap-1 font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete selected
              </button>
            </div>
          </div>
        )}

        {groupedRows.map((row) => {
          const isExpanded = expandedEmployeeId === row.userId;
          const allSelected = row.logs.length > 0 && row.logs.every((l: any) => selectedLogIds.has(l.id));
          const someSelected = row.logs.some((l: any) => selectedLogIds.has(l.id));
          const hasFlagged = row.hasFlaggedLog;
          const firstLog = row.logs[0];
          const projectMeta = firstLog
            ? `${firstLog.projects?.name || "Miscellaneous"} · ${firstLog.category?.replace(/_/g, " ")}${row.logs.length > 1 ? ` (+${row.logs.length - 1} more)` : ""}`
            : (row.leaveName || "No logs submitted");

          const empForLog = employees.find((e: any) => e.id === row.userId);
          const empShiftEnd = empForLog?.has_custom_shift ? empForLog.shift_end : globalShiftEnd;
          const isLateRow = row.logs.some((l: any) => l.submitted_at && empShiftEnd && isLogSubmissionLate(l.submitted_at, empShiftEnd, l.log_date));

          return (
            <div key={row.userId}>
              <div
                className={`grid grid-cols-[40px_2.2fr_0.9fr_0.7fr_1fr_0.7fr_0.8fr_1fr] gap-2 items-center px-5 py-3.5 border-b border-black/[0.05] cursor-pointer hover:bg-[#F6F5F3]/50 transition-colors ${isExpanded ? "bg-[#F6F5F3]/70" : ""}`}
                onClick={() => setExpandedEmployeeId(isExpanded ? null : row.userId)}
              >
                <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 accent-[#EB5A1E]"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={() => toggleAllLogsForEmployee(row.logs)}
                  />
                </div>

                {/* EMPLOYEE */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-[#FDECE3] text-[#EB5A1E] flex items-center justify-center text-[11.5px] font-bold shrink-0">
                    {getInitials(row.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-[#17171A] truncate flex items-center gap-1.5">
                      {row.name}
                      {hasFlagged && <Flag className="h-3 w-3 text-[#E5484D] fill-[#E5484D] shrink-0" />}
                    </p>
                    <p className="text-[12px] text-[#8B8B92] truncate">{projectMeta}</p>
                  </div>
                </div>

                {/* DATE */}
                <div className="text-[13px] text-[#4B4B52] whitespace-nowrap">
                  {format(new Date(selectedDate + "T00:00:00"), "MMM d, yyyy")}
                </div>

                {/* HOURS */}
                <div className="text-[13px] font-bold text-[#17171A]">
                  {formatHours(row.loggedHours)}
                </div>

                {/* STATUS */}
                <div><StatusBadge status={row.logStatus} /></div>

                {/* LATE */}
                <div className="text-[13px] font-medium text-[#8B8B92]">
                  {isLateRow ? <span className="text-[#A9720B] font-bold">Late</span> : "—"}
                </div>

                {/* FLAGGED */}
                <div className="text-[13px] font-medium text-[#8B8B92]">
                  {hasFlagged ? <span className="text-[#E5484D] font-bold">Flagged</span> : "—"}
                </div>

                {/* ACTIONS */}
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setExpandedEmployeeId(isExpanded ? null : row.userId)}
                    className="w-7 h-7 rounded-[8px] bg-[#F6F5F3] hover:bg-[#EBEBEB] text-[#4B4B52] flex items-center justify-center transition-colors"
                    title="Toggle Log Details"
                  >
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-[#4B4B52]" /> : <ChevronRight className="h-3.5 w-3.5 text-[#4B4B52]" />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="bg-[#F6F5F3]/30 border-b border-black/[0.06]">
                  {row.logs.length === 0 ? (
                    <div className="px-6 py-4 text-xs text-[#8B8B92]">No logs submitted this day.</div>
                  ) : (
                    <div className="divide-y divide-black/[0.05]">
                      {row.logs.map((log: any) => {
                        const empForLog = employees.find((e: any) => e.id === log.user_id);
                        const logShiftEnd = empForLog?.has_custom_shift ? empForLog.shift_end : globalShiftEnd;
                        const isLate = log.submitted_at && logShiftEnd && isLogSubmissionLate(log.submitted_at, logShiftEnd, log.log_date);
                        return (
                          <div key={log.id} className="px-6 py-3.5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs font-semibold capitalize border-black/10 text-[#4B4B52]">
                                    {(log.projects?.name || "Miscellaneous")}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs font-semibold capitalize bg-[#F6F5F3] text-[#4B4B52]">
                                    {log.category?.replace(/_/g, " ")}
                                  </Badge>
                                  <span className="text-xs font-bold text-[#17171A]">{formatHours(log.hours)}</span>
                                  {isLate && <Badge className="bg-[#FDF3E3] text-[#A9720B] text-[10px] font-bold border-0">Late</Badge>}
                                  {log.admin_flagged && <Badge className="bg-[#FDECEC] text-[#E5484D] text-[10px] font-bold border-0">Flagged</Badge>}
                                  {log.is_locked && <Badge className="bg-[#EAF3FF] text-[#1C6FC9] text-[10px] font-bold border-0">Locked</Badge>}
                                  {log.submitted_at && (
                                    <span className="text-[11.5px] text-[#8B8B92]">Submitted {format(new Date(log.submitted_at), "h:mm a")}</span>
                                  )}
                                </div>
                                {log.description && (
                                  <p className="text-[13px] text-[#4B4B52] whitespace-pre-wrap">{log.description}</p>
                                )}
                                {log.admin_comment && (
                                  <p className="text-xs text-[#1C6FC9] italic font-medium">Admin: {log.admin_comment}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => onEditLog(log)}
                                  className="w-7 h-7 rounded-[8px] bg-[#F6F5F3] hover:bg-[#EBEBEB] text-[#4B4B52] flex items-center justify-center transition-colors"
                                  title="Edit Log"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-[#4B4B52]" />
                                </button>
                                <button
                                  onClick={() => toggleFlag(log)}
                                  className="w-7 h-7 rounded-[8px] bg-[#F6F5F3] hover:bg-[#EBEBEB] text-[#4B4B52] flex items-center justify-center transition-colors"
                                  title={log.admin_flagged ? "Unflag" : "Flag"}
                                >
                                  <Flag className={`h-3.5 w-3.5 ${log.admin_flagged ? "text-[#E5484D] fill-[#E5484D]" : "text-[#8B8B92]"}`} />
                                </button>
                                <button
                                  onClick={() => toggleLock(log)}
                                  className="w-7 h-7 rounded-[8px] bg-[#F6F5F3] hover:bg-[#EBEBEB] text-[#4B4B52] flex items-center justify-center transition-colors"
                                  title={log.is_locked ? "Unlock" : "Lock"}
                                >
                                  <Lock className={`h-3.5 w-3.5 ${log.is_locked ? "text-[#1C6FC9]" : "text-[#8B8B92]"}`} />
                                </button>
                                <button
                                  onClick={() => onDeleteLog(log.id)}
                                  className="w-7 h-7 rounded-[8px] bg-[#FDECEC] hover:bg-[#FCD8D8] text-[#E5484D] flex items-center justify-center transition-colors"
                                  title="Delete Log"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-[#E5484D]" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

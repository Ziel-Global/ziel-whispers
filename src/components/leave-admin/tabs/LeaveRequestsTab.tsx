import React, { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard, MetricGroup } from "@/components/ui/metric-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Trash2, CalendarCheck, CalendarDays, AlertTriangle, ChevronRight, ChevronDown, Search } from "lucide-react";
import { format } from "date-fns";
import { getLeaveTypeName, getLeaveYearRange, getLeaveYearOptions, getInitials } from "@/lib/utils";
import { LEAVE_CATEGORIES } from "@/hooks/useLeaveAdminData";

export interface LeaveRequestsTabProps {
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  selectedYear: number;
  setSelectedYear: (v: number) => void;
  leaveTypeFilter: string;
  setLeaveTypeFilter: (v: string) => void;
  submittedDate: string;
  setSubmittedDate: (v: string) => void;
  summaryStats: {
    employeesOnLeaveToday: number;
    leavesThisMonth: number;
    employeesAtLimit: number;
  };
  setShowBalanceDialog: (v: boolean) => void;
  filtered: any[];
  requests: any[];
  employeeUsage: Record<string, { used: number; total: number }>;
  annualEntitlement: string;
  selectedLeaveIds: Set<string>;
  setSelectedLeaveIds: (ids: Set<string>) => void;
  setBulkDeleteLeaveOpen: (v: boolean) => void;
  setActionModal: (modal: { type: "approve" | "reject"; request: any } | null) => void;
}

export function LeaveRequestsTab({
  statusFilter,
  setStatusFilter,
  selectedYear,
  setSelectedYear,
  leaveTypeFilter,
  setLeaveTypeFilter,
  submittedDate,
  setSubmittedDate,
  summaryStats,
  setShowBalanceDialog,
  filtered,
  requests,
  employeeUsage,
  annualEntitlement,
  selectedLeaveIds,
  setSelectedLeaveIds,
  setBulkDeleteLeaveOpen,
  setActionModal,
}: LeaveRequestsTabProps) {
  const [searchQ, setSearchQ] = useState("");
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  const yearRange = getLeaveYearRange(selectedYear);
  const selectedYearLabel =
    getLeaveYearOptions().find((y) => y.startYear === selectedYear)?.label || String(selectedYear);

  const getEmployeeLeaveDetails = (userId: string) => {
    const entitlementVal = Number(annualEntitlement) || 12;
    const usage = employeeUsage[userId];
    const taken = usage?.used || 0;
    const total = usage?.total || entitlementVal;
    const remaining = Math.max(0, total - taken);

    const history = (requests || [])
      .filter(
        (req: any) =>
          req.user_id === userId &&
          req.start_date >= yearRange.start &&
          req.start_date <= yearRange.end
      )
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { taken, total, remaining, history };
  };


  const displayedList = filtered.filter((r: any) => {
    if (!searchQ) return true;
    const name = r.users?.full_name || "";
    return name.toLowerCase().includes(searchQ.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 font-sans overflow-hidden">
      {/* Summary KPI Cards Grid */}
      <MetricGroup columns={3}>
        <MetricCard
          variant="row"
          icon={<CalendarCheck className="h-4.5 w-4.5 text-[#1C6FC9]" />}
          iconClassName="bg-[#EAF3FF] text-[#1C6FC9]"
          label="On leave today"
          value={summaryStats.employeesOnLeaveToday}
        />
        <MetricCard
          variant="row"
          icon={<CalendarDays className="h-4.5 w-4.5 text-[#1FAA59]" />}
          iconClassName="bg-[#DFF6E4] text-[#1FAA59]"
          label="Leaves taken this month"
          value={summaryStats.leavesThisMonth}
        />
        <MetricCard
          variant="row"
          icon={<AlertTriangle className="h-4.5 w-4.5 text-[#A9720B]" />}
          iconClassName="bg-[#FDF3E3] text-[#A9720B]"
          label="Pending approvals"
          value={filtered.filter((r: any) => r.status === "pending").length}
          valueClassName="text-[#A9720B]"
          trailing={<ChevronRight className="h-4 w-4 text-[#B0B0B6] shrink-0" />}
          onClick={() => setShowBalanceDialog(true)}
        />
      </MetricGroup>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap gap-2.5 items-center shrink-0">
        <div className="flex-1 min-w-[220px] relative flex items-center bg-white border border-black/[0.08] rounded-[10px] px-3.5 py-2 shadow-sm">
          <Search className="h-3.5 w-3.5 text-[#8B8B92] shrink-0 mr-2" />
          <input
            type="text"
            placeholder="Search by employee name…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="w-full bg-transparent border-0 p-0 text-[13px] text-[#17171A] placeholder:text-[#B0B0B6] focus:outline-none font-sans"
          />
        </div>

        <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
          <SelectTrigger className="w-[160px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
            <SelectValue placeholder="Leave Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {LEAVE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[190px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getLeaveYearOptions().map((y) => (
              <SelectItem key={y.startYear} value={String(y.startYear)}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          type="date"
          value={submittedDate}
          onChange={(e) => setSubmittedDate(e.target.value)}
          className="w-[160px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm focus:outline-none"
        />
      </div>

      {/* Leave Requests Table */}
      {displayedList.length === 0 ? (
        <EmptyState message="No leave requests found for the selected filters" />
      ) : (
        <div className="flex-1 min-h-0 bg-white border border-black/[0.08] rounded-[14px] overflow-hidden shadow-sm flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white grid grid-cols-[40px_2fr_1fr_1fr_0.7fr_1fr_1fr] gap-2 px-5 py-3 border-b border-black/[0.06] text-[11px] font-bold text-[#B0B0B6] tracking-[0.05em] uppercase">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-[#EB5A1E]"
                checked={selectedLeaveIds.size === displayedList.length && displayedList.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedLeaveIds(new Set(displayedList.map((r: any) => r.id)));
                  else setSelectedLeaveIds(new Set());
                }}
              />
            </div>
            <span>EMPLOYEE</span>
            <span>FROM</span>
            <span>TO</span>
            <span>DAYS</span>
            <span>STATUS</span>
            <span className="text-right pr-2">ACTIONS</span>
          </div>

          {selectedLeaveIds.size > 0 && (
            <div className="sticky top-[45px] z-10 flex items-center justify-between px-5 py-2.5 bg-[#17171A] text-white">
              <span className="text-xs font-semibold">
                {selectedLeaveIds.size} leave request{selectedLeaveIds.size > 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedLeaveIds(new Set())}
                  className="px-3 py-1 text-xs font-medium text-white/80 hover:text-white border border-white/20 rounded-md bg-transparent"
                >
                  Clear selection
                </button>
                <button
                  onClick={() => setBulkDeleteLeaveOpen(true)}
                  className="px-3 py-1 text-xs bg-[#E5484D] text-white rounded-md hover:bg-red-700 flex items-center gap-1 font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete selected
                </button>
              </div>
            </div>
          )}

          {displayedList.map((r: any) => {
            const isExpanded = expandedRequestId === r.id;
            const empDetails = isExpanded ? getEmployeeLeaveDetails(r.user_id) : null;

            return (
              <div
                key={r.id}
                className="border-b border-black/[0.05] transition-colors"
              >
                <div
                  onClick={() => setExpandedRequestId((prev) => (prev === r.id ? null : r.id))}
                  className={`grid grid-cols-[40px_2fr_1fr_1fr_0.7fr_1fr_1fr] gap-2 items-center px-5 py-3.5 cursor-pointer hover:bg-[#F6F5F3]/50 transition-colors ${
                    isExpanded ? "bg-[#F6F5F3]/60" : ""
                  }`}
                >
                  <div
                    className="flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 accent-[#EB5A1E]"
                      checked={selectedLeaveIds.has(r.id)}
                      onChange={(e) => {
                        const next = new Set(selectedLeaveIds);
                        if (e.target.checked) next.add(r.id);
                        else next.delete(r.id);
                        setSelectedLeaveIds(next);
                      }}
                    />
                  </div>

                  {/* EMPLOYEE */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-[#FDECE3] text-[#EB5A1E] flex items-center justify-center text-[11.5px] font-bold shrink-0">
                      {getInitials(r.users?.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13.5px] font-bold text-[#17171A] truncate">{r.users?.full_name || "Unknown"}</p>
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-[#8B8B92] shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-[#B0B0B6] shrink-0" />
                        )}
                      </div>
                      <span className="inline-block bg-[#F6F5F3] text-[#4B4B52] text-[10.5px] font-bold px-2 py-0.5 rounded-full capitalize mt-0.5">
                        {getLeaveTypeName(r)}
                      </span>
                    </div>
                  </div>

                  {/* FROM */}
                  <div className="text-[13px] text-[#4B4B52]">
                    {format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")}
                  </div>

                  {/* TO */}
                  <div className="text-[13px] text-[#4B4B52]">
                    {format(new Date(r.end_date + "T00:00:00"), "MMM d, yyyy")}
                  </div>

                  {/* DAYS */}
                  <div className="text-[13px] font-bold text-[#17171A]">
                    {r.hours ? `${r.hours} hrs` : r.days_count}
                  </div>

                  {/* STATUS */}
                  <div><StatusBadge status={r.status} /></div>

                  {/* ACTIONS */}
                  <div
                    className="flex items-center justify-end gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r.status === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setActionModal({ type: "approve", request: r })}
                          className="w-7 h-7 rounded-[8px] bg-[#DFF6E4] hover:bg-[#C9F0D2] text-[#1B8A46] flex items-center justify-center transition-colors"
                          title="Approve"
                        >
                          <Check className="h-3.5 w-3.5 text-[#1B8A46]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionModal({ type: "reject", request: r })}
                          className="w-7 h-7 rounded-[8px] bg-[#FDECEC] hover:bg-[#FCD8D8] text-[#C23A3A] flex items-center justify-center transition-colors"
                          title="Reject"
                        >
                          <X className="h-3.5 w-3.5 text-[#C23A3A]" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Reason / Admin comment sub-row */}
                  {(r.reason || ((r.status === "approved" || r.status === "rejected") && r.admin_comment)) && (
                    <div className="col-span-full pl-[52px] pt-1 text-[11.5px] text-[#8B8B92] flex gap-4">
                      {r.reason && (
                        <p>
                          <span className="font-semibold text-[#4B4B52]">Reason: </span>
                          {r.reason}
                        </p>
                      )}
                      {(r.status === "approved" || r.status === "rejected") && r.admin_comment && (
                        <p className="text-[#1C6FC9] italic">
                          <span className="font-semibold not-italic">Admin: </span>
                          {r.admin_comment}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded Employee Leave Details Dropdown */}
                {isExpanded && empDetails && (
                  <div className="bg-[#FAF9F7] border-t border-black/[0.06] px-6 py-4 pl-[60px]">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                      <div>
                        <p className="text-[12.5px] font-bold text-[#17171A]">
                          {r.users?.full_name || "Unknown"} — Leave Summary ({selectedYearLabel})
                        </p>
                        {(r.users?.department || r.users?.email) && (
                          <p className="text-[11.5px] text-[#8B8B92] mt-0.5">
                            {[r.users?.department, r.users?.email].filter(Boolean).join(" • ")}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="bg-white border border-black/[0.08] rounded-[10px] px-3.5 py-2 flex items-center gap-2 shadow-xs">
                          <span className="text-[11px] font-semibold text-[#8B8B92] uppercase tracking-wider">Taken</span>
                          <span className="text-[13.5px] font-bold text-[#17171A]">
                            {empDetails.taken} <span className="text-[11.5px] font-medium text-[#8B8B92]">/ {empDetails.total} days</span>
                          </span>
                        </div>
                        <div className="bg-white border border-black/[0.08] rounded-[10px] px-3.5 py-2 flex items-center gap-2 shadow-xs">
                          <span className="text-[11px] font-semibold text-[#8B8B92] uppercase tracking-wider">Remaining</span>
                          <span
                            className={`text-[13.5px] font-bold ${
                              empDetails.remaining === 0 ? "text-[#C23A3A]" : "text-[#1B8A46]"
                            }`}
                          >
                            {empDetails.remaining} days
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-black/[0.08] rounded-[10px] overflow-hidden">
                      <div className="px-4 py-2 border-b border-black/[0.06] bg-[#F6F5F3]/60 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#4B4B52] uppercase tracking-[0.04em]">
                          Leave History ({empDetails.history.length})
                        </span>
                      </div>

                      {empDetails.history.length === 0 ? (
                        <div className="px-4 py-3 text-[12px] text-[#8B8B92]">
                          No leave requests found for this leave year.
                        </div>
                      ) : (
                        <div className="divide-y divide-black/[0.05] max-h-[240px] overflow-y-auto">
                          {empDetails.history.map((hist: any) => (
                            <div
                              key={hist.id}
                              className={`px-4 py-2.5 flex flex-col gap-1 text-[12px] ${
                                hist.id === r.id ? "bg-[#FDECE3]/30" : ""
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="bg-[#F6F5F3] text-[#17171A] font-bold px-2 py-0.5 rounded-full text-[11px] capitalize">
                                    {getLeaveTypeName(hist)}
                                  </span>
                                  <span className="text-[#4B4B52] font-medium">
                                    {format(new Date(hist.start_date + "T00:00:00"), "MMM d, yyyy")}
                                    {hist.end_date && hist.end_date !== hist.start_date
                                      ? ` – ${format(new Date(hist.end_date + "T00:00:00"), "MMM d, yyyy")}`
                                      : ""}
                                  </span>
                                  <span className="text-[#8B8B92]">•</span>
                                  <span className="font-semibold text-[#17171A]">
                                    {hist.hours ? `${hist.hours} hrs` : `${hist.days_count} day${hist.days_count === 1 ? "" : "s"}`}
                                  </span>
                                  {hist.id === r.id && (
                                    <span className="text-[10px] font-bold text-[#EB5A1E] bg-[#FDECE3] px-1.5 py-0.5 rounded">
                                      Selected
                                    </span>
                                  )}
                                </div>
                                <StatusBadge status={hist.status} />
                              </div>
                              <p className="text-[11.5px] text-[#8B8B92]">
                                <span className="font-semibold text-[#4B4B52]">Reason: </span>
                                {hist.reason || "No reason provided"}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}


import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Trash2, CalendarCheck, CalendarDays, AlertTriangle, ChevronRight, Search } from "lucide-react";
import { format } from "date-fns";
import { getLeaveTypeName, getLeaveYearRange, getLeaveYearOptions } from "@/lib/utils";
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
  selectedLeaveIds,
  setSelectedLeaveIds,
  setBulkDeleteLeaveOpen,
  setActionModal,
}: LeaveRequestsTabProps) {
  const [searchQ, setSearchQ] = useState("");

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-[#DFF6E4] text-[#1B8A46] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize">Approved</Badge>;
      case "pending":
        return <Badge className="bg-[#FDF3E3] text-[#A9720B] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-[#FDECEC] text-[#C23A3A] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize">Rejected</Badge>;
      default:
        return <Badge className="bg-[#F6F5F3] text-[#8B8B92] font-semibold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize">{status}</Badge>;
    }
  };

  const displayedList = filtered.filter((r: any) => {
    if (!searchQ) return true;
    const name = r.users?.full_name || "";
    return name.toLowerCase().includes(searchQ.toLowerCase());
  });

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Summary KPI Cards Grid */}
      <div className="bg-white border border-black/[0.08] rounded-[14px] grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.07] overflow-hidden shadow-sm">
        <div className="p-5 flex items-center gap-3.5">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-[#EAF3FF] text-[#1C6FC9] flex items-center justify-center shrink-0">
            <CalendarCheck className="h-4.5 w-4.5 text-[#1C6FC9]" />
          </div>
          <div>
            <p className="text-[13px] text-[#8B8B92] font-medium">On leave today</p>
            <p className="text-[24px] font-bold text-[#17171A] tracking-[-0.5px]">{summaryStats.employeesOnLeaveToday}</p>
          </div>
        </div>

        <div className="p-5 flex items-center gap-3.5">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-[#DFF6E4] text-[#1FAA59] flex items-center justify-center shrink-0">
            <CalendarDays className="h-4.5 w-4.5 text-[#1FAA59]" />
          </div>
          <div>
            <p className="text-[13px] text-[#8B8B92] font-medium">Leaves taken this month</p>
            <p className="text-[24px] font-bold text-[#17171A] tracking-[-0.5px]">{summaryStats.leavesThisMonth}</p>
          </div>
        </div>

        <div
          className="p-5 flex items-center gap-3.5 cursor-pointer hover:bg-[#F6F5F3]/50 transition-colors"
          onClick={() => setShowBalanceDialog(true)}
        >
          <div className="w-[38px] h-[38px] rounded-[10px] bg-[#FDF3E3] text-[#A9720B] flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4.5 w-4.5 text-[#A9720B]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-[#8B8B92] font-medium">Pending approvals</p>
            <p className="text-[24px] font-bold text-[#A9720B] tracking-[-0.5px]">
              {filtered.filter((r: any) => r.status === "pending").length}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-[#B0B0B6] shrink-0" />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap gap-2.5 items-center">
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
        <div className="bg-white border border-black/[0.08] rounded-[14px] p-8 text-center text-[#8B8B92] text-sm shadow-sm">
          No leave requests found for the selected filters
        </div>
      ) : (
        <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden shadow-sm">
          <div className="grid grid-cols-[40px_2fr_1fr_1fr_0.7fr_1fr_1fr] gap-2 px-5 py-3 border-b border-black/[0.06] text-[11px] font-bold text-[#B0B0B6] tracking-[0.05em] uppercase">
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
            <div className="flex items-center justify-between px-5 py-2.5 bg-[#17171A] text-white">
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

          {displayedList.map((r: any) => (
            <div
              key={r.id}
              className="grid grid-cols-[40px_2fr_1fr_1fr_0.7fr_1fr_1fr] gap-2 items-center px-5 py-3.5 border-b border-black/[0.05] hover:bg-[#F6F5F3]/50 transition-colors"
            >
              <div className="flex items-center justify-center">
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
                  <p className="text-[13.5px] font-bold text-[#17171A] truncate">{r.users?.full_name || "Unknown"}</p>
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
              <div>{statusBadge(r.status)}</div>

              {/* ACTIONS */}
              <div className="flex items-center justify-end gap-1.5">
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
          ))}
        </div>
      )}
    </div>
  );
}


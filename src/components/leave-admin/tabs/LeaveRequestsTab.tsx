import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataRow, RowPrimary, RowSecondary, RowDataItem, RowBadgeItem, RowActions, TableHeader } from "@/components/ui/data-row";
import { Check, X, Trash2, CalendarCheck, CalendarDays, AlertTriangle, ChevronRight } from "lucide-react";
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
  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-700",
      cancelled: "bg-gray-100 text-gray-500",
    };
    return <Badge className={`${map[status] || ""} capitalize`}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Leave Year: {getLeaveYearRange(selectedYear).label}
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[210px]">
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

        <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
          <SelectTrigger className="w-[160px]">
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

        <Input
          type="date"
          value={submittedDate}
          onChange={(e) => setSubmittedDate(e.target.value)}
          className="w-[160px]"
          placeholder="Submitted date"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
            <CalendarCheck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{summaryStats.employeesOnLeaveToday}</p>
            <p className="text-xs text-muted-foreground">Employees on leave today</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
            <CalendarDays className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{summaryStats.leavesThisMonth}</p>
            <p className="text-xs text-muted-foreground">Leaves taken this month</p>
          </div>
        </Card>

        <Card
          className="p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowBalanceDialog(true)}
        >
          <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="text-muted-foreground font-medium" style={{ fontSize: 20 }}>
              Employee Leave Balance
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Card>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-muted-foreground">No requests</div>
        </Card>
      ) : (
        <div>
          <TableHeader gridCols="40px 1fr 112px 112px 80px 96px 80px">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={selectedLeaveIds.size === filtered.length && filtered.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedLeaveIds(new Set(filtered.map((r: any) => r.id)));
                  else setSelectedLeaveIds(new Set());
                }}
              />
            </div>
            <span>EMPLOYEE</span>
            <span>FROM</span>
            <span>TO</span>
            <span>DAYS</span>
            <span>STATUS</span>
            <span className="text-right">ACTIONS</span>
          </TableHeader>

          {selectedLeaveIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
              <span className="text-sm text-blue-700">
                {selectedLeaveIds.size} leave request{selectedLeaveIds.size > 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedLeaveIds(new Set())}
                  className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg bg-white"
                >
                  Clear selection
                </button>
                <button
                  onClick={() => setBulkDeleteLeaveOpen(true)}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete selected
                </button>
              </div>
            </div>
          )}

          {filtered.map((r: any) => (
            <DataRow key={r.id} gridCols="40px 1fr 112px 112px 80px 96px 80px">
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={selectedLeaveIds.has(r.id)}
                  onChange={(e) => {
                    const next = new Set(selectedLeaveIds);
                    if (e.target.checked) next.add(r.id);
                    else next.delete(r.id);
                    setSelectedLeaveIds(next);
                  }}
                />
              </div>
              <div>
                <RowPrimary>{r.users?.full_name}</RowPrimary>
                <RowSecondary>{getLeaveTypeName(r)}</RowSecondary>
              </div>
              <RowDataItem label="FROM">
                {format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")}
              </RowDataItem>
              <RowDataItem label="TO">
                {format(new Date(r.end_date + "T00:00:00"), "MMM d, yyyy")}
              </RowDataItem>
              <RowDataItem label="DAYS">{r.hours ? `${r.hours} hrs` : r.days_count}</RowDataItem>
              <RowBadgeItem label="STATUS">{statusBadge(r.status)}</RowBadgeItem>
              <RowActions className="justify-self-end">
                {r.status === "pending" && (
                  <>
                    <button
                      onClick={() => setActionModal({ type: "approve", request: r })}
                      className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-green-600"
                      title="Approve"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setActionModal({ type: "reject", request: r })}
                      className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-destructive"
                      title="Reject"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
              </RowActions>
              <div style={{ gridColumn: "1 / -1" }} className="flex gap-4 mt-1">
                {r.reason && (
                  <p className="text-[11px] text-[#6b7280]">
                    <span className="text-[10px] uppercase tracking-wider text-[#9ca3af]">Reason: </span>
                    {r.reason}
                  </p>
                )}
                {(r.status === "approved" || r.status === "rejected") && r.admin_comment && (
                  <p className="text-[11px] text-[#6b7280]" title={r.admin_comment}>
                    <span className="text-[10px] uppercase tracking-wider text-[#9ca3af]">Admin: </span>
                    {r.admin_comment}
                  </p>
                )}
              </div>
            </DataRow>
          ))}
        </div>
      )}
    </div>
  );
}

import React from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard, MetricGroup } from "@/components/ui/metric-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Trash2, Laptop } from "lucide-react";
import { format } from "date-fns";
import { getInitials } from "@/lib/utils";

export interface WFHRequestsTabProps {
  wfhStatusFilter: string;
  setWfhStatusFilter: (v: string) => void;
  wfhFiltered: any[];
  selectedWfhIds: Set<string>;
  setSelectedWfhIds: (ids: Set<string>) => void;
  setBulkDeleteWfhOpen: (v: boolean) => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  handleWfhAction: (id: string, type: "approve" | "reject", userId: string) => Promise<void>;
  setWfhDeleteId: (id: string | null) => void;
}

export function WFHRequestsTab({
  wfhStatusFilter,
  setWfhStatusFilter,
  wfhFiltered,
  selectedWfhIds,
  setSelectedWfhIds,
  setBulkDeleteWfhOpen,
  expandedId,
  setExpandedId,
  handleWfhAction,
  setWfhDeleteId,
}: WFHRequestsTabProps) {
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const remoteTodayCount = wfhFiltered.filter(
    (r: any) => r.status === "approved" && r.start_date <= todayStr && r.end_date >= todayStr
  ).length;
  const approvedCount = wfhFiltered.filter((r: any) => r.status === "approved").length;
  const rejectedCount = wfhFiltered.filter((r: any) => r.status === "rejected").length;

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 font-sans overflow-hidden">
      {/* Summary KPI Cards Grid */}
      <MetricGroup columns={3}>
        <MetricCard
          variant="row"
          icon={<Laptop className="h-4.5 w-4.5 text-[#1C6FC9]" />}
          iconClassName="bg-[#EAF3FF] text-[#1C6FC9]"
          label="Remote today"
          value={remoteTodayCount}
        />
        <MetricCard
          variant="row"
          icon={<Check className="h-4.5 w-4.5 text-[#1FAA59]" />}
          iconClassName="bg-[#DFF6E4] text-[#1FAA59]"
          label="Approved requests"
          value={approvedCount}
        />
        <MetricCard
          variant="row"
          icon={<X className="h-4.5 w-4.5 text-[#C23A3A]" />}
          iconClassName="bg-[#FDECEC] text-[#C23A3A]"
          label="Rejected requests"
          value={rejectedCount}
        />
      </MetricGroup>

      {/* Filter Toolbar */}
      <div className="flex gap-2.5 items-center shrink-0">
        <Select value={wfhStatusFilter} onValueChange={setWfhStatusFilter}>
          <SelectTrigger className="w-[140px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Remote Requests Table */}
      {wfhFiltered.length === 0 ? (
        <EmptyState message="No Remote Requests found" />
      ) : (
        <div className="flex-1 min-h-0 bg-white border border-black/[0.08] rounded-[14px] overflow-hidden shadow-sm flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white grid grid-cols-[40px_1.8fr_1.1fr_0.5fr_0.9fr_0.8fr_1.1fr_0.8fr] gap-2 px-5 py-3 border-b border-black/[0.06] text-[11px] font-bold text-[#B0B0B6] tracking-[0.05em] uppercase">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-[#EB5A1E]"
                checked={selectedWfhIds.size === wfhFiltered.length && wfhFiltered.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedWfhIds(new Set(wfhFiltered.map((r: any) => r.id)));
                  else setSelectedWfhIds(new Set());
                }}
              />
            </div>
            <span>EMPLOYEE</span>
            <span>DATE RANGE</span>
            <span>DAYS</span>
            <span>SUBMITTED</span>
            <span>STATUS</span>
            <span>REVIEWED</span>
            <span className="text-right pr-2">ACTIONS</span>
          </div>

          {selectedWfhIds.size > 0 && (
            <div className="sticky top-[45px] z-10 flex items-center justify-between px-5 py-2.5 bg-[#17171A] text-white">
              <span className="text-xs font-semibold">
                {selectedWfhIds.size} remote work request{selectedWfhIds.size > 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedWfhIds(new Set())}
                  className="px-3 py-1 text-xs font-medium text-white/80 hover:text-white border border-white/20 rounded-md bg-transparent"
                >
                  Clear selection
                </button>
                <button
                  onClick={() => setBulkDeleteWfhOpen(true)}
                  className="px-3 py-1 text-xs bg-[#E5484D] text-white rounded-md hover:bg-red-700 flex items-center gap-1 font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete selected
                </button>
              </div>
            </div>
          )}

          {wfhFiltered.map((r: any) => (
            <React.Fragment key={r.id}>
              <div
                className={`grid grid-cols-[40px_1.8fr_1.1fr_0.5fr_0.9fr_0.8fr_1.1fr_0.8fr] gap-2 items-center px-5 py-3.5 border-b border-black/[0.05] cursor-pointer hover:bg-[#F6F5F3]/50 transition-colors ${
                  r.users?.is_oversight ? "bg-[#FFFBEB]/70" : r.status === "pending" ? "bg-[#FFFBEB]/40" : ""
                }`}
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              >
                <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 accent-[#EB5A1E]"
                    checked={selectedWfhIds.has(r.id)}
                    onChange={(e) => {
                      const next = new Set(selectedWfhIds);
                      if (e.target.checked) next.add(r.id);
                      else next.delete(r.id);
                      setSelectedWfhIds(next);
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
                    <p className="text-[12px] text-[#8B8B92] truncate">{r.users?.designation || "—"}</p>
                  </div>
                </div>

                {/* DATE RANGE */}
                <div className="text-[13px] text-[#4B4B52]">
                  {r.start_date === r.end_date
                    ? format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")
                    : `${format(new Date(r.start_date + "T00:00:00"), "MMM d")} — ${format(
                        new Date(r.end_date + "T00:00:00"),
                        "MMM d, yyyy"
                      )}`}
                </div>

                {/* DAYS */}
                <div className="text-[13px] font-bold text-[#17171A]">{r.days_count}</div>

                {/* SUBMITTED */}
                <div className="text-[13px] text-[#4B4B52]">{format(new Date(r.created_at), "MMM d, yyyy")}</div>

                {/* STATUS */}
                <div><StatusBadge status={r.status} /></div>

                {/* REVIEWED */}
                <div className="text-[12px] text-[#8B8B92]">
                  {r.reviewed_at ? (
                    <>
                      {format(new Date(r.reviewed_at), "MMM d")}{" "}
                      <span className="text-[11px] text-[#8B8B92]">by {r.reviewer?.full_name || "Admin"}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </div>

                {/* ACTIONS */}
                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {r.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleWfhAction(r.id, "approve", r.user_id)}
                        className="w-7 h-7 rounded-[8px] bg-[#DFF6E4] hover:bg-[#C9F0D2] text-[#1B8A46] flex items-center justify-center transition-colors"
                        title="Approve"
                      >
                        <Check className="h-3.5 w-3.5 text-[#1B8A46]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWfhAction(r.id, "reject", r.user_id)}
                        className="w-7 h-7 rounded-[8px] bg-[#FDECEC] hover:bg-[#FCD8D8] text-[#C23A3A] flex items-center justify-center transition-colors"
                        title="Reject"
                      >
                        <X className="h-3.5 w-3.5 text-[#C23A3A]" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setWfhDeleteId(r.id)}
                    className="w-7 h-7 rounded-[8px] bg-[#FDECEC] hover:bg-[#FCD8D8] text-[#EB5A1E] flex items-center justify-center transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[#EB5A1E]" />
                  </button>
                </div>
              </div>

              {expandedId === r.id && (
                <div className="bg-[#F6F5F3]/30 border-b border-black/[0.06] px-6 py-4 space-y-3 font-sans">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10.5px] uppercase tracking-wider text-[#8B8B92] font-bold">Employee</p>
                      <p className="text-[13px] font-bold text-[#17171A] mt-0.5">{r.users?.full_name}</p>
                      <p className="text-[12px] text-[#8B8B92]">{r.users?.designation || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] uppercase tracking-wider text-[#8B8B92] font-bold">Date Range</p>
                      <p className="text-[13px] text-[#4B4B52] mt-0.5 font-medium">
                        {r.start_date === r.end_date
                          ? format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")
                          : `${format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")} — ${format(
                              new Date(r.end_date + "T00:00:00"),
                              "MMM d, yyyy"
                            )}`}
                      </p>
                      <p className="text-[11.5px] text-[#8B8B92]">{r.days_count} working day(s)</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] uppercase tracking-wider text-[#8B8B92] font-bold">Submitted On</p>
                      <p className="text-[13px] text-[#4B4B52] mt-0.5 font-medium">
                        {format(new Date(r.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10.5px] uppercase tracking-wider text-[#8B8B92] font-bold">Reason</p>
                    <p className="text-[13px] text-[#4B4B52] mt-0.5 whitespace-pre-wrap">{r.reason || "No reason provided"}</p>
                  </div>
                  {r.status !== "pending" && (
                    <div className="flex items-center gap-2 pt-1">
                      <StatusBadge status={r.status} />
                      {r.reviewed_at && (
                        <span className="text-[11.5px] text-[#8B8B92]">
                          Reviewed {format(new Date(r.reviewed_at), "MMM d, yyyy 'at' h:mm a")} by{" "}
                          {r.reviewer?.full_name || "Admin"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}


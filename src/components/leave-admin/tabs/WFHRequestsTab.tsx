import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataRow, RowPrimary, RowSecondary, RowDataItem, RowBadgeItem, RowActions, TableHeader } from "@/components/ui/data-row";
import { Check, X, Trash2 } from "lucide-react";
import { format } from "date-fns";

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
      <div className="flex gap-3">
        <Select value={wfhStatusFilter} onValueChange={setWfhStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {wfhFiltered.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-muted-foreground">No Remote Requests</div>
        </Card>
      ) : (
        <div>
          <TableHeader gridCols="40px 1fr 1fr 80px 112px 96px 1fr 80px">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
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
            <span className="text-right">ACTIONS</span>
          </TableHeader>

          {selectedWfhIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
              <span className="text-sm text-blue-700">
                {selectedWfhIds.size} remote work request{selectedWfhIds.size > 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedWfhIds(new Set())}
                  className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg bg-white"
                >
                  Clear selection
                </button>
                <button
                  onClick={() => setBulkDeleteWfhOpen(true)}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete selected
                </button>
              </div>
            </div>
          )}

          {wfhFiltered.map((r: any) => (
            <React.Fragment key={r.id}>
              <DataRow
                className={`${
                  r.users?.is_oversight ? "bg-amber-50/70" : r.status === "pending" ? "bg-yellow-50/50" : ""
                }`}
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                gridCols="40px 1fr 1fr 80px 112px 96px 1fr 80px"
              >
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={selectedWfhIds.has(r.id)}
                    onChange={(e) => {
                      const next = new Set(selectedWfhIds);
                      if (e.target.checked) next.add(r.id);
                      else next.delete(r.id);
                      setSelectedWfhIds(next);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div>
                  <RowPrimary>{r.users?.full_name}</RowPrimary>
                  <RowSecondary>{r.users?.designation || "—"}</RowSecondary>
                </div>
                <RowDataItem label="DATE RANGE">
                  {r.start_date === r.end_date
                    ? format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")
                    : `${format(new Date(r.start_date + "T00:00:00"), "MMM d")} — ${format(
                        new Date(r.end_date + "T00:00:00"),
                        "MMM d, yyyy"
                      )}`}
                </RowDataItem>
                <RowDataItem label="DAYS">{r.days_count}</RowDataItem>
                <RowDataItem label="SUBMITTED">{format(new Date(r.created_at), "MMM d, yyyy")}</RowDataItem>
                <RowBadgeItem label="STATUS">{statusBadge(r.status)}</RowBadgeItem>
                <RowDataItem label="REVIEWED">
                  {r.reviewed_at ? (
                    <>
                      {format(new Date(r.reviewed_at), "MMM d")}{" "}
                      <span className="text-[11px] text-[#9ca3af]">by {r.reviewer?.full_name || "Admin"}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </RowDataItem>
                <RowActions className="justify-self-end">
                  {r.status === "pending" && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWfhAction(r.id, "approve", r.user_id);
                        }}
                        className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-green-600"
                        title="Approve"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWfhAction(r.id, "reject", r.user_id);
                        }}
                        className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-destructive"
                        title="Reject"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setWfhDeleteId(r.id);
                    }}
                    className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </RowActions>
              </DataRow>

              {expandedId === r.id && (
                <div className="bg-[#f9fafb] border-b border-[#f3f4f6] px-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium">Employee</p>
                      <p className="text-sm font-medium text-[#111827] mt-0.5">{r.users?.full_name}</p>
                      <p className="text-xs text-[#6b7280]">{r.users?.designation || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium">Date Range</p>
                      <p className="text-sm text-[#374151] mt-0.5">
                        {r.start_date === r.end_date
                          ? format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")
                          : `${format(new Date(r.start_date + "T00:00:00"), "MMM d, yyyy")} — ${format(
                              new Date(r.end_date + "T00:00:00"),
                              "MMM d, yyyy"
                            )}`}
                      </p>
                      <p className="text-xs text-[#6b7280]">{r.days_count} working day(s)</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium">Submitted On</p>
                      <p className="text-sm text-[#374151] mt-0.5">
                        {format(new Date(r.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-wider text-[#9ca3af] font-medium">Reason</p>
                    <p className="text-sm text-[#374151] mt-0.5 whitespace-pre-wrap">{r.reason || "No reason provided"}</p>
                  </div>
                  {r.status !== "pending" && (
                    <div className="flex items-center gap-2 mt-2">
                      {statusBadge(r.status)}
                      {r.reviewed_at && (
                        <span className="text-xs text-[#6b7280]">
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
      )}
    </div>
  );
}

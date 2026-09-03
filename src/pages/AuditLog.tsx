import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Search, Shield, FileText, MoreHorizontal, Eye } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const ACTION_LABELS: Record<string, string> = {
  "user.created": "User Created",
  "user.updated": "User Updated",
  "user.deactivated": "User Deactivated",
  "user.reactivated": "User Reactivated",
  "user.invited": "User Invited",
  "client.created": "Client Created",
  "client.updated": "Client Updated",
  "client.archived": "Client Archived",
  "project.created": "Project Created",
  "project.updated": "Project Updated",
  "project.status_changed": "Project Status Changed",
  "project.member_added": "Member Added to Project",
  "project.member_removed": "Member Removed from Project",
  "log.submitted": "Log Submitted",
  "log.edited": "Log Edited",
  "log.admin_flagged": "Log Flagged",
  "log.locked": "Log Locked",
  "attendance.clocked_in": "Clocked In",
  "attendance.clocked_out": "Clocked Out",
  "attendance.clock_in": "Clocked In",   // legacy key alias
  "attendance.clock_out": "Clocked Out", // legacy key alias
  "attendance.edited": "Attendance Edited",
  "leave.requested": "Leave Requested",
  "leave.approved": "Leave Approved",
  "leave.rejected": "Leave Rejected",
  "leave.cancelled": "Leave Cancelled",
  "leave.deleted": "Leave Deleted",
  "announcement.created": "Announcement Created",
  "announcement.updated": "Announcement Updated",
  "announcement.deleted": "Announcement Deleted",
  "settings.updated": "Settings Updated",
  "session.login": "User Logged In",
  "session.logout": "User Logged Out",
  "impersonation.started": "Impersonation Started",
  "impersonation.ended": "Impersonation Ended",
  "user.oversight_on": "Marked as Oversight",
  "user.oversight_off": "Removed from Oversight",
  "wfh.approved": "Work From Home Approved",
  "wfh.rejected": "Work From Home Rejected",
  "wfh.deleted": "Work From Home Deleted",
};

const formatMetadata = (metadata: any, userMap?: Record<string, string>): string => {
  if (!metadata) return "—";
  if (typeof metadata === "string") return metadata;
  
  const resolveValue = (val: any) => {
    if (typeof val === "string" && userMap && userMap[val]) return userMap[val];
    return typeof val === "object" ? JSON.stringify(val) : String(val);
  };

  if (Array.isArray(metadata)) {
    return metadata.map(resolveValue).join(", ");
  }

  if (typeof metadata === "object") {
    return Object.entries(metadata)
      .map(([key, value]) => {
        const formattedKey = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
        const formattedValue = resolveValue(value);
        return `${formattedKey}: ${formattedValue}`;
      })
      .join(" | ");
  }
  
  return JSON.stringify(metadata);
};

const PAGE_SIZE = 25;

export default function AuditLogPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: userNamesMap } = useQuery({
    queryKey: ["user-names-map"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, full_name");
      const map: Record<string, string> = {};
      data?.forEach(u => map[u.id] = u.full_name);
      return map;
    },
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", page, actionFilter],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*, users:actor_id(full_name, avatar_url, designation, department, role)")
        .order("created_at", { ascending: false });

      if (actionFilter !== "all") {
        q = q.eq("action", actionFilter);
      }

      const { data, error } = await q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!logs) return [];
    return logs.filter((l) => {
      const q = search.toLowerCase();
      const actorName = ((l as any).users?.full_name || "System").toLowerCase();
      const actionLabel = (ACTION_LABELS[l.action] || l.action).toLowerCase();
      return !q || actorName.includes(q) || actionLabel.includes(q) || l.action.includes(q);
    });
  }, [logs, search]);

  const actionTypes = useMemo(() => {
    return Object.keys(ACTION_LABELS).sort();
  }, []);

  const exportCSV = () => {
    const rows = filtered.map((l) => ({
      Timestamp: format(new Date(l.created_at), "yyyy-MM-dd HH:mm:ss"),
      Actor: (l as any).users?.full_name || "System",
      Action: ACTION_LABELS[l.action] || l.action,
      Target: l.target_entity || "",
      Details: JSON.stringify(l.metadata || {}),
    }));
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String((r as any)[k]).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "audit-logs.csv"; a.click();
  };

  const getActionBadge = (action: string) => {
    const label = ACTION_LABELS[action] || action;
    if (action.includes("login") || action.includes("clock") || action.includes("approved") || action.includes("reactivated") || action.includes("created")) {
      return <span className="inline-block bg-[#DFF6E4] text-[#1B8A46] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full capitalize">{label}</span>;
    }
    if (action.includes("submitted") || action.includes("requested") || action.includes("updated") || action.includes("edited") || action.includes("flagged")) {
      return <span className="inline-block bg-[#FDF3E3] text-[#A9720B] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full capitalize">{label}</span>;
    }
    if (action.includes("project") || action.includes("member")) {
      return <span className="inline-block bg-[#EAF3FF] text-[#1C6FC9] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full capitalize">{label}</span>;
    }
    if (action.includes("delete") || action.includes("rejected") || action.includes("deactivated") || action.includes("logout")) {
      return <span className="inline-block bg-[#FDECEC] text-[#C23A3A] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full capitalize">{label}</span>;
    }
    return <span className="inline-block bg-[#F6F5F3] text-[#8B8B92] font-semibold text-[11.5px] px-2.5 py-0.5 rounded-full capitalize">{label}</span>;
  };

  const getInitials = (name: string) => {
    if (!name) return "S";
    return name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 flex-wrap gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.5px] text-[#17171A]">Audit Log</h1>
          <p className="text-[13px] text-[#8B8B92] font-normal mt-0.5">Immutable record of all system events</p>
        </div>
        <button
          type="button"
          onClick={exportCSV}
          className="flex items-center gap-2 bg-white border border-black/[0.08] hover:bg-[#F6F5F3] text-[#4B4B52] font-semibold rounded-[10px] px-4 py-2 text-[13px] transition-colors shadow-sm whitespace-nowrap"
        >
          <Download className="h-3.5 w-3.5 text-[#4B4B52]" />
          Export CSV
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="flex-1 min-w-[220px] relative flex items-center bg-white border border-black/[0.08] rounded-[10px] px-3.5 py-2 shadow-sm">
          <Search className="h-3.5 w-3.5 text-[#8B8B92] shrink-0 mr-2" />
          <input
            type="text"
            placeholder="Search by actor or action…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-0 p-0 text-[13px] text-[#17171A] placeholder:text-[#B0B0B6] focus:outline-none font-sans"
          />
        </div>

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actionTypes.map((a) => (
              <SelectItem key={a} value={a}>
                {ACTION_LABELS[a] || a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden shadow-sm font-sans">
        <div className="grid grid-cols-[1.1fr_1.4fr_1.4fr_1fr_1.4fr_0.4fr] gap-2 px-5 py-3 border-b border-black/[0.06] text-[11px] font-bold text-[#B0B0B6] tracking-[0.05em] uppercase">
          <span>TIMESTAMP</span>
          <span>ACTOR</span>
          <span>ACTION</span>
          <span>TARGET</span>
          <span>DETAILS</span>
          <span className="text-right pr-2">ACTIONS</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-[#8B8B92] text-sm">Loading audit logs…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-[#8B8B92] text-sm">
            <Shield className="h-8 w-8 mx-auto text-[#B0B0B6] mb-2" />
            <p className="font-semibold text-[#17171A]">No audit logs found</p>
            <p className="text-[12px] text-[#8B8B92] mt-0.5">System events will appear here</p>
          </div>
        ) : (
          filtered.map((l) => {
            const actorName = (l as any).users?.full_name || "System";
            const initials = getInitials(actorName);
            const metadataStr = formatMetadata(l.metadata, userNamesMap);

            return (
              <div
                key={l.id}
                className="grid grid-cols-[1.1fr_1.4fr_1.4fr_1fr_1.4fr_0.4fr] gap-2 items-center px-5 py-3.5 border-b border-black/[0.05] hover:bg-[#F6F5F3]/50 transition-colors"
              >
                {/* TIMESTAMP */}
                <div>
                  <p className="text-[13px] font-bold text-[#17171A] whitespace-nowrap">
                    {format(new Date(l.created_at), "MMM d, yyyy")}
                  </p>
                  <p className="text-[11.5px] text-[#8B8B92]">{format(new Date(l.created_at), "h:mm:ss a")}</p>
                </div>

                {/* ACTOR */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-6 w-6 rounded-full bg-[#FDECE3] text-[#EB5A1E] flex items-center justify-center text-[10.5px] font-bold shrink-0">
                    {initials}
                  </div>
                  <span className="text-[13px] font-bold text-[#17171A] truncate">{actorName}</span>
                </div>

                {/* ACTION */}
                <div>{getActionBadge(l.action)}</div>

                {/* TARGET */}
                <div className="text-[13px] text-[#4B4B52] font-mono truncate">{l.target_entity || "—"}</div>

                {/* DETAILS */}
                <div className="text-[12.5px] text-[#8B8B92] truncate" title={metadataStr}>
                  {metadataStr}
                </div>

                {/* ACTIONS / MORE */}
                <div className="flex items-center justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-7 h-7 rounded-[8px] hover:bg-[#F6F5F3] flex items-center justify-center text-[#8B8B92] transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4 text-[#8B8B92]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="font-sans">
                      <DropdownMenuItem onClick={() => setSelectedLog(l)} className="text-[12.5px] cursor-pointer">
                        <Eye className="mr-2 h-3.5 w-3.5 text-[#4B4B52]" /> View Details
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex justify-center gap-2 pt-1">
        {page > 0 && (
          <button
            type="button"
            onClick={() => setPage(page - 1)}
            className="bg-white border border-black/[0.08] hover:bg-[#F6F5F3] text-[#4B4B52] font-semibold rounded-[8px] px-3.5 py-1.5 text-[12.5px] transition-colors shadow-sm"
          >
            Previous
          </button>
        )}
        {logs && logs.length === PAGE_SIZE && (
          <button
            type="button"
            onClick={() => setPage(page + 1)}
            className="bg-white border border-black/[0.08] hover:bg-[#F6F5F3] text-[#4B4B52] font-semibold rounded-[8px] px-3.5 py-1.5 text-[12.5px] transition-colors shadow-sm"
          >
            Next
          </button>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="font-sans sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold text-[#17171A]">Audit Log Details</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-5">
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#8B8B92] border-b border-black/[0.06] pb-1.5">
                Actor Information
              </h3>
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <p className="text-[11.5px] text-[#8B8B92]">Full Name</p>
                  <p className="font-bold text-[#17171A]">{selectedLog?.users?.full_name || "System"}</p>
                </div>
                <div>
                  <p className="text-[11.5px] text-[#8B8B92]">Designation</p>
                  <p className="text-[#4B4B52]">{selectedLog?.users?.designation || "—"}</p>
                </div>
                <div>
                  <p className="text-[11.5px] text-[#8B8B92]">Department</p>
                  <p className="text-[#4B4B52]">{selectedLog?.users?.department || "—"}</p>
                </div>
                <div>
                  <p className="text-[11.5px] text-[#8B8B92]">Role</p>
                  <span className="inline-block bg-[#F6F5F3] text-[#4B4B52] text-[10.5px] font-bold px-2 py-0.5 rounded-full capitalize">
                    {selectedLog?.users?.role || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#8B8B92] border-b border-black/[0.06] pb-1.5">
                Action Details
              </h3>
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <p className="text-[11.5px] text-[#8B8B92]">Action Type</p>
                  <p className="font-bold text-[#17171A]">
                    {selectedLog ? ACTION_LABELS[selectedLog.action] || selectedLog.action : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11.5px] text-[#8B8B92]">Target Entity</p>
                  <p className="text-[#4B4B52] font-mono">{selectedLog?.target_entity || "—"}</p>
                </div>
                <div>
                  <p className="text-[11.5px] text-[#8B8B92]">Target ID</p>
                  <p className="text-[#8B8B92] font-mono truncate" title={selectedLog?.target_id}>
                    {selectedLog?.target_id || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11.5px] text-[#8B8B92]">Timestamp</p>
                  <p className="text-[#4B4B52]">{selectedLog ? format(new Date(selectedLog.created_at), "PPpp") : "—"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#8B8B92] border-b border-black/[0.06] pb-1.5">
                Metadata Detail
              </h3>
              {selectedLog?.metadata ? (
                <div className="bg-[#F9F9FB] p-3.5 rounded-[10px] overflow-auto text-[12px] max-h-[220px] border border-black/[0.06]">
                  <pre className="whitespace-pre-wrap font-mono text-[#4B4B52]">
                    {JSON.stringify(selectedLog.metadata, (key, value) => {
                      if (userNamesMap && userNamesMap[value]) return `${userNamesMap[value]} (${value})`;
                      return value;
                    }, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-[12px] text-[#8B8B92] italic">No additional metadata available.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


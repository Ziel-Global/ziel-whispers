import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  "announcement.created": "Announcement Created",
  "announcement.updated": "Announcement Updated",
  "announcement.deleted": "Announcement Deleted",
  "settings.updated": "Settings Updated",
  "session.login": "User Logged In",
  "session.logout": "User Logged Out",
  "impersonation.started": "Impersonation Started",
  "impersonation.ended": "Impersonation Ended",
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground mt-1">Immutable record of all system events</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" />Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by actor or action…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actionTypes.map((a) => <SelectItem key={a} value={a}>{ACTION_LABELS[a] || a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Shield className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="font-medium">No audit logs found</p>
                  <p className="text-sm text-muted-foreground">System events will appear here</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    <div>{format(new Date(l.created_at), "MMM d, yyyy")}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(l.created_at), "h:mm:ss a")}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">{((l as any).users?.full_name || "S")[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{(l as any).users?.full_name || "System"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">
                      {ACTION_LABELS[l.action] || l.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.target_entity || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={formatMetadata(l.metadata, userNamesMap)}>
                    {formatMetadata(l.metadata, userNamesMap)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedLog(l)}>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex justify-center gap-2">
        {page > 0 && <Button variant="outline" size="sm" onClick={() => setPage(page - 1)}>Previous</Button>}
        {logs && logs.length === PAGE_SIZE && <Button variant="outline" size="sm" onClick={() => setPage(page + 1)}>Next</Button>}
      </div>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2 uppercase tracking-wider text-muted-foreground">Actor Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Full Name</p>
                  <p className="text-sm">{selectedLog?.users?.full_name || "System"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Designation</p>
                  <p className="text-sm">{selectedLog?.users?.designation || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Department</p>
                  <p className="text-sm">{selectedLog?.users?.department || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Role</p>
                  <Badge variant="outline" className="capitalize text-[10px] h-5">{selectedLog?.users?.role || "—"}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2 uppercase tracking-wider text-muted-foreground">Action Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Action Type</p>
                  <p className="text-sm">{selectedLog ? ACTION_LABELS[selectedLog.action] || selectedLog.action : "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Target Entity</p>
                  <p className="text-sm font-mono">{selectedLog?.target_entity || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Target ID</p>
                  <p className="text-sm font-mono text-muted-foreground truncate" title={selectedLog?.target_id}>{selectedLog?.target_id || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Timestamp</p>
                  <p className="text-sm">{selectedLog ? format(new Date(selectedLog.created_at), "PPpp") : "—"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold border-b pb-2 uppercase tracking-wider text-muted-foreground">Metadata Detail</h3>
              {selectedLog?.metadata ? (
                <div className="bg-muted p-4 rounded-md overflow-auto text-xs max-h-[250px] border">
                  <pre className="whitespace-pre-wrap font-mono">
                    {JSON.stringify(selectedLog.metadata, (key, value) => {
                      if (userNamesMap && userNamesMap[value]) return `${userNamesMap[value]} (${value})`;
                      return value;
                    }, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No additional metadata available.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

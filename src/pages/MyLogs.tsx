import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataRow, RowPrimary, RowSecondary, RowDataItem, RowBadgeItem, RowActions, TableHeader } from "@/components/ui/data-row";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Lock, MessageSquare, Eye } from "lucide-react";
import { format } from "date-fns";
import { useWorkSettings, isLogSubmissionLate } from "@/hooks/useWorkSettings";
import { formatHours, MISC_PROJECT_ID, getProjectName } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function MyLogsPage() {
  const { user } = useAuth();
  const { shiftEnd } = useWorkSettings();
  const [selectedDate, setSelectedDate] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => { setPage(0); }, [selectedDate, projectFilter]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["my-logs", user?.id, selectedDate, projectFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("daily_logs")
        .select("*, projects(name)")
        .eq("user_id", user!.id)
        .eq("status", "submitted")
        .order("log_date", { ascending: false });

      if (selectedDate) query = query.eq("log_date", selectedDate);
      if (projectFilter === MISC_PROJECT_ID) query = query.is("project_id", null);
      else if (projectFilter !== "all") query = query.eq("project_id", projectFilter);

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data } = await query;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ["my-logs-count", user?.id, selectedDate, projectFilter],
    queryFn: async () => {
      let query = supabase
        .from("daily_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "submitted");
      if (selectedDate) query = query.eq("log_date", selectedDate);
      if (projectFilter === MISC_PROJECT_ID) query = query.is("project_id", null);
      else if (projectFilter !== "all") query = query.eq("project_id", projectFilter);
      const { count } = await query;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["my-logged-projects", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("project_id, projects(id, name)")
        .eq("user_id", user!.id)
        .eq("status", "submitted")
        .not("project_id", "is", null);
      const uniqueProjects = Array.from(new Set((data || []).map(d => d.project_id)))
        .map(id => (data || []).find(d => d.project_id === id)?.projects)
        .filter(Boolean);
      return uniqueProjects.sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    enabled: !!user?.id,
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">My Log History</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Filter by Date</p>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-[180px]" />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Filter by Project</p>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              <SelectItem value={MISC_PROJECT_ID}>Miscellaneous</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(selectedDate || projectFilter !== "all") && (
          <Button variant="ghost" onClick={() => { setSelectedDate(""); setProjectFilter("all"); }} className="text-muted-foreground hover:text-foreground">
            Clear Filters
          </Button>
        )}
      </div>

      <div className="border border-border rounded-card bg-card overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-muted-foreground">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground">No logs found for this period.</div>
        ) : (
          <div>
            <TableHeader gridCols="1fr 112px 80px 96px 80px 80px">
              <span>PROJECT</span>
              <span>DATE</span>
              <span>HOURS</span>
              <span>STATUS</span>
              <span>LATE</span>
              <span className="text-right">ACTIONS</span>
            </TableHeader>
            {logs.map((log: any) => {
              const isLate = log.submitted_at && isLogSubmissionLate(log.submitted_at, shiftEnd, log.log_date);
              return (
                <DataRow key={log.id} gridCols="1fr 112px 80px 96px 80px 80px">
                  <div>
                    <RowPrimary>{getProjectName(log)}</RowPrimary>
                    <RowSecondary>{log.category}</RowSecondary>
                  </div>
                  <RowDataItem label="DATE">{format(new Date(log.log_date + "T00:00:00"), "MMM d, yyyy")}</RowDataItem>
                  <RowDataItem label="HOURS">{formatHours(log.hours)}</RowDataItem>
                  <RowBadgeItem label="STATUS">
                    <Badge variant="secondary" className="text-[10px]">{log.status}</Badge>
                  </RowBadgeItem>
                  <RowBadgeItem label="LATE">
                    {isLate ? <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Late</Badge> : <span className="text-[13px] text-[#374151]">—</span>}
                  </RowBadgeItem>
                  <RowActions className="justify-self-end">
                    <Popover open={selectedLog?.id === log.id} onOpenChange={(open) => setSelectedLog(open ? log : null)}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="end">
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold">Log Details</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="text-muted-foreground">Date</span><p className="font-medium">{format(new Date(log.log_date + "T00:00:00"), "MMM d, yyyy")}</p></div>
                            <div><span className="text-muted-foreground">Hours</span><p className="font-medium">{formatHours(log.hours)}</p></div>
                            <div><span className="text-muted-foreground">Project</span><p className="font-medium">{getProjectName(log)}</p></div>
                            <div><span className="text-muted-foreground">Category</span><p className="font-medium">{log.category?.replace(/_/g, " ")}</p></div>
                            <div><span className="text-muted-foreground">Status</span><p className="font-medium capitalize">{log.status}</p></div>
                            <div><span className="text-muted-foreground">Late</span><p className="font-medium">{isLate ? "Yes" : "No"}</p></div>
                          </div>
                          {log.submitted_at && (
                            <div className="text-sm"><span className="text-muted-foreground">Submitted</span><p className="font-medium">{format(new Date(log.submitted_at), "MMM d, yyyy h:mm a")}</p></div>
                          )}
                          {log.description && (
                            <div className="text-sm"><span className="text-muted-foreground">Description</span><p className="mt-1 text-sm whitespace-pre-wrap">{log.description}</p></div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </RowActions>
                  {log.admin_comment && (
                    <div style={{ gridColumn: "1 / -1" }} className="flex items-start gap-2 bg-accent/50 border border-border rounded-md p-2.5 mt-1">
                      <MessageSquare className="h-4 w-4 text-black mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-black">Admin Feedback:</span>
                        <p className="text-sm text-foreground">{log.admin_comment}</p>
                      </div>
                    </div>
                  )}
                </DataRow>
              );
            })}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</Button>
        </div>
      )}
    </div>
  );
}

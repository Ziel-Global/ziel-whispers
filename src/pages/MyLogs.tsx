import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DataRow, RowPrimary, RowSecondary, RowDataGrid, RowDataItem, RowBadgeItem, RowActions, TableHeader, editButtonClass } from "@/components/ui/data-row";
import { Lock, MessageSquare, Eye, Pencil, Trash2 } from "lucide-react";
import { format, subDays } from "date-fns";
import { useWorkSettings, getPKTDateString, formatPKTTime, isLogSubmissionLate } from "@/hooks/useWorkSettings";

import { formatHours, MISC_PROJECT_ID, getProjectName } from "@/lib/utils";

export default function MyLogsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { shiftEnd } = useWorkSettings();
  const [selectedDate, setSelectedDate] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: logs = [] } = useQuery({
    queryKey: ["my-logs", user?.id, selectedDate, projectFilter],
    queryFn: async () => {
      let query = supabase
        .from("daily_logs")
        .select("*, projects(name)")
        .eq("user_id", user!.id)
        .eq("status", "submitted")
        .order("log_date", { ascending: false });

      if (selectedDate) {
        query = query.eq("log_date", selectedDate);
      }

      if (projectFilter === MISC_PROJECT_ID) {
        query = query.is("project_id", null);
      } else if (projectFilter !== "all") {
        query = query.eq("project_id", projectFilter);
      }

      const { data } = await query;
      return data || [];
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

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("daily_logs").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Log deleted");
    setDeleteId(null);
    queryClient.invalidateQueries({ queryKey: ["my-logs"] });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">My Log History</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Filter by Date</p>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-[180px]"
          />
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
          <Button
            variant="ghost"
            onClick={() => { setSelectedDate(""); setProjectFilter("all"); }}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear Filters
          </Button>
        )}
      </div>

      <div className="border border-border rounded-card bg-card overflow-hidden">
        {logs.length === 0 ? (
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
                  <Button variant="ghost" size="icon" onClick={() => navigate(`/logs/${log.id}`)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <button onClick={() => navigate(`/logs/${log.id}/edit`)} className={editButtonClass}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(log.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
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

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Log?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Lock, MessageSquare } from "lucide-react";
import { format, subDays } from "date-fns";

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export default function MyLogsPage() {
  const { user } = useAuth();
  const [range, setRange] = useState("7");
  const [projectFilter, setProjectFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const fromDate = range === "custom" ? customFrom : format(subDays(new Date(), Number(range)), "yyyy-MM-dd");
  const toDate = range === "custom" ? customTo : format(new Date(), "yyyy-MM-dd");

  const { data: logs = [] } = useQuery({
    queryKey: ["my-logs", user?.id, fromDate, toDate, projectFilter],
    queryFn: async () => {
      let query = supabase
        .from("daily_logs")
        .select("*, projects(name)")
        .eq("user_id", user!.id)
        .gte("log_date", fromDate)
        .lte("log_date", toDate)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (projectFilter !== "all") query = query.eq("project_id", projectFilter);
      const { data } = await query;
      return data || [];
    },
    enabled: !!user?.id && !!fromDate && !!toDate,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["my-projects-filter", user?.id],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("project_members")
        .select("projects(id, name)")
        .eq("user_id", user!.id)
        .is("removed_at", null);
      return (memberships || []).map((m: any) => m.projects).filter(Boolean);
    },
    enabled: !!user?.id,
  });

  const grouped = logs.reduce((acc: Record<string, any[]>, log: any) => {
    if (!acc[log.log_date]) acc[log.log_date] = [];
    acc[log.log_date].push(log);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">My Log History</h1>

      <div className="flex flex-wrap gap-3">
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
        {range === "custom" && (
          <>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[160px]" />
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[160px]" />
          </>
        )}
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No logs found for this period.</p>
      ) : (
        Object.entries(grouped).map(([date, dayLogs]: [string, any[]]) => {
          const totalHours = dayLogs.reduce((s: number, l: any) => s + Number(l.hours), 0);
          return (
            <div key={date} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{format(new Date(date + "T00:00:00"), "EEEE, MMM d, yyyy")}</h3>
                <span className="text-sm font-medium text-muted-foreground">Total: {formatHours(totalHours)}</span>
              </div>
              <div className="space-y-2">
                {dayLogs.map((log: any) => (
                  <Card key={log.id} className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                      <div>
                        <p className="text-[12px] text-muted-foreground mb-0.5">Logged Hours</p>
                        <p className="text-sm font-medium">{formatHours(log.hours)}</p>
                      </div>
                      <div>
                        <p className="text-[12px] text-muted-foreground mb-0.5">Submitted Time</p>
                        <p className="text-sm">{format(new Date(log.submitted_at), "h:mm a")}</p>
                      </div>
                      <div>
                        <p className="text-[12px] text-muted-foreground mb-0.5">Project Name</p>
                        <p className="text-sm">{log.projects?.name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[12px] text-muted-foreground mb-0.5">Category</p>
                        <Badge variant="secondary">{log.category}</Badge>
                      </div>
                    </div>
                    <div className="mb-2">
                      <p className="text-[12px] text-muted-foreground mb-0.5">Description</p>
                      <p className="text-sm text-muted-foreground">{log.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {log.is_late && <Badge className="bg-yellow-100 text-yellow-800">Late</Badge>}
                      {log.is_locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    {log.admin_comment && (
                      <div className="mt-2 flex items-start gap-2 bg-accent/50 border border-border rounded-md p-2.5">
                        <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-primary">Admin Feedback:</span>
                          <p className="text-sm text-foreground">{log.admin_comment}</p>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

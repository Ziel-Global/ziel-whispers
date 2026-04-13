import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Download, Flag, ChevronDown, ChevronUp, Search } from "lucide-react";
import { format, subDays } from "date-fns";

const CATEGORIES = ["development", "meeting", "bug_fix", "code_review", "deployment", "documentation", "testing", "other"];

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export default function LogsAdminPage() {
  const { user: _user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-logs", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_logs")
        .select("*, users!daily_logs_user_id_fkey(full_name, email), projects(name)")
        .gte("log_date", dateFrom)
        .lte("log_date", dateTo)
        .order("log_date", { ascending: false })
        .order("submitted_at", { ascending: false });
      return data || [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, full_name").eq("status", "active");
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return logs.filter((l: any) => {
      const matchEmp = employeeFilter === "all" || l.user_id === employeeFilter;
      const matchCat = categoryFilter === "all" || l.category === categoryFilter;
      const matchStatus = statusFilter === "all" ||
        (statusFilter === "late" && l.is_late) ||
        (statusFilter === "ontime" && !l.is_late && !l.is_missed) ||
        (statusFilter === "missed" && l.is_missed);
      const matchSearch = !searchQ || l.description?.toLowerCase().includes(searchQ.toLowerCase());
      return matchEmp && matchCat && matchStatus && matchSearch;
    });
  }, [logs, employeeFilter, categoryFilter, statusFilter, searchQ]);

  const toggleFlag = async (log: any) => {
    await supabase.from("daily_logs").update({ admin_flagged: !log.admin_flagged }).eq("id", log.id);
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };

  const toggleLock = async (log: any) => {
    await supabase.from("daily_logs").update({ is_locked: !log.is_locked }).eq("id", log.id);
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };

  const saveComment = async (logId: string) => {
    await supabase.from("daily_logs").update({ admin_comment: comment }).eq("id", logId);
    toast.success("Comment saved");
    queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };

  const exportCSV = () => {
    const header = "Date,Employee,Project,Category,Hours,Description,Status\n";
    const rows = filtered.map((l: any) =>
      `"${l.log_date}","${l.users?.full_name}","${l.projects?.name || ""}","${l.category}",${l.hours},"${l.description?.replace(/"/g, '""')}","${l.is_late ? "Late" : l.is_missed ? "Missed" : "On Time"}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `logs_${dateFrom}_${dateTo}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">All Daily Logs</h1>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search descriptions…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="pl-9" />
        </div>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Employee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ontime">On Time</SelectItem>
            <SelectItem value="late">Late</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No logs found</TableCell></TableRow>
            ) : (
              filtered.map((log: any) => (
                <>
                  <TableRow key={log.id} className={`cursor-pointer ${log.is_missed ? "bg-red-50" : ""}`} onClick={() => { setExpandedId(expandedId === log.id ? null : log.id); setComment(log.admin_comment || ""); }}>
                    <TableCell>{expandedId === log.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</TableCell>
                    <TableCell>{format(new Date(log.log_date + "T00:00:00"), "MMM d")}</TableCell>
                    <TableCell className="font-medium">{log.users?.full_name}</TableCell>
                    <TableCell>{log.projects?.name || "—"}</TableCell>
                    <TableCell>{log.category}</TableCell>
                    <TableCell>{formatHours(log.hours)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{log.description}</TableCell>
                    <TableCell>
                      {log.is_missed ? <Badge className="bg-red-100 text-red-700">Missed</Badge> :
                       log.is_late ? <Badge className="bg-yellow-100 text-yellow-800">Late</Badge> :
                       <Badge className="bg-green-100 text-green-800">On Time</Badge>}
                    </TableCell>
                    <TableCell>{log.admin_flagged && <Flag className="h-4 w-4 text-destructive fill-destructive" />}</TableCell>
                  </TableRow>
                  {expandedId === log.id && (
                    <TableRow key={`${log.id}-detail`}>
                      <TableCell colSpan={9} className="bg-muted/50">
                        <div className="p-3 space-y-3">
                          <p className="text-sm">{log.description}</p>
                          {isAdmin && (
                            <>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs">Flag</Label>
                                  <Switch checked={log.admin_flagged} onCheckedChange={() => toggleFlag(log)} />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs">Lock</Label>
                                  <Switch checked={log.is_locked} onCheckedChange={() => toggleLock(log)} />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Admin Comment</Label>
                                <div className="flex gap-2">
                                  <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="flex-1" />
                                  <Button size="sm" onClick={() => saveComment(log.id)}>Save</Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

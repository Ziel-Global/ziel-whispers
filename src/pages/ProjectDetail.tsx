import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Plus, Trash2, Download } from "lucide-react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const STATUS_OPTIONS = ["active", "on_hold", "completed", "archived"];
const STATUS_COLORS: Record<string, string> = { active: "bg-green-100 text-green-800", on_hold: "bg-yellow-100 text-yellow-800", completed: "bg-blue-100 text-blue-800", archived: "bg-muted text-muted-foreground" };
const CHART_COLORS = ["hsl(82,100%,72%)", "#60a5fa", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#ec4899"];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [roleInputs, setRoleInputs] = useState<Record<string, string>>({});
  const [statusNote, setStatusNote] = useState("");
  const [completionWarning, setCompletionWarning] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*, clients(id, name)").eq("id", id!).single();
      if (error) throw error;
      setStatusNote(data.status_note || "");
      return data;
    },
    enabled: !!id,
  });

  const { data: members } = useQuery({
    queryKey: ["project-members", id],
    queryFn: async () => {
      const { data } = await supabase.from("project_members").select("*, users(id, full_name, designation, avatar_url), project_roles(name)").eq("project_id", id!).is("removed_at", null);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: allEmployees } = useQuery({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, full_name, designation").eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: logs } = useQuery({
    queryKey: ["project-logs", id],
    queryFn: async () => {
      const { data } = await supabase.from("daily_logs").select("*, users(full_name)").eq("project_id", id!).order("log_date", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const availableEmployees = allEmployees?.filter((e) => !members?.some((m) => (m.users as any)?.id === e.id)) || [];

  const toggleUser = (uid: string) => {
    setSelectedUsers((prev) => prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]);
  };

  const addMembers = async () => {
    if (selectedUsers.length === 0) return;
    try {
      for (const uid of selectedUsers) {
        const roleName = roleInputs[uid]?.trim() || "Member";
        let roleId: string | null = null;
        const { data: existingRole } = await supabase.from("project_roles").select("id").eq("project_id", id!).eq("name", roleName).maybeSingle();
        if (existingRole) { roleId = existingRole.id; } else {
          const { data: newRole } = await supabase.from("project_roles").insert({ project_id: id!, name: roleName }).select("id").single();
          roleId = newRole?.id || null;
        }
        await supabase.from("project_members").insert({ project_id: id!, user_id: uid, project_role_id: roleId });
        await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "project.member_added", target_entity: "project_members", target_id: id, metadata: { user_id: uid } });
      }
      toast.success(`${selectedUsers.length} member(s) added`);
      setSelectedUsers([]);
      setRoleInputs({});
      setAddMemberOpen(false);
      queryClient.invalidateQueries({ queryKey: ["project-members", id] });
    } catch (err: any) { toast.error(err.message); }
  };

  const removeMember = async (memberId: string, userId: string) => {
    await supabase.from("project_members").update({ removed_at: new Date().toISOString() }).eq("id", memberId);
    await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "project.member_removed", target_entity: "project_members", target_id: id, metadata: { user_id: userId } });
    toast.success("Member removed");
    queryClient.invalidateQueries({ queryKey: ["project-members", id] });
  };

  const changeStatus = async (newStatus: string) => {
    if (newStatus === "completed") { setPendingStatus(newStatus); setCompletionWarning(true); return; }
    await doStatusChange(newStatus);
  };

  const doStatusChange = async (newStatus: string) => {
    setCompletionWarning(false);
    await supabase.from("projects").update({ status: newStatus, status_note: statusNote || null }).eq("id", id!);
    await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "project.status_changed", target_entity: "projects", target_id: id, metadata: { new_status: newStatus } });
    toast.success(`Status changed to ${newStatus}`);
    queryClient.invalidateQueries({ queryKey: ["project", id] });
  };

  const saveStatusNote = async () => {
    await supabase.from("projects").update({ status_note: statusNote || null }).eq("id", id!);
    toast.success("Note saved");
  };

  const formatHours = (h: number) => { const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`; };

  const exportCSV = (rows: any[], filename: string) => {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;
  if (!project) return <div className="text-center py-12 text-muted-foreground">Project not found</div>;

  // Stats data
  const totalHours = logs?.reduce((sum, l) => sum + Number(l.hours), 0) || 0;
  const hoursByMember = Object.values(
    (logs || []).reduce((acc: Record<string, { name: string; hours: number }>, l) => {
      const name = (l.users as any)?.full_name || "Unknown";
      acc[name] = acc[name] || { name, hours: 0 };
      acc[name].hours += Number(l.hours);
      return acc;
    }, {})
  ).sort((a: any, b: any) => b.hours - a.hours);

  const categoryBreakdown = Object.values(
    (logs || []).reduce((acc: Record<string, { name: string; value: number }>, l) => {
      acc[l.category] = acc[l.category] || { name: l.category, value: 0 };
      acc[l.category].value += Number(l.hours);
      return acc;
    }, {})
  );

  const weeklyLogs = Object.entries(
    (logs || []).reduce((acc: Record<string, number>, l) => {
      const week = format(new Date(l.log_date), "yyyy-'W'II");
      acc[week] = (acc[week] || 0) + Number(l.hours);
      return acc;
    }, {})
  ).sort().map(([week, hours]) => ({ week, hours }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={STATUS_COLORS[project.status] || ""}>{project.status}</Badge>
            <span className="text-muted-foreground text-sm">{(project.clients as any)?.name}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {isAdmin && <TabsTrigger value="members">Members ({members?.length || 0})</TabsTrigger>}
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <Card className="p-6 space-y-4">
            {project.description && <p className="text-muted-foreground">{project.description}</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground block">Client</span><span className="font-medium">{(project.clients as any)?.name}</span></div>
              <div><span className="text-muted-foreground block">Start Date</span><span className="font-medium">{format(new Date(project.start_date), "MMM d, yyyy")}</span></div>
              <div><span className="text-muted-foreground block">End Date</span><span className="font-medium">{project.end_date ? format(new Date(project.end_date), "MMM d, yyyy") : "—"}</span></div>
              <div><span className="text-muted-foreground block">Status</span><span className="font-medium">{project.status.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</span></div>
            </div>
            {isAdmin && (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <span className="text-sm font-medium block mb-1">Change Status</span>
                    <Select value={project.status} onValueChange={changeStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium block mb-1">Status Note</span>
                  <div className="flex gap-2">
                    <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={2} className="flex-1" />
                    <Button variant="outline" size="sm" onClick={saveStatusNote}>Save</Button>
                  </div>
                </div>
              </div>
            )}
            {!isAdmin && project.status === "on_hold" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">This project is currently on hold.</div>
            )}
          </Card>
        </TabsContent>

        {/* MEMBERS */}
        {isAdmin && (
          <TabsContent value="members">
            <Card>
              <div className="p-4 flex justify-between items-center border-b">
                <span className="font-medium">{members?.length || 0} members</span>
                <Button size="sm" onClick={() => setAddMemberOpen(true)} className="rounded-button"><Plus className="h-4 w-4 mr-1" />Add Member</Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Designation</TableHead><TableHead>Role</TableHead><TableHead>Assigned</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {members?.sort((a: any, b: any) => (a.users?.full_name || "").localeCompare(b.users?.full_name || "")).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{((m.users as any)?.full_name || "?")[0]}</AvatarFallback></Avatar>
                          {(m.users as any)?.full_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{(m.users as any)?.designation}</TableCell>
                      <TableCell><Badge variant="outline">{(m.project_roles as any)?.name || "Member"}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(m.assigned_at), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeMember(m.id, (m.users as any)?.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!members || members.length === 0) && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No members assigned</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        )}

        {/* LOGS */}
        <TabsContent value="logs">
          <Card>
            <div className="p-4 flex justify-between items-center border-b">
              <span className="font-medium">{logs?.length || 0} logs · {formatHours(totalHours)} total</span>
              <Button variant="outline" size="sm" onClick={() => exportCSV(
                (logs || []).map((l) => ({ Date: l.log_date, Employee: (l.users as any)?.full_name, Category: l.category, Hours: l.hours, Description: l.description })),
                `${project.name}-logs.csv`
              )}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>Category</TableHead><TableHead>Hours</TableHead><TableHead>Description</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {logs?.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{format(new Date(l.log_date), "MMM d")}</TableCell>
                    <TableCell>{(l.users as any)?.full_name}</TableCell>
                    <TableCell><Badge variant="outline">{l.category}</Badge></TableCell>
                    <TableCell>{formatHours(Number(l.hours))}</TableCell>
                    <TableCell className="max-w-xs truncate">{l.description}</TableCell>
                  </TableRow>
                ))}
                {(!logs || logs.length === 0) && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No logs yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* STATS */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-5 text-center"><p className="text-sm text-muted-foreground">Total Hours</p><p className="text-3xl font-bold">{formatHours(totalHours)}</p></Card>
            <Card className="p-5 text-center"><p className="text-sm text-muted-foreground">Team Members</p><p className="text-3xl font-bold">{members?.length || 0}</p></Card>
            <Card className="p-5 text-center"><p className="text-sm text-muted-foreground">Log Entries</p><p className="text-3xl font-bold">{logs?.length || 0}</p></Card>
          </div>

          {hoursByMember.length > 0 && (
            <Card className="p-5 mb-4">
              <h3 className="font-medium mb-3">Hours by Team Member</h3>
              <ResponsiveContainer width="100%" height={Math.max(200, hoursByMember.length * 40)}>
                <BarChart data={hoursByMember} layout="vertical" margin={{ left: 100 }}>
                  <XAxis type="number" /><YAxis type="category" dataKey="name" width={90} />
                  <Tooltip /><Bar dataKey="hours" fill="hsl(82,100%,72%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoryBreakdown.length > 0 && (
              <Card className="p-5">
                <h3 className="font-medium mb-3">Category Breakdown</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {categoryBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            )}
            {weeklyLogs.length > 0 && (
              <Card className="p-5">
                <h3 className="font-medium mb-3">Weekly Hours</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={weeklyLogs}><XAxis dataKey="week" /><YAxis /><Tooltip /><Line type="monotone" dataKey="hours" stroke="hsl(82,100%,72%)" strokeWidth={2} /></LineChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Member Sheet */}
      <Sheet open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <SheetContent className="flex flex-col h-full">
          <SheetHeader><SheetTitle>Add Members</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
            {availableEmployees.length === 0 && <p className="text-sm text-muted-foreground">All employees are already on this project.</p>}
            {availableEmployees.map((e) => (
              <div key={e.id} className={`p-3 rounded-md border cursor-pointer transition-colors ${selectedUsers.includes(e.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`} onClick={() => toggleUser(e.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{e.full_name}</span>
                    <span className="text-xs text-muted-foreground block">{e.designation}</span>
                  </div>
                  {selectedUsers.includes(e.id) && <Badge className="bg-primary text-primary-foreground">Selected</Badge>}
                </div>
                {selectedUsers.includes(e.id) && (
                  <Input className="mt-2" placeholder="Project role (e.g. Lead Developer)" value={roleInputs[e.id] || ""} onChange={(e2) => setRoleInputs({ ...roleInputs, [e.id]: e2.target.value })} onClick={(e2) => e2.stopPropagation()} />
                )}
              </div>
            ))}
          </div>
          <SheetFooter className="mt-4 pt-4 border-t shrink-0">
            <Button onClick={addMembers} disabled={selectedUsers.length === 0} className="rounded-button w-full">Add {selectedUsers.length} Member{selectedUsers.length !== 1 ? "s" : ""}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Completion Warning */}
      <AlertDialog open={completionWarning} onOpenChange={setCompletionWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this project?</AlertDialogTitle>
            <AlertDialogDescription>Setting to Completed will lock all log submissions for this project. This action can be reversed by changing the status back.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => doStatusChange(pendingStatus)}>Complete Project</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

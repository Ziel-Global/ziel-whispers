import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FolderKanban, Archive, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  on_hold: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
  archived: "bg-muted text-muted-foreground",
};

export default function ProjectsPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*, clients(name)").order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("status", "active").order("name");
      return data || [];
    },
    enabled: isAdmin,
  });

  // For employees, get their memberships
  const { data: myMemberships } = useQuery({
    queryKey: ["my-project-memberships", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("project_members").select("project_id, project_role_id, project_roles(name)").eq("user_id", user!.id).is("removed_at", null);
      return data || [];
    },
    enabled: !isAdmin && !!user?.id,
  });

  // For admin: get team sizes & hours
  const { data: projectStats } = useQuery({
    queryKey: ["project-stats"],
    queryFn: async () => {
      const [{ data: members }, { data: logs }] = await Promise.all([
        supabase.from("project_members").select("project_id").is("removed_at", null),
        supabase.from("daily_logs").select("project_id, hours").eq("status", "submitted"),
      ]);
      const teamSize: Record<string, number> = {};
      const totalHours: Record<string, number> = {};
      members?.forEach((m) => { if (m.project_id) teamSize[m.project_id] = (teamSize[m.project_id] || 0) + 1; });
      logs?.forEach((l) => { if (l.project_id) totalHours[l.project_id] = (totalHours[l.project_id] || 0) + Number(l.hours); });
      return { teamSize, totalHours };
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    if (!projects) return [];
    let list = projects;
    if (!isAdmin && myMemberships) {
      const myProjectIds = new Set(myMemberships.map((m) => m.project_id));
      list = list.filter((p) => myProjectIds.has(p.id));
    }
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (clientFilter !== "all") list = list.filter((p) => p.client_id === clientFilter);
    if (search) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [projects, search, statusFilter, clientFilter, isAdmin, myMemberships]);

  const getMemberRole = (projectId: string) => {
    const m = myMemberships?.find((m) => m.project_id === projectId);
    return (m?.project_roles as any)?.name || "Member";
  };

  const toggleArchive = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "archived" ? "active" : "archived";
    const { error } = await supabase.from("projects").update({ status: newStatus }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("audit_logs").insert({
      actor_id: profile?.id,
      action: newStatus === "archived" ? "project.archived" : "project.restored",
      target_entity: "projects",
      target_id: id,
    });
    toast.success(newStatus === "archived" ? "Project archived" : "Project restored");
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("projects").delete().eq("id", deleteId);
      if (error) throw error;
      
      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "project.deleted",
        target_entity: "projects",
        target_id: deleteId,
      });
      
      toast.success("Project deleted permanently");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Employee card view
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">My Projects</h1>
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {!isLoading && filtered.length === 0 && <p className="text-muted-foreground">You're not assigned to any projects yet.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/projects/${p.id}`)}>
              <div className="flex items-start justify-between mb-2">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                <Badge className={STATUS_COLORS[p.status] || ""}>{p.status}</Badge>
              </div>
              <h3 className="font-semibold">{p.name}</h3>
              <p className="text-sm text-muted-foreground">{(p.clients as any)?.name}</p>
              <Badge variant="outline" className="mt-2 text-xs">{getMemberRole(p.id)}</Badge>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Admin table view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <Button onClick={() => navigate("/projects/new")} className="rounded-button"><Plus className="h-4 w-4 mr-2" />New Project</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No projects found</TableCell></TableRow>}
            {filtered.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">{(p.clients as any)?.name || "—"}</TableCell>
                <TableCell><Badge className={STATUS_COLORS[p.status] || ""}>{p.status}</Badge></TableCell>
                <TableCell>{projectStats?.teamSize[p.id] || 0}</TableCell>
                <TableCell>{(projectStats?.totalHours[p.id] || 0).toFixed(1)}h</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => toggleArchive(p.id, p.status)} title={p.status === "archived" ? "Restore" : "Archive"}>
                      <Archive className={`h-4 w-4 ${p.status === "archived" ? "text-blue-600" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This will permanently remove the project and all related data from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

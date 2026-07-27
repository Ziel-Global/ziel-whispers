import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toSlug } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataRow, RowPrimary, RowSecondary, RowDataGrid, RowDataItem, RowBadgeItem, RowActions, TableHeader } from "@/components/ui/data-row";
import { Plus, Search, FolderKanban, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PROJECT_STATUS_COLORS as STATUS_COLORS } from "@/lib/workflow";

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
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", client_id: "", start_date: "", end_date: "", document_link: "", workflow_template_id: "", status: "" });

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

  const { data: templates } = useQuery({
    queryKey: ["workflow-templates-list"],
    queryFn: async () => {
      const { data } = await supabase.from("workflow_templates").select("id, name").order("name");
      return data || [];
    },
    enabled: isAdmin,
  });
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

  const openEdit = (p: any) => {
    setEditProjectId(p.id);
    setEditForm({
      name: p.name || "",
      description: p.description || "",
      client_id: p.client_id || "",
      start_date: p.start_date || "",
      end_date: p.end_date || "",
      document_link: p.document_link || "",
      workflow_template_id: p.workflow_template_id || "",
      status: p.status || "active",
    });
  };

  const handleEditSave = async () => {
    if (!editProjectId || !editForm.name.trim() || !editForm.client_id || !editForm.start_date || !editForm.workflow_template_id) {
      toast.error("Please fill in all required fields");
      return;
    }
    const { error } = await supabase.from("projects").update({
      name: editForm.name.trim(),
      description: editForm.description || null,
      client_id: editForm.client_id,
      start_date: editForm.start_date,
      end_date: editForm.end_date || null,
      document_link: editForm.document_link || null,
      workflow_template_id: editForm.workflow_template_id,
      status: editForm.status,
    }).eq("id", editProjectId);
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "project.updated", target_entity: "projects", target_id: editProjectId });
    toast.success("Project updated");
    setEditProjectId(null);
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      // Pre-check for related data (FK constraints)
      const [{ data: relatedLogs }, { data: relatedMembers }, { data: relatedRoles }] = await Promise.all([
        supabase.from("daily_logs").select("id").eq("project_id", deleteId).limit(1),
        supabase.from("project_members").select("id").eq("project_id", deleteId).limit(1),
        supabase.from("project_roles").select("id").eq("project_id", deleteId).limit(1),
      ]);
      const reasons: string[] = [];
      if (relatedLogs && relatedLogs.length > 0) reasons.push("log entries");
      if (relatedMembers && relatedMembers.length > 0) reasons.push("team members");
      if (relatedRoles && relatedRoles.length > 0) reasons.push("project roles");
      if (reasons.length > 0) {
        toast.error(`Cannot delete: ${reasons.join(" and ")} are linked to this project. Archive the project instead.`);
        setDeleting(false);
        return;
      }

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
            <Card key={p.id} className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/projects/${toSlug(p.name)}`)}>
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

      {isLoading && <Card><div className="py-12 text-center text-muted-foreground">Loading…</div></Card>}
      {!isLoading && filtered.length === 0 && <Card><div className="py-12 text-center text-muted-foreground">No projects found</div></Card>}
      {!isLoading && filtered.length > 0 && (
        <div>
          <TableHeader gridCols="1fr 96px 96px 112px 112px 80px">
            <span>PROJECT</span>
            <span>STATUS</span>
            <span>MEMBERS</span>
            <span>DEADLINE</span>
            <span>CREATED</span>
            <span className="text-right">ACTIONS</span>
          </TableHeader>
          {filtered.map((p) => (
            <DataRow
              key={p.id}
              onClick={() => navigate(`/projects/${toSlug(p.name)}`)}
              gridCols="1fr 96px 96px 112px 112px 80px"
            >
              <div>
                <RowPrimary>{p.name}</RowPrimary>
                <RowSecondary>{(p.clients as any)?.name || "—"}</RowSecondary>
              </div>
              <RowDataItem label="STATUS">
                <Badge className={STATUS_COLORS[p.status] || ""}>{p.status}</Badge>
              </RowDataItem>
              <RowDataItem label="MEMBERS">{projectStats?.teamSize[p.id] || 0}</RowDataItem>
              <RowDataItem label="DEADLINE">{p.deadline ? format(new Date(p.deadline + "T00:00:00"), "MMM d, yyyy") : "—"}</RowDataItem>
              <RowDataItem label="CREATED">{format(new Date(p.created_at), "MMM d, yyyy")}</RowDataItem>
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </DataRow>
          ))}
        </div>
      )}

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

      <Dialog open={!!editProjectId} onOpenChange={(open) => { if (!open) setEditProjectId(null); }}>
        <DialogContent className="w-[92vw] sm:w-[60vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name *</label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Client *</label>
                <Select value={editForm.client_id} onValueChange={(v) => setEditForm((f) => ({ ...f, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Workflow Template *</label>
                <Select value={editForm.workflow_template_id} onValueChange={(v) => setEditForm((f) => ({ ...f, workflow_template_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select workflow" /></SelectTrigger>
                  <SelectContent>{templates?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date *</label>
                <Input type="date" value={editForm.start_date} onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input type="date" value={editForm.end_date} onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Document Link</label>
              <Input value={editForm.document_link} onChange={(e) => setEditForm((f) => ({ ...f, document_link: e.target.value }))} placeholder="https://drive.google.com/..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditProjectId(null)}>Cancel</Button>
              <Button onClick={handleEditSave}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
      const userClientId = (profile as any)?.client_id;
      list = list.filter((p) => myProjectIds.has(p.id) || (userClientId && p.client_id === userClientId) || p.client_visible === true);
    }
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (clientFilter !== "all") list = list.filter((p) => p.client_id === clientFilter);
    if (search) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [projects, search, statusFilter, clientFilter, isAdmin, myMemberships, profile]);

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
      <div className="space-y-6 font-sans">
        <div className="flex items-center justify-between pb-1">
          <h1 className="text-[26px] font-bold tracking-[-0.5px] text-[#17171A]">My Projects</h1>
        </div>
        {isLoading && (
          <div className="bg-white border border-black/[0.08] rounded-[14px] p-12 text-center text-[#8B8B92] text-sm shadow-sm">
            Loading projects…
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="bg-white border border-black/[0.08] rounded-[14px] p-12 text-center text-[#8B8B92] text-sm shadow-sm">
            You're not assigned to any projects yet.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-black/[0.08] rounded-[14px] p-5 cursor-pointer hover:shadow-md transition-all space-y-3"
              onClick={() => navigate(`/projects/${toSlug(p.name)}`)}
            >
              <div className="flex items-start justify-between">
                <div className="w-8 h-8 rounded-[9px] bg-[#FDECE3] text-[#EB5A1E] flex items-center justify-center">
                  <FolderKanban className="h-4 w-4 text-[#EB5A1E]" />
                </div>
                <Badge
                  className={
                    p.status === "active"
                      ? "bg-[#DFF6E4] text-[#1B8A46] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize"
                      : p.status === "on_hold"
                      ? "bg-[#FDF3E3] text-[#A9720B] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize"
                      : p.status === "completed"
                      ? "bg-[#EAF3FF] text-[#1C6FC9] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize"
                      : "bg-[#F6F5F3] text-[#8B8B92] font-semibold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize"
                  }
                >
                  {p.status}
                </Badge>
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-[#17171A] truncate">{p.name}</h3>
                <p className="text-[12.5px] text-[#8B8B92] truncate mt-0.5">{(p.clients as any)?.name || "No Client"}</p>
              </div>
              <div className="pt-1">
                <span className="inline-block bg-[#F6F5F3] text-[#4B4B52] text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  {getMemberRole(p.id)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Admin table view
  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between pb-1 flex-wrap gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.5px] text-[#17171A]">Projects</h1>
        </div>
        <button
          type="button"
          onClick={() => navigate("/projects/new")}
          className="flex items-center gap-2 bg-[#EB5A1E] hover:bg-[#C64715] text-white font-semibold rounded-[10px] px-4 py-2 text-[13px] transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5 text-white" />
          New Project
        </button>
      </div>

      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="flex-1 min-w-[220px] relative flex items-center bg-white border border-black/[0.08] rounded-[10px] px-3.5 py-2 shadow-sm">
          <Search className="h-3.5 w-3.5 text-[#8B8B92] shrink-0 mr-2" />
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-0 p-0 text-[13px] text-[#17171A] placeholder:text-[#B0B0B6] focus:outline-none font-sans"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[160px] bg-white border border-black/[0.08] rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] h-[38px] shadow-sm">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="bg-white border border-black/[0.08] rounded-[14px] p-12 text-center text-[#8B8B92] text-sm shadow-sm">
          Loading projects…
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="bg-white border border-black/[0.08] rounded-[14px] p-12 text-center text-[#8B8B92] text-sm shadow-sm">
          No projects found
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden shadow-sm font-sans">
          <div className="grid grid-cols-[2fr_0.8fr_0.8fr_0.9fr_1fr_0.8fr] gap-2 px-5 py-3 border-b border-black/[0.06] text-[11px] font-bold text-[#B0B0B6] tracking-[0.05em] uppercase">
            <span>PROJECT</span>
            <span>STATUS</span>
            <span>MEMBERS</span>
            <span>DEADLINE</span>
            <span>CREATED</span>
            <span className="text-right pr-2">ACTIONS</span>
          </div>

          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${toSlug(p.name)}`)}
              className="grid grid-cols-[2fr_0.8fr_0.8fr_0.9fr_1fr_0.8fr] gap-2 items-center px-5 py-3.5 border-b border-black/[0.05] cursor-pointer hover:bg-[#F6F5F3]/50 transition-colors"
            >
              {/* PROJECT */}
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-[#17171A] truncate">{p.name}</p>
                <p className="text-[12px] text-[#8B8B92] truncate">{(p.clients as any)?.name || "—"}</p>
              </div>

              {/* STATUS */}
              <div>
                <Badge
                  className={
                    p.status === "active"
                      ? "bg-[#DFF6E4] text-[#1B8A46] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize"
                      : p.status === "on_hold"
                      ? "bg-[#FDF3E3] text-[#A9720B] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize"
                      : p.status === "completed"
                      ? "bg-[#EAF3FF] text-[#1C6FC9] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize"
                      : "bg-[#F6F5F3] text-[#8B8B92] font-semibold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize"
                  }
                >
                  {p.status}
                </Badge>
              </div>

              {/* MEMBERS */}
              <div className="text-[13.5px] font-bold text-[#4B4B52]">{projectStats?.teamSize[p.id] || 0}</div>

              {/* DEADLINE */}
              <div className="text-[13px] text-[#B0B0B6]">
                {p.deadline ? format(new Date(p.deadline + "T00:00:00"), "MMM d, yyyy") : "—"}
              </div>

              {/* CREATED */}
              <div className="text-[13px] text-[#4B4B52]">{format(new Date(p.created_at), "MMM d, yyyy")}</div>

              {/* ACTIONS */}
              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  className="w-7 h-7 rounded-[8px] bg-[#FDECE3] hover:bg-[#FCD8C8] text-[#EB5A1E] flex items-center justify-center transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5 text-[#EB5A1E]" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(p.id)}
                  className="w-7 h-7 rounded-[8px] bg-[#FDECEC] hover:bg-[#FCD8D8] text-[#E5484D] flex items-center justify-center transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5 text-[#E5484D]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="font-sans sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px] font-bold text-[#17171A]">Delete Project?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-[#8B8B92]">
              Are you sure you want to delete this project? This will permanently remove the project and all related data from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-[10px] text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[#E5484D] text-white hover:bg-red-700 font-semibold rounded-[10px] px-4 text-[13px]"
            >
              {deleting ? "Deleting…" : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Project Dialog */}
      <Dialog open={!!editProjectId} onOpenChange={(open) => { if (!open) setEditProjectId(null); }}>
        <DialogContent className="font-sans w-[92vw] sm:w-[60vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold text-[#17171A]">Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="block text-[12.5px] font-semibold text-[#4B4B52]">Project Name *</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="bg-white border border-black/10 rounded-[10px] px-3.5 py-2.5 text-[13.5px] text-[#17171A] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12.5px] font-semibold text-[#4B4B52]">Description</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="bg-white border border-black/10 rounded-[10px] px-3.5 py-2.5 text-[13.5px] text-[#17171A] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[12.5px] font-semibold text-[#4B4B52]">Client *</label>
                <Select value={editForm.client_id} onValueChange={(v) => setEditForm((f) => ({ ...f, client_id: v }))}>
                  <SelectTrigger className="w-full bg-white border border-black/10 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold text-[#4B4B52] h-[38px]">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[12.5px] font-semibold text-[#4B4B52]">Workflow Template *</label>
                <Select value={editForm.workflow_template_id} onValueChange={(v) => setEditForm((f) => ({ ...f, workflow_template_id: v }))}>
                  <SelectTrigger className="w-full bg-white border border-black/10 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold text-[#4B4B52] h-[38px]">
                    <SelectValue placeholder="Select workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[12.5px] font-semibold text-[#4B4B52]">Start Date *</label>
                <Input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
                  required
                  className="bg-white border border-black/10 rounded-[10px] px-3.5 py-2.5 text-[13.5px] text-[#17171A] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[12.5px] font-semibold text-[#4B4B52]">End Date</label>
                <Input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="bg-white border border-black/10 rounded-[10px] px-3.5 py-2.5 text-[13.5px] text-[#17171A] focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12.5px] font-semibold text-[#4B4B52]">Document Link</label>
              <Input
                value={editForm.document_link}
                onChange={(e) => setEditForm((f) => ({ ...f, document_link: e.target.value }))}
                placeholder="https://drive.google.com/..."
                className="bg-white border border-black/10 rounded-[10px] px-3.5 py-2.5 text-[13.5px] text-[#17171A] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[12.5px] font-semibold text-[#4B4B52]">Status</label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="w-full bg-white border border-black/10 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold text-[#4B4B52] h-[38px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" onClick={() => setEditProjectId(null)} className="rounded-[10px] text-[13px]">
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                className="bg-[#EB5A1E] hover:bg-[#C64715] text-white font-semibold rounded-[10px] px-4 text-[13px]"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

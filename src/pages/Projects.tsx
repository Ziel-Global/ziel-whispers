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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataRow,
  RowPrimary,
  RowSecondary,
  RowDataGrid,
  RowDataItem,
  RowBadgeItem,
  RowActions,
  TableHeader,
} from "@/components/ui/data-row";
import { Plus, Search, FolderKanban } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, name, status, start_date, end_date, client_id, description, document_link, status_note, created_at, workflow_template_id, clients(name)",
        )
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      return data || [];
    },
    enabled: isAdmin,
  });

  // For employees, get their memberships
  const { data: myMemberships } = useQuery({
    queryKey: ["my-project-memberships", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_members")
        .select("project_id, project_role_id, project_roles(name)")
        .eq("user_id", user!.id)
        .is("removed_at", null);
      return data || [];
    },
    enabled: !isAdmin && !!user?.id,
  });

  // For admin: get team sizes & hours
  const { data: projectStats } = useQuery({
    queryKey: ["project-stats"],
    queryFn: async () => {
      const [{ data: members }, { data: logs }] = await Promise.all([
        supabase
          .from("project_members")
          .select("project_id")
          .is("removed_at", null),
        supabase
          .from("daily_logs")
          .select("project_id, hours")
          .eq("status", "submitted"),
      ]);
      const teamSize: Record<string, number> = {};
      const totalHours: Record<string, number> = {};
      members?.forEach((m) => {
        if (m.project_id)
          teamSize[m.project_id] = (teamSize[m.project_id] || 0) + 1;
      });
      logs?.forEach((l) => {
        if (l.project_id)
          totalHours[l.project_id] =
            (totalHours[l.project_id] || 0) + Number(l.hours);
      });
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
      list = list.filter(
        (p) =>
          myProjectIds.has(p.id) ||
          (userClientId && p.client_id === userClientId) ||
          p.client_visible === true,
      );
    }
    if (statusFilter !== "all")
      list = list.filter((p) => p.status === statusFilter);
    if (clientFilter !== "all")
      list = list.filter((p) => p.client_id === clientFilter);
    if (search)
      list = list.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      );
    return list;
  }, [
    projects,
    search,
    statusFilter,
    clientFilter,
    isAdmin,
    myMemberships,
    profile,
  ]);

  const getMemberRole = (projectId: string) => {
    const m = myMemberships?.find((m) => m.project_id === projectId);
    return (m?.project_roles as any)?.name || "Member";
  };

  const toggleArchive = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "archived" ? "active" : "archived";
    const { error } = await supabase
      .from("projects")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("audit_logs").insert({
      actor_id: profile?.id,
      action:
        newStatus === "archived" ? "project.archived" : "project.restored",
      target_entity: "projects",
      target_id: id,
    });
    toast.success(
      newStatus === "archived" ? "Project archived" : "Project restored",
    );
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      // Pre-check for related data (FK constraints)
      const [
        { data: relatedLogs },
        { data: relatedMembers },
        { data: relatedRoles },
      ] = await Promise.all([
        supabase
          .from("daily_logs")
          .select("id")
          .eq("project_id", deleteId)
          .limit(1),
        supabase
          .from("project_members")
          .select("id")
          .eq("project_id", deleteId)
          .limit(1),
        supabase
          .from("project_roles")
          .select("id")
          .eq("project_id", deleteId)
          .limit(1),
      ]);
      const reasons: string[] = [];
      if (relatedLogs && relatedLogs.length > 0) reasons.push("log entries");
      if (relatedMembers && relatedMembers.length > 0)
        reasons.push("team members");
      if (relatedRoles && relatedRoles.length > 0)
        reasons.push("project roles");
      if (reasons.length > 0) {
        toast.error(
          `Cannot delete: ${reasons.join(" and ")} are linked to this project. Archive the project instead.`,
        );
        setDeleting(false);
        return;
      }

      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", deleteId);
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
        {!isLoading && filtered.length === 0 && (
          <p className="text-muted-foreground">
            You're not assigned to any projects yet.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card
              key={p.id}
              className="p-5 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/projects/${toSlug(p.name)}`)}
            >
              <div className="flex items-start justify-between mb-2">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                <Badge className={STATUS_COLORS[p.status] || ""}>
                  {p.status}
                </Badge>
              </div>
              <h3 className="font-semibold">{p.name}</h3>
              <p className="text-sm text-muted-foreground">
                {(p.clients as any)?.name}
              </p>
              <Badge variant="outline" className="mt-2 text-xs">
                {getMemberRole(p.id)}
              </Badge>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Admin table view
  return (
    <div className="flex flex-col gap-6">
      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-[32px] font-bold text-[#09090B] tracking-tight leading-none mb-2">
          Projects
        </h1>
        <Button
          onClick={() => navigate("/projects/new")}
          className="bg-[#EC6824] hover:bg-[#c4541a] text-white rounded-md h-10 px-4 text-[13px] font-semibold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* ── FILTER TOOLBAR ── */}
      <div className="flex items-center justify-between gap-4 w-full">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1AA]" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-full rounded-md border-[#E4E4E7] bg-white h-10 text-[13px] text-[#09090B] placeholder:text-[#A1A1AA] shadow-sm focus-visible:ring-[#EC6824] focus-visible:ring-1 focus-visible:border-[#EC6824]"
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-10 text-[13px] font-medium text-[#09090B] border-[#E4E4E7] bg-white shadow-sm rounded-md hover:border-[#EC6824] hover:bg-[#FFF4EA] focus:border-[#EC6824] focus:ring-[3px] focus:ring-[#EC6824]/20 data-[state=open]:border-[#EC6824] transition-colors">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        {/* Client filter */}
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[160px] h-10 text-[13px] font-medium text-[#09090B] border-[#E4E4E7] bg-white shadow-sm rounded-md hover:border-[#EC6824] hover:bg-[#FFF4EA] focus:border-[#EC6824] focus:ring-[3px] focus:ring-[#EC6824]/20 data-[state=open]:border-[#EC6824] transition-colors">
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

      {/* ── TABLE ── */}
      {isLoading ? (
        <div className="border border-[#E4E4E7] rounded-[16px] bg-white py-12 text-center text-[#71717A] text-[13px] shadow-sm">
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-[#E4E4E7] rounded-[16px] bg-white py-12 text-center text-[#71717A] text-[13px] shadow-sm">
          No projects found
        </div>
      ) : (
        <div className="border border-[#E4E4E7] rounded-[16px] bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
          {/* Table Header */}
          <div
            className="px-6 py-3 border-b border-[#E4E4E7] grid gap-4 items-center text-[10px] font-bold text-[#A1A1AA] tracking-wider uppercase bg-transparent"
            style={{ gridTemplateColumns: "1.8fr 100px 100px 112px 112px" }}
          >
            <span>PROJECT</span>
            <span>STATUS</span>
            <span>MEMBERS</span>
            <span>DEADLINE</span>
            <span>CREATED</span>
          </div>

          {/* Table Rows */}
          <div className="flex flex-col bg-white">
            {filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/projects/${toSlug(p.name)}`)}
                className="px-6 py-4 border-b border-[#F4F4F5] last:border-b-0 grid gap-4 items-center hover:bg-[#FFF1E6] transition-colors cursor-pointer"
                style={{ gridTemplateColumns: "1.8fr 100px 100px 112px 112px" }}
              >
                {/* Project Name */}
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-[#18181B] truncate tracking-tight">
                    {p.name}
                  </p>
                  <p className="text-[12px] text-[#71717A] truncate mt-0.5">
                    {(p.clients as any)?.name || "—"}
                  </p>
                </div>

                {/* Status */}
                <div>
                  <Badge
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border-transparent ${p.status === "active" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F4F4F5] text-[#71717A]"}`}
                  >
                    {p.status}
                  </Badge>
                </div>

                {/* Members */}
                <div className="text-[13.5px] text-[#52525B]">
                  {projectStats?.teamSize[p.id] || 0}
                </div>

                {/* Deadline */}
                <div className="text-[13.5px] text-[#52525B]">
                  {p.deadline
                    ? format(new Date(p.deadline + "T00:00:00"), "MMM d, yyyy")
                    : "—"}
                </div>

                {/* Created */}
                <div className="text-[13.5px] text-[#52525B]">
                  {format(new Date(p.created_at), "MMM d, yyyy")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This will
              permanently remove the project and all related data from the
              system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

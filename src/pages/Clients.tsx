import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataRow, RowPrimary, RowSecondary, RowDataGrid, RowDataItem, RowBadgeItem, RowActions, TableHeader, editButtonClass } from "@/components/ui/data-row";
import { Plus, Search, Archive, ArchiveRestore, Pencil, Building2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ClientForm {
  name: string;
  industry: string;
  contact_name: string;
  contact_email: string;
  location: string;
  notes: string;
}

const INDUSTRIES = [
  "Technology", "Healthcare", "Finance & Banking", "Education",
  "Retail & E-commerce", "Manufacturing", "Construction", "Real Estate",
  "Transportation & Logistics", "Media & Entertainment", "Hospitality & Tourism",
  "Energy & Utilities", "Telecommunications", "Agriculture",
  "Legal & Professional Services", "Marketing & Advertising", "Non-Profit",
  "Government", "Automotive", "Food & Beverage", "Other"
];

const emptyForm: ClientForm = { name: "", industry: "", contact_name: "", contact_email: "", location: "", notes: "" };

export default function ClientsPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [bulkDeleteClientOpen, setBulkDeleteClientOpen] = useState(false);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Get project counts per client
  const { data: projectCounts } = useQuery({
    queryKey: ["client-project-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("client_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((p) => { if (p.client_id) counts[p.client_id] = (counts[p.client_id] || 0) + 1; });
      return counts;
    },
  });

  const filtered = useMemo(() => {
    if (!clients) return [];
    return clients.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [clients, search, statusFilter]);

  const openAdd = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({ 
      name: c.name, 
      industry: c.industry || "", 
      contact_name: c.contact_name || "", 
      contact_email: c.contact_email || "", 
      location: c.contact_phone || "", // Mapping contact_phone to location
      notes: (c as any).notes || "" 
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Client name is required"); return; }
    if (!form.location.trim()) { toast.error("Location is required"); return; }
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) { toast.error("Invalid email format"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        industry: form.industry || null,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_phone: form.location.trim() || null, // Storing location in contact_phone field
        notes: form.notes || null,
      };
      if (editId) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("Client updated");
      } else {
        const { error } = await supabase.from("clients").insert({ ...payload, created_by: profile?.id });
        if (error) throw error;
        await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "client.created", target_entity: "clients" });
        toast.success("Client created");
      }
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDialogOpen(false);
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const toggleArchive = async (id: string, current: string) => {
    const newStatus = current === "archived" ? "active" : "archived";
    const { error } = await supabase.from("clients").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(newStatus === "archived" ? "Client archived" : "Client restored");
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      // Pre-check for related projects (FK constraint)
      const { data: relatedProjects } = await supabase
        .from("projects")
        .select("id")
        .eq("client_id", deleteId);
      if (relatedProjects && relatedProjects.length > 0) {
        toast.error(`Cannot delete: ${relatedProjects.length} project(s) are linked to this client. Archive the client instead.`);
        setDeleting(false);
        return;
      }

      const { error } = await supabase.from("clients").delete().eq("id", deleteId);
      if (error) throw error;
      
      await supabase.from("audit_logs").insert({ 
        actor_id: profile?.id, 
        action: "client.deleted", 
        target_entity: "clients",
        target_id: deleteId 
      });
      
      toast.success("Client deleted permanently");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-project-counts"] });
    } catch (err: any) { 
      toast.error(err.message); 
    } finally { 
      setDeleting(false); 
    }
  };

  const handleBulkDeleteClients = async () => {
    const ids = Array.from(selectedClientIds);
    if (!ids.length) return;
    setDeleting(true);
    let deleted = 0;
    let skipped = 0;
    try {
      for (const id of ids) {
        const { data: relatedProjects } = await supabase.from("projects").select("id").eq("client_id", id);
        if (relatedProjects && relatedProjects.length > 0) {
          skipped++;
          continue;
        }
        const { error } = await supabase.from("clients").delete().eq("id", id);
        if (!error) {
          await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "client.deleted", target_entity: "clients", target_id: id });
          deleted++;
        }
      }
      if (skipped > 0) toast.warning(`${skipped} client${skipped > 1 ? "s" : ""} skipped (linked to projects)`);
      if (deleted > 0) toast.success(`${deleted} client${deleted > 1 ? "s" : ""} deleted`);
      setSelectedClientIds(new Set());
      setBulkDeleteClientOpen(false);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-project-counts"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between pb-1 flex-wrap gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.5px] text-[#17171A]">Clients</h1>
          <p className="text-[13px] text-[#8B8B92] font-normal mt-0.5">Manage your clients and their contact information</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#EB5A1E] hover:bg-[#C64715] text-white font-semibold rounded-[10px] px-4 py-2 text-[13px] transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5 text-white" />
          Add Client
        </button>
      </div>

      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="flex-1 min-w-[220px] relative flex items-center bg-white border border-black/[0.08] rounded-[10px] px-3.5 py-2 shadow-sm">
          <Search className="h-3.5 w-3.5 text-[#8B8B92] shrink-0 mr-2" />
          <input
            type="text"
            placeholder="Search clients…"
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
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="bg-white border border-black/[0.08] rounded-[14px] p-12 text-center text-[#8B8B92] text-sm shadow-sm">
          Loading clients…
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="bg-white border border-black/[0.08] rounded-[14px] p-12 text-center text-[#8B8B92] text-sm shadow-sm">
          No clients found
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden shadow-sm font-sans">
          <div className="grid grid-cols-[40px_2.2fr_0.8fr_0.9fr_1fr_0.9fr] gap-2 px-5 py-3 border-b border-black/[0.06] text-[11px] font-bold text-[#B0B0B6] tracking-[0.05em] uppercase">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-[#EB5A1E]"
                checked={selectedClientIds.size === filtered.length && filtered.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedClientIds(new Set(filtered.map((c) => c.id)));
                  else setSelectedClientIds(new Set());
                }}
              />
            </div>
            <span>CLIENT</span>
            <span>PROJECTS</span>
            <span>STATUS</span>
            <span>CREATED</span>
            <span className="text-right pr-2">ACTIONS</span>
          </div>

          {selectedClientIds.size > 0 && (
            <div className="flex items-center justify-between px-5 py-2.5 bg-[#17171A] text-white">
              <span className="text-xs font-semibold">
                {selectedClientIds.size} client{selectedClientIds.size > 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedClientIds(new Set())}
                  className="px-3 py-1 text-xs font-medium text-white/80 hover:text-white border border-white/20 rounded-md bg-transparent"
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  onClick={() => setBulkDeleteClientOpen(true)}
                  className="px-3 py-1 text-xs bg-[#E5484D] text-white rounded-md hover:bg-red-700 flex items-center gap-1 font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete selected
                </button>
              </div>
            </div>
          )}

          {filtered.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[40px_2.2fr_0.8fr_0.9fr_1fr_0.9fr] gap-2 items-center px-5 py-3.5 border-b border-black/[0.05] hover:bg-[#F6F5F3]/50 transition-colors"
            >
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 accent-[#EB5A1E]"
                  checked={selectedClientIds.has(c.id)}
                  onChange={(e) => {
                    const next = new Set(selectedClientIds);
                    if (e.target.checked) next.add(c.id);
                    else next.delete(c.id);
                    setSelectedClientIds(next);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* CLIENT */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-[34px] h-[34px] rounded-[9px] bg-[#FDECE3] text-[#EB5A1E] flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-[#EB5A1E]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-[#17171A] truncate">{c.name}</p>
                  <p className="text-[12px] text-[#8B8B92] truncate">
                    {c.contact_email || "—"} · {c.contact_phone || "—"}
                  </p>
                </div>
              </div>

              {/* PROJECTS */}
              <div className="text-[13.5px] font-bold text-[#4B4B52]">{projectCounts?.[c.id] || 0}</div>

              {/* STATUS */}
              <div>
                <Badge
                  className={
                    c.status === "active"
                      ? "bg-[#DFF6E4] text-[#1B8A46] font-bold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize"
                      : "bg-[#F6F5F3] text-[#8B8B92] font-semibold text-[11.5px] px-2.5 py-0.5 rounded-full border-0 shadow-none capitalize"
                  }
                >
                  {c.status}
                </Badge>
              </div>

              {/* CREATED */}
              <div className="text-[13px] text-[#4B4B52]">{format(new Date(c.created_at), "MMM d, yyyy")}</div>

              {/* ACTIONS */}
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(c)}
                  className="w-7 h-7 rounded-[8px] bg-[#FDECE3] hover:bg-[#FCD8C8] text-[#EB5A1E] flex items-center justify-center transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5 text-[#EB5A1E]" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleArchive(c.id, c.status)}
                  className="w-7 h-7 rounded-[8px] bg-[#F6F5F3] hover:bg-[#EAE8E5] text-[#8B8B92] flex items-center justify-center transition-colors"
                  title={c.status === "archived" ? "Restore" : "Archive"}
                >
                  {c.status === "archived" ? (
                    <ArchiveRestore className="h-3.5 w-3.5 text-[#8B8B92]" />
                  ) : (
                    <Archive className="h-3.5 w-3.5 text-[#8B8B92]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(c.id)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="font-sans sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold text-[#17171A]">{editId ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-[#4B4B52]">Client Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-white border border-black/10 rounded-[10px] px-3.5 py-2.5 text-[13.5px] text-[#17171A] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-[#4B4B52]">Industry</Label>
              <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                <SelectTrigger className="w-full bg-white border border-black/10 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold text-[#4B4B52] h-[38px]">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-[#4B4B52]">Contact Name</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                className="bg-white border border-black/10 rounded-[10px] px-3.5 py-2.5 text-[13.5px] text-[#17171A] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-[#4B4B52]">Contact Email</Label>
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                className="bg-white border border-black/10 rounded-[10px] px-3.5 py-2.5 text-[13.5px] text-[#17171A] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-[#4B4B52]">Location *</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Islamabad, Pakistan"
                className="bg-white border border-black/10 rounded-[10px] px-3.5 py-2.5 text-[13.5px] text-[#17171A] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-[#4B4B52]">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="bg-white border border-black/10 rounded-[10px] px-3.5 py-2.5 text-[13.5px] text-[#17171A] focus:outline-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-[10px] text-[13px]">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#EB5A1E] hover:bg-[#C64715] text-white font-semibold rounded-[10px] px-4 text-[13px]"
            >
              {saving ? "Saving…" : editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="font-sans sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px] font-bold text-[#17171A]">Delete Client?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-[#8B8B92]">
              Are you sure you want to delete this client? This will permanently remove the client from the system. This action cannot be undone.
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

      <AlertDialog open={bulkDeleteClientOpen} onOpenChange={setBulkDeleteClientOpen}>
        <AlertDialogContent className="font-sans sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px] font-bold text-[#17171A]">
              Delete {selectedClientIds.size} Client{selectedClientIds.size > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-[#8B8B92]">
              Are you sure you want to delete {selectedClientIds.size} client{selectedClientIds.size > 1 ? "s" : ""}? Clients linked to projects will be skipped. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-[10px] text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteClients}
              disabled={deleting}
              className="bg-[#E5484D] text-white hover:bg-red-700 font-semibold rounded-[10px] px-4 text-[13px]"
            >
              {deleting ? "Deleting..." : "Delete all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


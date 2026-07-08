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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your clients and their contact information</p>
        </div>
        <Button onClick={openAdd} className="rounded-button"><Plus className="h-4 w-4 mr-2" />Add Client</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <Card><div className="py-12 text-center text-muted-foreground">Loading…</div></Card>}
      {!isLoading && filtered.length === 0 && <Card><div className="py-12 text-center text-muted-foreground">No clients found</div></Card>}
      {!isLoading && filtered.length > 0 && (
        <div>
          <TableHeader gridCols="1fr 96px 96px 112px 80px">
            <span>CLIENT</span>
            <span>PROJECTS</span>
            <span>STATUS</span>
            <span>CREATED</span>
            <span className="text-right">ACTIONS</span>
          </TableHeader>
          {filtered.map((c) => (
            <DataRow key={c.id} gridCols="1fr 96px 96px 112px 80px">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#6b7280] shrink-0" />
                  <RowPrimary>{c.name}</RowPrimary>
                </div>
                <RowSecondary>{c.contact_email || "—"} · {c.contact_phone || "—"}</RowSecondary>
              </div>
              <RowDataItem label="PROJECTS">{projectCounts?.[c.id] || 0}</RowDataItem>
              <RowDataItem label="STATUS">
                <Badge className={c.status === "active" ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                  {c.status}
                </Badge>
              </RowDataItem>
              <RowDataItem label="CREATED">{format(new Date(c.created_at), "MMM d, yyyy")}</RowDataItem>
              <RowActions className="justify-self-end">
                <button onClick={() => openEdit(c)} className={editButtonClass} title="Edit">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => toggleArchive(c.id, c.status)} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors" title={c.status === "archived" ? "Restore" : "Archive"}>
                  {c.status === "archived" ? <ArchiveRestore className="h-4 w-4 text-[#6b7280]" /> : <Archive className="h-4 w-4 text-[#6b7280]" />}
                </button>
                <button onClick={() => setDeleteId(c.id)} className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-destructive" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </RowActions>
            </DataRow>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit Client" : "Add Client"}</DialogTitle></DialogHeader>
           <div className="space-y-4">
            <div><Label>Client Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Industry</Label>
              <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Contact Name</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
            <div><Label>Contact Email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div><Label>Location *</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Islamabad, Pakistan" /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-button">{saving ? "Saving…" : editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this client? This will permanently remove the client from the system. This action cannot be undone.
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

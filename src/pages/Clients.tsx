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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Archive, ArchiveRestore, Pencil, Building2 } from "lucide-react";

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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No clients found</TableCell></TableRow>}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {c.name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.industry || "—"}</TableCell>
                <TableCell className="text-sm">{c.contact_phone || "—"}</TableCell>
                <TableCell>
                  <div className="text-sm">{c.contact_name || "—"}</div>
                  {c.contact_email && <div className="text-xs text-muted-foreground">{c.contact_email}</div>}
                </TableCell>
                <TableCell>{projectCounts?.[c.id] || 0}</TableCell>
                <TableCell>
                  <Badge className={c.status === "active" ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleArchive(c.id, c.status)}>
                      {c.status === "archived" ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

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
    </div>
  );
}

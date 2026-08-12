import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DataRow,
  RowPrimary,
  RowSecondary,
  RowDataGrid,
  RowDataItem,
  RowBadgeItem,
  RowActions,
  TableHeader,
  editButtonClass,
} from "@/components/ui/data-row";
import {
  Plus,
  Search,
  Archive,
  ArchiveRestore,
  Pencil,
  Building2,
  Trash2,
} from "lucide-react";
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

interface ClientForm {
  name: string;
  industry: string;
  contact_name: string;
  contact_email: string;
  location: string;
  notes: string;
  account_email: string;
  password: string;
}

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance & Banking",
  "Education",
  "Retail & E-commerce",
  "Manufacturing",
  "Construction",
  "Real Estate",
  "Transportation & Logistics",
  "Media & Entertainment",
  "Hospitality & Tourism",
  "Energy & Utilities",
  "Telecommunications",
  "Agriculture",
  "Legal & Professional Services",
  "Marketing & Advertising",
  "Non-Profit",
  "Government",
  "Automotive",
  "Food & Beverage",
  "Other",
];

const emptyForm: ClientForm = {
  name: "",
  industry: "",
  contact_name: "",
  contact_email: "",
  location: "",
  notes: "",
  account_email: "",
  password: "",
};

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
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Get project counts per client
  const { data: projectCounts } = useQuery({
    queryKey: ["client-project-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("client_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((p) => {
        if (p.client_id) counts[p.client_id] = (counts[p.client_id] || 0) + 1;
      });
      return counts;
    },
  });

  const filtered = useMemo(() => {
    if (!clients) return [];
    return clients.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [clients, search, statusFilter]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };
  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      industry: c.industry || "",
      contact_name: c.contact_name || "",
      contact_email: c.contact_email || "",
      location: c.contact_phone || "", // Mapping contact_phone to location
      notes: (c as any).notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Client name is required");
      return;
    }
    if (!form.location.trim()) {
      toast.error("Location is required");
      return;
    }
    if (
      form.contact_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)
    ) {
      toast.error("Invalid email format");
      return;
    }
    if (!editId) {
      if (!form.account_email.trim()) {
        toast.error("Account email is required");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.account_email)) {
        toast.error("Invalid account email format");
        return;
      }
      if (!form.password.trim()) {
        toast.error("Password is required");
        return;
      }
      if (form.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
    }
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
        const { error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", editId);
        if (error) throw error;
        toast.success("Client updated");
      } else {
        const { data: newClient, error } = await supabase
          .from("clients")
          .insert({ ...payload, created_by: profile?.id })
          .select("id")
          .single();
        if (error) throw error;

        const { data: inviteResult, error: inviteError } =
          await supabase.functions.invoke("invite-user", {
            body: {
              full_name: form.contact_name.trim() || form.name.trim(),
              email: form.account_email.trim(),
              password: form.password,
              designation: "Client",
              role: "client",
              department: "Other",
              employment_type: "contract",
              join_date: new Date().toISOString().split("T")[0],
              app_url: window.location.origin,
              client_id: newClient?.id,
            },
          });
        if (inviteError) {
          console.error("Failed to create client account:", inviteError);
          toast.warning(
            "Client created but account creation failed: " +
              (inviteError.message || "Unknown error"),
          );
        } else if (inviteResult && !inviteResult.ok) {
          console.error("invite-user returned error:", inviteResult.error);
          toast.warning(
            "Client created but account creation failed: " +
              (inviteResult.error || "Unknown error"),
          );
        } else {
          toast.success(
            "Client account created. Welcome email sent to " +
              form.account_email.trim(),
          );
        }

        await supabase.from("audit_logs").insert({
          actor_id: profile?.id,
          action: "client.created",
          target_entity: "clients",
        });
        if (!inviteError && (!inviteResult || inviteResult.ok)) {
          toast.success("Client created");
        }
      }
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (id: string, current: string) => {
    const newStatus = current === "archived" ? "active" : "archived";
    const { error } = await supabase
      .from("clients")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      newStatus === "archived" ? "Client archived" : "Client restored",
    );
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      // Unlink projects before deleting
      await supabase
        .from("projects")
        .update({ client_id: null })
        .eq("client_id", deleteId);

      // Unlink users before deleting
      await supabase
        .from("users")
        .update({ client_id: null })
        .eq("client_id", deleteId);

      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "client.deleted",
        target_entity: "clients",
        target_id: deleteId,
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
    <div className="flex flex-col gap-6">
      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-[#09090B] tracking-tight leading-none mb-2">
            Clients
          </h1>
          <p className="text-[14px] text-[#71717A]">
            Manage your clients and their contact information
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="bg-[#EC6824] hover:bg-[#c4541a] text-white rounded-md h-10 px-4 text-[13px] font-semibold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* ── FILTER TOOLBAR ── */}
      <div className="flex items-center justify-between gap-4 w-full">
        {/* Search */}
        <div className="relative w-[480px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1AA]" />
          <Input
            placeholder="Search clients..."
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
            <SelectItem value="archived">Archived</SelectItem>
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
          No clients found
        </div>
      ) : (
        <div className="border border-[#E4E4E7] rounded-[16px] bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
          {/* Table Header */}
          <div
            className="px-6 py-3 border-b border-[#E4E4E7] grid gap-4 items-center text-[10px] font-bold text-[#A1A1AA] tracking-wider uppercase bg-transparent"
            style={{ gridTemplateColumns: "1.8fr 100px 100px 140px 120px" }}
          >
            <span>CLIENT</span>
            <span>PROJECTS</span>
            <span>STATUS</span>
            <span>CREATED</span>
            <span className="text-right">ACTIONS</span>
          </div>

          {/* Table Rows */}
          <div className="flex flex-col bg-white">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="px-6 py-4 border-b border-[#F4F4F5] last:border-b-0 grid gap-4 items-center hover:bg-[#FFF1E6] transition-colors"
                style={{ gridTemplateColumns: "1.8fr 100px 100px 140px 120px" }}
              >
                {/* Client */}
                <div className="min-w-0 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-[10px] bg-[#FFF4EA] flex items-center justify-center shrink-0">
                    <Building2 className="h-[20px] w-[20px] text-[#EC6824]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[#18181B] truncate tracking-tight">
                      {c.name}
                    </p>
                    <p className="text-[12px] text-[#71717A] truncate mt-0.5">
                      {c.contact_email || "—"}{" "}
                      {c.contact_phone ? `· ${c.contact_phone}` : ""}
                    </p>
                  </div>
                </div>

                {/* Projects */}
                <div className="text-[13.5px] text-[#52525B]">
                  {projectCounts?.[c.id] || 0}
                </div>

                {/* Status */}
                <div>
                  <Badge
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border-transparent ${c.status === "active" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F4F4F5] text-[#71717A]"}`}
                  >
                    {c.status}
                  </Badge>
                </div>

                {/* Created */}
                <div className="text-[13.5px] text-[#52525B]">
                  {format(new Date(c.created_at), "MMM d, yyyy")}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => openEdit(c)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#FFF4EA] text-[#EC6824] hover:bg-[#FFEDD5] transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-[15px] w-[15px]" />
                  </button>
                  <button
                    onClick={() => toggleArchive(c.id, c.status)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#FFF4EA] text-[#EC6824] hover:bg-[#FFEDD5] transition-colors"
                    title={c.status === "archived" ? "Restore" : "Archive"}
                  >
                    {c.status === "archived" ? (
                      <ArchiveRestore className="h-[15px] w-[15px]" />
                    ) : (
                      <Archive className="h-[15px] w-[15px]" />
                    )}
                  </button>
                  <button
                    onClick={() => setDeleteId(c.id)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#FEE2E2] text-red-600 hover:bg-[#FECACA] transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-[15px] w-[15px]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Client Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Industry</Label>
              <Select
                value={form.industry}
                onValueChange={(v) => setForm({ ...form, industry: v })}
              >
                <SelectTrigger>
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
            <div>
              <Label>Contact Name</Label>
              <Input
                value={form.contact_name}
                onChange={(e) =>
                  setForm({ ...form, contact_name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) =>
                  setForm({ ...form, contact_email: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Location *</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Islamabad, Pakistan"
              />
            </div>
            {!editId && (
              <>
                <div className="pt-2 border-t">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Account Credentials
                  </Label>
                </div>
                <div>
                  <Label>Account Email *</Label>
                  <Input
                    type="email"
                    value={form.account_email}
                    onChange={(e) =>
                      setForm({ ...form, account_email: e.target.value })
                    }
                    placeholder="Login email for the client"
                  />
                </div>
                <div>
                  <Label>Password *</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder="One-time password (min 6 characters)"
                  />
                </div>
              </>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-button"
            >
              {saving ? "Saving…" : editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this client? This will permanently
              remove the client from the system. This action cannot be undone.
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

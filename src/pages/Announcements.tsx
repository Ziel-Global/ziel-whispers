import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "Other"];

interface AnnouncementForm {
  title: string;
  body: string;
  priority: string;
  audience: string;
  publish_at: string;
}

const emptyForm: AnnouncementForm = { title: "", body: "", priority: "normal", audience: "all", publish_at: "" };

export default function AnnouncementsPage() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements", page],
    queryFn: async () => {
      let q = supabase.from("announcements").select("*, announcement_reads(read_at, dismissed, user_id)").order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // For employees: filter to relevant announcements
  const visibleAnnouncements = announcements?.filter((a) => {
    if (isAdmin) return true;
    const now = new Date();
    if (new Date(a.publish_at) > now) return false;
    if (a.audience !== "all" && a.audience !== profile?.department) return false;
    return true;
  }) || [];

  const isRead = (a: any) => {
    const reads = a.announcement_reads as any[];
    return reads?.some((r: any) => r.user_id === user?.id);
  };

  const markAsRead = async (announcementId: string) => {
    if (isAdmin) return;
    const alreadyRead = visibleAnnouncements.find((a) => a.id === announcementId);
    if (alreadyRead && isRead(alreadyRead)) return;
    await supabase.from("announcement_reads").insert({ announcement_id: announcementId, user_id: user!.id });
    queryClient.invalidateQueries({ queryKey: ["announcements"] });
    queryClient.invalidateQueries({ queryKey: ["unread-announcements"] });
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (a: any) => {
    setEditId(a.id);
    setForm({ title: a.title, body: a.body, priority: a.priority, audience: a.audience, publish_at: a.publish_at ? format(new Date(a.publish_at), "yyyy-MM-dd'T'HH:mm") : "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (form.body.length < 10) { toast.error("Body must be at least 10 characters"); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body,
        priority: form.priority,
        audience: form.audience,
        publish_at: form.publish_at || new Date().toISOString(),
      };
      if (editId) {
        const { error } = await supabase.from("announcements").update(payload).eq("id", editId);
        if (error) throw error;
        await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "announcement.updated", target_entity: "announcements", target_id: editId });
        toast.success("Announcement updated");
      } else {
        const { data: inserted, error } = await supabase.from("announcements").insert({ ...payload, created_by: user!.id }).select("id").single();
        if (error) throw error;
        await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "announcement.created", target_entity: "announcements", target_id: inserted.id });
        toast.success("Announcement published");
      }
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["unread-announcements"] });
      setDialogOpen(false);
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("announcements").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_logs").insert({ actor_id: profile?.id, action: "announcement.deleted", target_entity: "announcements", target_id: deleteId });
    toast.success("Announcement deleted");
    setDeleteId(null);
    queryClient.invalidateQueries({ queryKey: ["announcements"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="text-muted-foreground mt-1">{isAdmin ? "Create and manage company announcements" : "Stay updated with company news"}</p>
        </div>
        {isAdmin && <Button onClick={openAdd} className="rounded-button"><Plus className="h-4 w-4 mr-2" />New Announcement</Button>}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      <div className="space-y-3">
        {visibleAnnouncements.map((a) => {
          const read = isRead(a);
          return (
            <Card
              key={a.id}
              className={`p-5 cursor-pointer transition-colors ${!read && !isAdmin ? "border-l-4 border-l-primary" : ""}`}
              onClick={() => markAsRead(a.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {a.priority === "urgent" && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
                    <h3 className={`font-semibold ${!read && !isAdmin ? "text-foreground" : "text-foreground/80"}`}>{a.title}</h3>
                    {a.priority === "urgent" && <Badge variant="destructive" className="text-xs">Urgent</Badge>}
                    {a.audience !== "all" && <Badge variant="outline" className="text-xs">{a.audience}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{a.body.replace(/<[^>]*>/g, "")}</p>
                  <p className="text-xs text-muted-foreground mt-2">{formatDistanceToNow(new Date(a.publish_at), { addSuffix: true })}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(a); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteId(a.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
        {!isLoading && visibleAnnouncements.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No announcements yet</p>
        )}
      </div>

      {announcements && announcements.length === PAGE_SIZE && (
        <div className="flex justify-center gap-2">
          {page > 0 && <Button variant="outline" size="sm" onClick={() => setPage(page - 1)}>Previous</Button>}
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)}>Load More</Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "Edit Announcement" : "New Announcement"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title * <span className="text-xs text-muted-foreground">({form.title.length}/120)</span></Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 120) })} />
            </div>
            <div>
              <Label>Body * <span className="text-xs text-muted-foreground">({form.body.length} chars, min 10)</span></Label>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Audience</Label>
                <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Publish Date (leave blank for now)</Label>
              <Input type="datetime-local" value={form.publish_at} onChange={(e) => setForm({ ...form, publish_at: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-button">{saving ? "Saving…" : editId ? "Update" : "Publish"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Announcement?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

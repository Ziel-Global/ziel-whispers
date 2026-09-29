import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const DEPARTMENTS = ["Engineering", "Design", "HR", "Marketing", "Operations", "Finance", "SQA", "Management", "Sales", "Other"];

const PILL_FILTERS = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "hr", label: "HR" },
] as const;

interface AnnouncementForm {
  title: string;
  body: string;
  priority: string;
  audience: string;
  publish_at: string;
}

const emptyForm: AnnouncementForm = { title: "", body: "", priority: "normal", audience: "all", publish_at: "" };

function audienceLabel(audience: string) {
  return audience === "all" ? "Company-wide" : audience;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "");
}

export default function AnnouncementsPage() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin" || profile?.role === "manager";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedAnnouncementIds, setSelectedAnnouncementIds] = useState<Set<string>>(new Set());
  const [bulkDeleteAnnouncementOpen, setBulkDeleteAnnouncementOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pillFilter, setPillFilter] = useState<(typeof PILL_FILTERS)[number]["value"]>("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const PAGE_SIZE = 20;

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["announcements", page],
    queryFn: async () => {
      const q = supabase
        .from("announcements")
        .select("*, announcement_reads(read_at, dismissed, user_id)")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: activeUsers } = useQuery({
    queryKey: ["announcements-active-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, department")
        .eq("status", "active")
        .neq("role", "admin");
      return data || [];
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    if (!announcements || !user?.id) return;
    const markAllRead = async () => {
      const unread = announcements.filter((a) => {
        const reads = a.announcement_reads as any[];
        return !reads?.some((r: any) => r.user_id === user.id);
      });
      if (unread.length === 0) return;
      const inserts = unread.map((a) => ({ announcement_id: a.id, user_id: user.id }));
      await supabase.from("announcement_reads").insert(inserts);
      queryClient.invalidateQueries({ queryKey: ["unread-announcements"] });
    };
    markAllRead();
  }, [announcements, user?.id, queryClient]);

  const now = useMemo(() => new Date(), [announcements]);

  const audienceSizeFor = (audience: string) => {
    if (!activeUsers?.length) return 0;
    if (audience === "all") return activeUsers.length;
    return activeUsers.filter((u) => (u.department || "Other") === audience).length;
  };

  const readPctFor = (a: any) => {
    const size = audienceSizeFor(a.audience);
    if (size === 0) return 0;
    const readers = new Set((a.announcement_reads as any[] | undefined)?.map((r) => r.user_id).filter(Boolean));
    return Math.round((readers.size / size) * 100);
  };

  const roleVisible = useMemo(() => {
    if (!announcements) return [];
    return announcements.filter((a) => {
      if (isAdmin) return true;
      if (new Date(a.publish_at) > now) return false;
      if (a.audience !== "all" && a.audience !== profile?.department) return false;
      return true;
    });
  }, [announcements, isAdmin, now, profile?.department]);

  const filteredAnnouncements = useMemo(() => {
    return roleVisible.filter((a) => {
      if (pillFilter === "urgent" && a.priority !== "urgent") return false;
      if (pillFilter === "hr" && a.audience !== "HR") return false;
      if (audienceFilter !== "all" && a.audience !== audienceFilter) return false;
      const published = new Date(a.publish_at) <= now;
      if (statusFilter === "published" && !published) return false;
      if (statusFilter === "scheduled" && published) return false;
      return true;
    });
  }, [roleVisible, pillFilter, audienceFilter, statusFilter, now]);

  const kpis = useMemo(() => {
    const list = announcements || [];
    const published = list.filter((a) => new Date(a.publish_at) <= now).length;
    const urgent = list.filter((a) => a.priority === "urgent").length;
    const audienceCount = activeUsers?.length || 0;
    const publishedList = list.filter((a) => new Date(a.publish_at) <= now);
    let readRate = 0;
    if (publishedList.length > 0 && audienceCount > 0) {
      const rates = publishedList.map((a) => readPctFor(a));
      readRate = Math.round(rates.reduce((s, r) => s + r, 0) / rates.length);
    }
    return { published, urgent, audienceCount, readRate };
  }, [announcements, activeUsers, now]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };
  const openEdit = (a: any) => {
    setEditId(a.id);
    setForm({
      title: a.title,
      body: a.body,
      priority: a.priority,
      audience: a.audience,
      publish_at: a.publish_at ? format(new Date(a.publish_at), "yyyy-MM-dd'T'HH:mm") : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (form.body.length < 10) {
      toast.error("Body must be at least 10 characters");
      return;
    }
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
        await supabase.from("audit_logs").insert({
          actor_id: profile?.id,
          action: "announcement.updated",
          target_entity: "announcements",
          target_id: editId,
        });
        toast.success("Announcement updated");
      } else {
        const { data: inserted, error } = await supabase
          .from("announcements")
          .insert({ ...payload, created_by: user!.id })
          .select("id")
          .single();
        if (error) throw error;
        await supabase.from("audit_logs").insert({
          actor_id: profile?.id,
          action: "announcement.created",
          target_entity: "announcements",
          target_id: inserted.id,
        });
        toast.success("Announcement published");
      }
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["unread-announcements"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("announcements").delete().eq("id", deleteId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("audit_logs").insert({
      actor_id: profile?.id,
      action: "announcement.deleted",
      target_entity: "announcements",
      target_id: deleteId,
    });
    toast.success("Announcement deleted");
    setDeleteId(null);
    queryClient.invalidateQueries({ queryKey: ["announcements"] });
  };

  const handleBulkDeleteAnnouncements = async () => {
    const ids = Array.from(selectedAnnouncementIds);
    if (!ids.length) return;
    const { error } = await supabase.from("announcements").delete().in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    for (const id of ids) {
      await supabase.from("audit_logs").insert({
        actor_id: profile?.id,
        action: "announcement.deleted",
        target_entity: "announcements",
        target_id: id,
      });
    }
    toast.success(`${ids.length} announcement${ids.length > 1 ? "s" : ""} deleted`);
    setSelectedAnnouncementIds(new Set());
    setBulkDeleteAnnouncementOpen(false);
    queryClient.invalidateQueries({ queryKey: ["announcements"] });
  };

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedAnnouncementIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedAnnouncementIds(next);
  };

  return (
    <div className="space-y-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.55px] leading-[1.15] text-[#17171A]">Announcements</h1>
          <p className="text-[12px] text-[#8B8B92] mt-[5px] leading-relaxed">
            {isAdmin
              ? "Create, target and manage company-wide communications"
              : "Stay updated with company news"}
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={openAdd}
            className="h-9 rounded-[10px] bg-[#EB5A1E] hover:bg-[#C64715] text-white hover:text-white text-[12px] font-semibold shadow-sm [&_svg]:!text-white [&_svg]:!stroke-white"
          >
            <Plus className="h-4 w-4 mr-1.5 text-white" stroke="currentColor" />
            New Announcement
          </Button>
        )}
      </div>

      {/* KPIs — admin */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {[
            { label: "Published", value: String(kpis.published), sub: "Currently visible announcements" },
            { label: "Urgent", value: String(kpis.urgent), sub: "High-priority communications" },
            { label: "Audience", value: String(kpis.audienceCount), sub: "Active users can receive notices" },
            { label: "Read Rate", value: `${kpis.readRate}%`, sub: "Across recent announcements" },
          ].map((k) => (
            <div key={k.label} className="bg-white border border-black/[0.075] rounded-xl p-3.5 min-w-0">
              <div className="text-[10px] font-semibold text-[#8B8B92] tracking-wide uppercase">{k.label}</div>
              <div className="text-[22px] font-bold tracking-[-0.4px] text-[#17171A] leading-none mt-2">{k.value}</div>
              <div className="text-[10px] text-[#96969D] mt-1.5 leading-snug">{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar — admin */}
      {isAdmin && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex h-auto gap-1 bg-[#F6F5F3] border border-black/[0.06] rounded-[11px] p-[5px]">
            {PILL_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setPillFilter(f.value)}
                className={cn(
                  "h-[34px] px-3.5 rounded-lg text-[11.5px] font-medium whitespace-nowrap shrink-0 shadow-none transition-colors",
                  pillFilter === f.value
                    ? "bg-[#17171A] text-white font-bold"
                    : "bg-transparent text-[#7D7D84] hover:text-[#3F3F45]"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2.5">
            <div>
              <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Audience</div>
              <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                <SelectTrigger className="h-9 w-[180px] min-w-[180px] text-[12px]">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Status</div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[160px] min-w-[160px] text-[12px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {selectedAnnouncementIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#EAF3FF] border border-[#C5DBF5] rounded-[11px]">
          <span className="text-[12px] text-[#1C6FC9] font-medium">
            {selectedAnnouncementIds.size} announcement{selectedAnnouncementIds.size > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedAnnouncementIds(new Set())}
              className="h-8 px-3 text-[11px] text-[#55555C] border border-black/[0.08] rounded-lg bg-white hover:bg-[#F6F5F3]"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={() => setBulkDeleteAnnouncementOpen(true)}
              className="h-8 px-3 text-[11px] bg-[#C23A3A] text-white rounded-lg hover:bg-[#A83030] flex items-center gap-1 font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-[12px] text-[#8B8B92] py-6 text-center">Loading…</p>}

      {/* Cards */}
      <div className="space-y-2.5">
        {filteredAnnouncements.map((a) => {
          const pct = isAdmin ? readPctFor(a) : null;
          const isScheduled = new Date(a.publish_at) > now;
          return (
            <div
              key={a.id}
              className={cn(
                "bg-white border border-black/[0.075] rounded-[13px] p-[15px] grid gap-3 items-start",
                isAdmin ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-1",
                selectedAnnouncementIds.has(a.id) && "ring-2 ring-[#4C8DF5]/40"
              )}
            >
              {isAdmin && (
                <input
                  type="checkbox"
                  className="h-4 w-4 mt-[3px] rounded border-[#CFCFD5] shrink-0"
                  checked={selectedAnnouncementIds.has(a.id)}
                  onChange={(e) => toggleSelect(a.id, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-[7px] flex-wrap">
                  <div className="text-[12.5px] font-bold text-[#2C2C31]">{a.title}</div>
                  <span
                    className={cn(
                      "inline-flex items-center justify-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold whitespace-nowrap",
                      a.priority === "urgent"
                        ? "bg-[#FDECEC] text-[#C23A3A]"
                        : "bg-[#F1F1F3] text-[#66666D]"
                    )}
                  >
                    {a.priority === "urgent" ? "Urgent" : "Normal"}
                  </span>
                  <span className="inline-flex items-center justify-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold whitespace-nowrap bg-[#EAF3FF] text-[#1C6FC9]">
                    {audienceLabel(a.audience)}
                  </span>
                  {isScheduled && isAdmin && (
                    <span className="inline-flex items-center justify-center min-h-[22px] px-2 rounded-full text-[8.5px] font-bold whitespace-nowrap bg-[#FDF3E3] text-[#A9720B]">
                      Scheduled
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] text-[#77777E] mt-1 leading-normal line-clamp-2 whitespace-pre-wrap">
                  {stripHtml(a.body)}
                </div>
                <div className="flex items-center gap-[9px] mt-[7px] text-[8.5px] text-[#9A9AA0] flex-wrap">
                  <span>{formatDistanceToNow(new Date(a.publish_at), { addSuffix: true })}</span>
                  <span>•</span>
                  <span>{audienceLabel(a.audience)}</span>
                  {pct !== null && (
                    <>
                      <span>•</span>
                      <span>{pct}% read</span>
                    </>
                  )}
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(a)}
                    className="w-[31px] h-[31px] border border-black/[0.08] bg-white rounded-lg flex items-center justify-center text-[#66666D] hover:bg-[#F6F5F3]"
                    title="Edit"
                  >
                    <Pencil className="h-[13px] w-[13px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(a.id)}
                    className="w-[31px] h-[31px] border border-black/[0.08] bg-white rounded-lg flex items-center justify-center text-[#C23A3A] hover:bg-[#FDECEC]"
                    title="Delete"
                  >
                    <Trash2 className="h-[13px] w-[13px]" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!isLoading && filteredAnnouncements.length === 0 && (
          <p className="text-center text-[12px] text-[#8B8B92] py-10">No announcements match the current filters</p>
        )}
      </div>

      {announcements && announcements.length === PAGE_SIZE && (
        <div className="flex justify-center gap-2">
          {page > 0 && (
            <Button variant="outline" size="sm" className="h-9 text-[12px]" onClick={() => setPage(page - 1)}>
              Previous
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-9 text-[12px]" onClick={() => setPage(page + 1)}>
            Load More
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] rounded-[13px] border-black/[0.075] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-black/[0.06]">
            <DialogTitle className="text-[15px] font-bold text-[#17171A]">
              {editId ? "Edit Announcement" : "New Announcement"}
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4 space-y-3.5">
            <div>
              <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">
                Title <span className="normal-case text-[#C8C8CE]">({form.title.length}/120)</span>
              </div>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 120) })}
                placeholder="Announcement title"
                className="h-9 text-[12px]"
              />
            </div>
            <div>
              <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Message</div>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Write the announcement message"
                className="min-h-[96px] text-[12px] resize-y"
              />
              <p className="text-[9px] text-[#A0A0A7] mt-1">{form.body.length} chars (min 10)</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Priority</div>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="h-9 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">Audience</div>
                <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                  <SelectTrigger className="h-9 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">
                  Publish Date
                </div>
                <Input
                  type="datetime-local"
                  value={form.publish_at}
                  onChange={(e) => setForm({ ...form, publish_at: e.target.value })}
                  className="h-9 text-[12px]"
                />
                <p className="text-[9px] text-[#A0A0A7] mt-1">Leave blank to publish immediately</p>
              </div>
            </div>
          </div>
          <DialogFooter className="px-5 py-3.5 border-t border-black/[0.06] sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-9 text-[12px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-9 text-[12px] rounded-[10px] bg-[#EB5A1E] hover:bg-[#C64715] text-white"
            >
              {saving ? "Saving…" : editId ? "Update" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteAnnouncementOpen} onOpenChange={setBulkDeleteAnnouncementOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedAnnouncementIds.size} Announcement
              {selectedAnnouncementIds.size > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedAnnouncementIds.size} announcement
              {selectedAnnouncementIds.size > 1 ? "s" : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteAnnouncements}
              className="bg-destructive text-destructive-foreground"
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

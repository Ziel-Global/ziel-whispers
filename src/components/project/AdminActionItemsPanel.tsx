import type { ReactNode } from "react";
import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, ChevronDown, ChevronRight, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAvatarUrl, truncateWords } from "@/lib/utils";
import {
  avatarStyleFor,
  initialsFromName,
} from "@/components/project/AdminWorkFilters";

type Props = {
  id: string;
  actionItems: any[];
  tasks: any[];
  profile: any;
  queryClient: any;
  expandedActionItemId: string | null;
  setExpandedActionItemId: (id: string | null) => void;
  actionItemMessages: any[];
  setAddTaskOpen: (b: boolean) => void;
  setTaskTitle: (s: string) => void;
  completeActionItem: (itemId: string) => Promise<void>;
  sendActionItemMessage: (actionItemId: string) => Promise<void>;
  newActionItemMessage: string;
  setNewActionItemMessage: (s: string) => void;
  renderMessageContent: (content: string) => ReactNode;
};

function statusPill(a: any) {
  if (a.status === "completed") return { label: "Converted", bg: "#DFF6E4", color: "#1B8A46" };
  if (!a.assigned_to) return { label: "Unassigned", bg: "#FDF3E3", color: "#A9720B" };
  if (a.status === "waived") return { label: "Waived", bg: "#F6F5F3", color: "#8B8B92" };
  return { label: "Open", bg: "#E6E9FF", color: "#4C57D9" };
}

function sourceLabel(a: any, tasks: any[]) {
  if (a.blockers?.description) return a.blockers.description;
  const linked = (tasks || []).find((t: any) => t.id === a.blockers?.task_id);
  if (linked?.title) return `Task · ${linked.title}`;
  if (a.requested_by_user?.full_name) return `Request · ${a.requested_by_user.full_name}`;
  return "Client request";
}

export function AdminActionItemsPanel({
  id,
  actionItems,
  tasks,
  profile,
  queryClient,
  expandedActionItemId,
  setExpandedActionItemId,
  actionItemMessages,
  setAddTaskOpen,
  setTaskTitle,
  completeActionItem,
  sendActionItemMessage,
  newActionItemMessage,
  setNewActionItemMessage,
  renderMessageContent,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const items = actionItems || [];

  const createItem = async () => {
    if (!createTitle.trim() || !profile || !id) return;
    setCreating(true);
    const { error } = await supabase.from("client_action_items").insert({
      project_id: id,
      title: createTitle.trim(),
      status: "pending",
      priority: "medium",
      requested_by: profile.id,
      visible_to_client: true,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Action item created");
    setCreateTitle("");
    setShowCreate(false);
    queryClient.invalidateQueries({ queryKey: ["project-action-items", id] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-[18px] font-bold text-[#17171A]">Action Items</div>
          <div className="text-[12.5px] text-[#8B8B92] mt-[3px]">
            Commitments and follow-ups from meetings, reviews, and client requests
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-[7px] bg-[#EB5A1E] text-white font-semibold text-[13px] px-4 py-[9px] rounded-[10px] hover:bg-[#d64f18] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
          Add Action Item
        </button>
      </div>

      {showCreate && (
        <div className="bg-white border border-black/[0.08] rounded-[14px] p-4 mb-4 flex gap-2 items-start flex-wrap">
          <Input
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            placeholder="Action item title..."
            className="flex-1 min-w-[200px] rounded-[10px] border-black/10"
          />
          <Button
            onClick={createItem}
            disabled={!createTitle.trim() || creating}
            className="bg-[#EB5A1E] hover:bg-[#d64f18] text-white rounded-[10px]"
          >
            Save
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-white border border-black/[0.08] rounded-[14px]">
          <CheckCircle2 className="h-10 w-10 text-[#D0D0D4] mb-2" />
          <p className="text-[13px] text-[#8B8B92]">No action items for this project.</p>
        </div>
      ) : (
        <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden">
          <div
            className="grid gap-3 px-[22px] py-[13px] text-[11px] font-bold text-[#B0B0B6] tracking-[0.05em] border-b border-black/[0.06]"
            style={{ gridTemplateColumns: "2fr .8fr .8fr 1.2fr .9fr .9fr" }}
          >
            <div>DESCRIPTION</div>
            <div>OWNER</div>
            <div>DUE DATE</div>
            <div>SOURCE</div>
            <div>STATUS</div>
            <div className="text-right">ACTION</div>
          </div>
          {items.map((a: any) => {
            const isExpanded = expandedActionItemId === a.id;
            const owner = a.assigned_to_user?.full_name as string | undefined;
            const av = owner ? avatarStyleFor(owner) : null;
            const st = statusPill(a);
            const source = sourceLabel(a, tasks);

            return (
              <div key={a.id}>
                <div
                  className="grid gap-3 items-center px-[22px] py-3.5 border-b border-black/[0.05]"
                  style={{ gridTemplateColumns: "2fr .8fr .8fr 1.2fr .9fr .9fr" }}
                >
                  <button
                    type="button"
                    className="text-left min-w-0 flex items-center gap-2"
                    onClick={() => setExpandedActionItemId(isExpanded ? null : a.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-[#8B8B92] shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#8B8B92] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-[#17171A] truncate">
                        {a.title}
                      </div>
                      {a.description && (
                        <div className="text-[12px] text-[#8B8B92] truncate">
                          {truncateWords(a.description, 8)}
                        </div>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-2 min-w-0">
                    {owner && av ? (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0"
                        style={{ background: av.bg, color: av.color }}
                        title={owner}
                      >
                        {initialsFromName(owner)}
                      </div>
                    ) : (
                      <span className="text-[#B0B0B6] text-[12.5px]">—</span>
                    )}
                  </div>
                  <div className="text-[13px] text-[#4B4B52]">
                    {a.due_date ? format(new Date(a.due_date + "T00:00:00"), "MMM d") : "—"}
                  </div>
                  <div className="text-[12.5px] text-[#8B8B92] truncate" title={source}>
                    {source}
                  </div>
                  <div>
                    <span
                      className="inline-block text-[11px] font-bold px-[9px] py-[3px] rounded-full"
                      style={{ background: st.bg, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <div className="flex justify-end items-center gap-2">
                    {a.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => completeActionItem(a.id)}
                        className="text-[12px] font-semibold text-[#1B8A46] whitespace-nowrap"
                        title="Mark complete"
                      >
                        Resolve
                      </button>
                    )}
                    {a.status !== "completed" && (
                      <button
                        type="button"
                        onClick={() => {
                          setTaskTitle(a.title || "");
                          setAddTaskOpen(true);
                        }}
                        className="text-xs font-bold text-[#EB5A1E] whitespace-nowrap"
                      >
                        Convert to Task
                      </button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="bg-[#F9F9F8] border-b border-black/[0.05] px-[22px] py-4 space-y-3 ml-0">
                    {a.description && (
                      <p className="text-sm text-[#4B4B52] m-0">{a.description}</p>
                    )}
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {actionItemMessages.length === 0 ? (
                        <p className="text-xs text-[#8B8B92]">No messages yet.</p>
                      ) : (
                        actionItemMessages.map((m: any) => (
                          <div
                            key={m.id}
                            className="flex gap-2 bg-white rounded-[10px] p-2.5 border border-black/[0.06]"
                          >
                            <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                              <AvatarImage src={getAvatarUrl(m.sender?.full_name)} />
                              <AvatarFallback className="text-[10px]">
                                {m.sender?.full_name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">
                                  {m.sender?.full_name || "Unknown"}
                                </span>
                                <Badge className="text-[9px] bg-blue-100 text-blue-800">
                                  {m.sender?.role || "member"}
                                </Badge>
                                <span className="text-[10px] text-[#8B8B92]">
                                  {format(new Date(m.created_at), "MMM d, h:mm a")}
                                </span>
                              </div>
                              <p className="text-sm mt-0.5 whitespace-pre-wrap break-words m-0">
                                {renderMessageContent(m.content)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {a.status === "pending" && (
                      <div className="flex gap-2">
                        <Textarea
                          value={newActionItemMessage}
                          onChange={(e) => setNewActionItemMessage(e.target.value)}
                          placeholder="Type a reply..."
                          className="min-h-[60px] text-sm rounded-[10px]"
                        />
                        <Button
                          size="sm"
                          className="bg-[#EB5A1E] hover:bg-[#d64f18] text-white rounded-[10px] shrink-0"
                          disabled={!newActionItemMessage.trim()}
                          onClick={() => sendActionItemMessage(a.id)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

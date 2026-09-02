import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DataRow, RowPrimary, RowSecondary, RowDataItem, RowBadgeItem, TableHeader, editButtonClass } from "@/components/ui/data-row";
import { ChevronDown, ChevronRight, CheckCircle2, Send } from "lucide-react";
import { getAvatarUrl, truncateWords } from "@/lib/utils";

interface ProjectActionItemsTabProps {
  id: string;
  actionItems: any[];
  tasks: any[];
  profile: any;
  isAdmin: boolean;
  isClient: boolean;
  queryClient: any;
  expandedActionItemId: string | null;
  setExpandedActionItemId: (id: string | null) => void;
  actionItemMessages: any[];
  PRIORITY_COLORS: Record<string, string>;
  project?: any;
}

export function ProjectActionItemsTab({
  id,
  actionItems,
  tasks,
  profile,
  isAdmin,
  isClient,
  queryClient,
  expandedActionItemId,
  setExpandedActionItemId,
  actionItemMessages,
  PRIORITY_COLORS,
}: ProjectActionItemsTabProps) {
  const [actionItemSubTab, setActionItemSubTab] = useState<"all" | "blockers" | "dependencies">("all");
  const [newActionItemMessage, setNewActionItemMessage] = useState("");

  const renderMessageContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    return parts.map((part, i) =>
      urlRegex.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 break-all">
          {part}
        </a>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const sendActionItemMessage = async (actionItemId: string) => {
    if (!newActionItemMessage.trim() || !profile) return;
    const { error } = await supabase.from("client_action_item_messages").insert({
      action_item_id: actionItemId,
      sender_id: profile.id,
      content: newActionItemMessage.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewActionItemMessage("");
    queryClient.invalidateQueries({ queryKey: ["action-item-messages", actionItemId] });
  };

  const completeActionItem = async (itemId: string) => {
    if (!id || !profile) return;

    const { data: completedItem } = await supabase
      .from("client_action_items")
      .select("title, blocker_id, requested_by, assigned_to")
      .eq("id", itemId)
      .single();

    const { error } = await supabase
      .from("client_action_items")
      .update({ status: "completed", completed_at: new Date().toISOString(), resolved_by: profile.id })
      .eq("id", itemId)
      .eq("project_id", id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Action item completed");

    if (completedItem?.blocker_id) {
      const { error: rpcErr } = await supabase.rpc("resolve_blocker_cascade", {
        p_blocker_id: completedItem.blocker_id,
        p_resolved_by: profile.id,
      });

      if (rpcErr) {
        await supabase
          .from("task_blockers")
          .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: profile.id })
          .eq("id", completedItem.blocker_id);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["project-action-items", id] });
    queryClient.invalidateQueries({ queryKey: ["project-blockers-all", id] });
    queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
  };

  // Filter items according to role and subtab
  const relevantItems = actionItems.filter((a: any) => {
    if (isClient) {
      if (a.visible_to_client === false) return false;
      if (a.assigned_to) return a.assigned_to === profile?.id;
      return true;
    }
    if (!isAdmin) {
      return a.assigned_to === profile?.id || a.requested_by === profile?.id;
    }
    return true;
  });

  const blockerItems = relevantItems.filter((a: any) => !!a.blocker_id);
  const dependencyItems = relevantItems.filter((a: any) => !a.blocker_id);

  const activeTabItems =
    actionItemSubTab === "blockers" ? blockerItems : actionItemSubTab === "dependencies" ? dependencyItems : relevantItems;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Action Items</h3>
      </div>

      {relevantItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No action items found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Sub-tabs header */}
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <button
              type="button"
              onClick={() => setActionItemSubTab("blockers")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${
                actionItemSubTab === "blockers"
                  ? "bg-rose-50 text-rose-700 border border-rose-200 shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              ⚠️ Task Blockers
              <Badge className={actionItemSubTab === "blockers" ? "bg-rose-600 text-white hover:bg-rose-600" : "bg-gray-200 text-gray-700"}>
                {blockerItems.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setActionItemSubTab("dependencies")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${
                actionItemSubTab === "dependencies"
                  ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              🔗 Task Dependencies
              <Badge className={actionItemSubTab === "dependencies" ? "bg-blue-600 text-white hover:bg-blue-600" : "bg-gray-200 text-gray-700"}>
                {dependencyItems.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setActionItemSubTab("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${
                actionItemSubTab === "all" ? "bg-gray-800 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              All Items
              <Badge className={actionItemSubTab === "all" ? "bg-gray-700 text-white hover:bg-gray-700" : "bg-gray-200 text-gray-700"}>
                {relevantItems.length}
              </Badge>
            </button>
          </div>

          {activeTabItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {actionItemSubTab === "blockers"
                ? "No active task blockers."
                : actionItemSubTab === "dependencies"
                ? "No task dependencies."
                : "No action items found."}
            </p>
          ) : (
            <div>
              <TableHeader gridCols="1fr 80px 100px 96px 96px 80px 80px 80px 100px 80px">
                <span>TITLE</span>
                <span>PRIORITY</span>
                <span>STATUS</span>
                <span>DUE DATE</span>
                <span>REQUESTED</span>
                <span>VISIBLE</span>
                <span>BLOCKER</span>
                <span>RELATED TASK</span>
                <span>ASSIGNED</span>
                <span className="text-right">ACTIONS</span>
              </TableHeader>
              {activeTabItems.map((a: any) => {
                const isExpanded = expandedActionItemId === a.id;
                const linkedTask = (tasks || []).find((t: any) => t.id === a.blockers?.task_id);
                return (
                  <div key={a.id}>
                    <DataRow gridCols="1fr 80px 100px 96px 96px 80px 80px 80px 100px 80px">
                      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpandedActionItemId(isExpanded ? null : a.id)}>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div>
                          <RowPrimary>{a.title}</RowPrimary>
                          {a.description && <RowSecondary>{truncateWords(a.description, 6)}</RowSecondary>}
                        </div>
                      </div>
                      <RowBadgeItem label="PRIORITY">
                        <Badge className={PRIORITY_COLORS[a.priority] || "bg-gray-100 text-gray-800"}>{a.priority || "medium"}</Badge>
                      </RowBadgeItem>
                      <RowBadgeItem label="STATUS">
                        <Badge
                          className={
                            a.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : a.status === "waived"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-yellow-100 text-yellow-800"
                          }
                        >
                          {a.status}
                        </Badge>
                      </RowBadgeItem>
                      <RowDataItem label="DUE DATE">{a.due_date ? format(new Date(a.due_date + "T00:00:00"), "MMM d, yyyy") : "—"}</RowDataItem>
                      <RowDataItem label="REQUESTED">{a.requested_by_user?.full_name || "—"}</RowDataItem>
                      <RowBadgeItem label="VISIBLE">
                        {a.visible_to_client ? <Badge className="bg-blue-100 text-blue-800">Client</Badge> : <span className="text-muted-foreground">—</span>}
                      </RowBadgeItem>
                      <RowBadgeItem label="BLOCKER">
                        {a.blockers ? (
                          <Badge className={a.blockers.status === "resolved" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                            {a.blockers.status === "resolved" ? "Resolved" : "Active"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </RowBadgeItem>
                      <RowDataItem label="RELATED TASK">{linkedTask?.title || "—"}</RowDataItem>
                      <RowDataItem label="ASSIGNED">{a.assigned_to_user?.full_name || "—"}</RowDataItem>
                      <div style={{ justifySelf: "end" }} className="flex items-center gap-1">
                        {a.status === "pending" && (
                          <button onClick={() => completeActionItem(a.id)} className={editButtonClass} title="Mark Resolved">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </button>
                        )}
                      </div>
                    </DataRow>
                    {isExpanded && (
                      <div className="bg-[#f9fafb] border-t border-[#e5e7eb] px-4 py-4 space-y-4 ml-6">
                        {a.description && <div className="text-sm text-muted-foreground">{a.description}</div>}
                        <div className="flex flex-wrap gap-3 text-sm">
                          {a.due_date && (
                            <span className="text-muted-foreground">
                              Due: <span className="text-foreground font-medium">{format(new Date(a.due_date + "T00:00:00"), "MMM d, yyyy")}</span>
                            </span>
                          )}
                          {a.completed_at && (
                            <span className="text-muted-foreground">
                              Completed: <span className="text-foreground font-medium">{format(new Date(a.completed_at), "MMM d, yyyy 'at' h:mm a")}</span>
                            </span>
                          )}
                        </div>
                        {a.status === "completed" && a.resolver && (
                          <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm text-green-800">
                            Resolved by {a.resolver.full_name} on {a.completed_at ? format(new Date(a.completed_at), "MMM d, yyyy 'at' h:mm a") : "—"}
                          </div>
                        )}
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {actionItemMessages.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No messages yet.</p>
                          ) : (
                            actionItemMessages.map((m: any) => (
                              <div key={m.id} className="flex gap-2 bg-white rounded-md p-2.5 border border-[#e5e7eb]">
                                <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                                  <AvatarImage src={getAvatarUrl(m.sender?.full_name)} />
                                  <AvatarFallback className="text-[10px]">{m.sender?.full_name?.charAt(0) || "?"}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold">{m.sender?.full_name || "Unknown"}</span>
                                    <Badge className="text-[9px] bg-blue-100 text-blue-800">{m.sender?.role || "member"}</Badge>
                                    <span className="text-[10px] text-muted-foreground">{format(new Date(m.created_at), "MMM d, h:mm a")}</span>
                                  </div>
                                  <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{renderMessageContent(m.content)}</p>
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
                              className="min-h-[60px] text-sm"
                            />
                            <Button
                              size="sm"
                              className="rounded-button shrink-0"
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
      )}
    </div>
  );
}

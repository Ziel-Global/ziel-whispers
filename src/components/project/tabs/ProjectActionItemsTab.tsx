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
import { PRIORITY_PILL_CLASS } from "@/lib/clientTaskBuckets";
import { AdminActionItemsPanel } from "@/components/project/AdminActionItemsPanel";

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
  setAddTaskOpen?: (b: boolean) => void;
  setTaskTitle?: (s: string) => void;
}

function initials(name: string) {
  return (
    (name || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
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
  setAddTaskOpen,
  setTaskTitle,
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
      return a.visible_to_client !== false;
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

  const clientTabs = [
    { key: "blockers" as const, label: "Task Blockers", count: blockerItems.length },
    { key: "dependencies" as const, label: "Task Dependencies", count: dependencyItems.length },
    { key: "all" as const, label: "All Items", count: relevantItems.length },
  ];
  const activeClientTabLabel = clientTabs.find((t) => t.key === actionItemSubTab)?.label || "All Items";

  const emptyCopy =
    actionItemSubTab === "blockers"
      ? "No client-visible blocker action items."
      : actionItemSubTab === "dependencies"
      ? "No client-visible dependency action items."
      : "No action items for this project.";

  if (isAdmin && !isClient && setAddTaskOpen && setTaskTitle) {
    return (
      <AdminActionItemsPanel
        id={id}
        actionItems={relevantItems}
        tasks={tasks}
        profile={profile}
        queryClient={queryClient}
        expandedActionItemId={expandedActionItemId}
        setExpandedActionItemId={setExpandedActionItemId}
        actionItemMessages={actionItemMessages}
        setAddTaskOpen={setAddTaskOpen}
        setTaskTitle={setTaskTitle}
        completeActionItem={completeActionItem}
        sendActionItemMessage={sendActionItemMessage}
        newActionItemMessage={newActionItemMessage}
        setNewActionItemMessage={setNewActionItemMessage}
        renderMessageContent={renderMessageContent}
      />
    );
  }

  if (isClient) {
    return (
      <div>
        <h3 className="client-section-title">Action Items</h3>

        <div className="flex items-center gap-[18px] border-b border-[#E5E5E8] mb-[18px]">
          {clientTabs.map((tab) => {
            const active = actionItemSubTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActionItemSubTab(tab.key)}
                className={
                  active
                    ? "h-[35px] border-none bg-[#253246] text-white font-semibold text-[9.5px] rounded-[7px] px-2.5 mb-[5px] inline-flex items-center gap-[7px] cursor-pointer"
                    : "h-[35px] border-none bg-transparent text-[#5A5A60] text-[9.5px] p-0 inline-flex items-center gap-[7px] cursor-pointer"
                }
              >
                {tab.label}
                <span
                  className={
                    active
                      ? "min-w-[22px] h-[18px] px-1.5 rounded-full bg-[#3B495F] text-white text-[8px] font-semibold inline-flex items-center justify-center"
                      : "min-w-[22px] h-[18px] px-1.5 rounded-full bg-[#EEF0F4] text-[#626874] text-[8px] font-semibold inline-flex items-center justify-center"
                  }
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="client-table-card">
          <div className="flex items-center justify-between gap-3 px-3.5 py-[11px] border-b border-[#E9E9EC] bg-[#FCFCFD]">
            <div>
              <div className="text-[10.5px] font-semibold text-[#17171A]">{activeClientTabLabel}</div>
              <div className="text-[8.5px] text-[#8F8F96] mt-0.5">Items requiring follow-up or acknowledgement</div>
            </div>
          </div>

          <div className="overflow-hidden">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr>
                  {(
                    [
                      { label: "Action item", w: "w-[22%]" },
                      { label: "Priority", w: "w-[9%]" },
                      { label: "Status", w: "w-[9%]" },
                      { label: "Due", w: "w-[9%]" },
                      { label: "Requested by", w: "w-[11%]" },
                      { label: "Visibility", w: "w-[8%]" },
                      { label: "Blocker", w: "w-[8%]" },
                      { label: "Related task", w: "w-[13%]" },
                      { label: "Assigned to", w: "w-[11%]" },
                    ] as const
                  ).map((h) => (
                    <th
                      key={h.label}
                      className={`text-left text-[#9595A0] text-[9px] font-medium tracking-[0.02em] uppercase px-2.5 py-2.5 border-b border-[#E2E2E5] bg-white ${h.w}`}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeTabItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-[38px] text-center text-[9.5px] text-[#96969D]">
                      {emptyCopy}
                    </td>
                  </tr>
                ) : (
                  activeTabItems.map((a: any) => {
                    const isExpanded = expandedActionItemId === a.id;
                    const linkedTask = (tasks || []).find((t: any) => t.id === a.blockers?.task_id);
                    const assignedName = a.assigned_to_user?.full_name;
                    const statusTone =
                      a.status === "completed"
                        ? "bg-[#E5F7EA] text-[#188344]"
                        : a.status === "waived"
                        ? "bg-[#F2F2F4] text-[#5D5D64]"
                        : "bg-[#FFF4D8] text-[#8F6811]";
                    const blockerTone =
                      !a.blockers
                        ? null
                        : a.blockers.status === "resolved"
                        ? "bg-[#E5F7EA] text-[#188344]"
                        : "bg-[#FFF4D8] text-[#8F6811]";

                    return (
                      <React.Fragment key={a.id}>
                        <tr
                          className="border-b border-[#F3F3F5] last:border-0 hover:bg-[#FAFAFB] cursor-pointer"
                          onClick={() => setExpandedActionItemId(isExpanded ? null : a.id)}
                        >
                          <td className="px-2.5 py-3 align-top">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="text-[10px] text-[#8B8B92] mt-0.5 shrink-0 w-3">
                                {isExpanded ? "▾" : "▸"}
                              </span>
                              <div className="min-w-0 overflow-hidden">
                                <div className="text-[10.5px] font-semibold text-[#202024] leading-[1.45] truncate" title={a.title}>
                                  {a.title}
                                </div>
                                <div className="text-[8.3px] text-[#96969D] mt-0.5 truncate">Client action item</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2.5 py-3 align-middle">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-semibold capitalize max-w-full truncate ${
                                PRIORITY_PILL_CLASS[a.priority] || "bg-[#F0F0F2] text-[#55555B]"
                              }`}
                            >
                              {a.priority || "medium"}
                            </span>
                          </td>
                          <td className="px-2.5 py-3 align-middle">
                            <span
                              className={`inline-flex items-center min-h-[22px] px-1.5 rounded-md text-[8px] font-semibold capitalize max-w-full truncate ${statusTone}`}
                            >
                              {a.status || "pending"}
                            </span>
                          </td>
                          <td className="px-2.5 py-3 align-middle text-[9px] text-[#4C4C53] truncate">
                            {a.due_date ? (
                              format(new Date(a.due_date + "T00:00:00"), "MMM d, yyyy")
                            ) : (
                              <span className="text-[#A0A0A6]">No date</span>
                            )}
                          </td>
                          <td className="px-2.5 py-3 align-middle text-[9px] text-[#4C4C53] truncate" title={a.requested_by_user?.full_name || ""}>
                            {a.requested_by_user?.full_name || "—"}
                          </td>
                          <td className="px-2.5 py-3 align-middle">
                            {a.visible_to_client !== false ? (
                              <span className="inline-flex items-center min-h-[22px] px-1.5 rounded-md text-[8px] font-semibold bg-[#EAF1FF] text-[#3B68B5]">
                                Client
                              </span>
                            ) : (
                              <span className="text-[9px] text-[#A0A0A6]">—</span>
                            )}
                          </td>
                          <td className="px-2.5 py-3 align-middle">
                            {a.blockers && blockerTone ? (
                              <span
                                className={`inline-flex items-center min-h-[22px] px-1.5 rounded-md text-[8px] font-semibold ${blockerTone}`}
                              >
                                {a.blockers.status === "resolved" ? "Resolved" : "Active"}
                              </span>
                            ) : (
                              <span className="text-[9px] text-[#A0A0A6]">—</span>
                            )}
                          </td>
                          <td
                            className="px-2.5 py-3 align-middle text-[9px] text-[#4C4C53] truncate"
                            title={linkedTask?.title || ""}
                          >
                            {linkedTask?.title || "—"}
                          </td>
                          <td className="px-2.5 py-3 align-middle">
                            {assignedName ? (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-[#EEF1F5] text-[#5E6470] text-[7px] font-bold flex items-center justify-center flex-none">
                                  {initials(assignedName)}
                                </span>
                                <span className="text-[9px] text-[#4C4C53] truncate" title={assignedName}>
                                  {assignedName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[9px] text-[#A0A0A6]">—</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="px-3.5 py-4 bg-[#FAFAFB]">
                              {a.description ? (
                                <p className="text-[11px] text-[#5D5D64] whitespace-pre-wrap mb-2">{a.description}</p>
                              ) : (
                                <p className="text-[9.5px] text-[#96969D]">No additional details.</p>
                              )}
                              {a.status === "completed" && a.resolver && (
                                <div className="bg-[#E8F7EC] border border-[#CDEBD7] rounded-[9px] px-3 py-2 text-[11px] text-[#1A8B49]">
                                  Resolved by {a.resolver.full_name}
                                  {a.completed_at ? ` on ${format(new Date(a.completed_at), "MMM d, yyyy")}` : ""}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Action Items</h3>
      </div>

      {relevantItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No action items for this project.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap border-b border-gray-200 pb-2">
            {(
              [
                { key: "blockers" as const, label: "Task Blockers", count: blockerItems.length },
                { key: "dependencies" as const, label: "Task Dependencies", count: dependencyItems.length },
                { key: "all" as const, label: "All Items", count: relevantItems.length },
              ] as const
            ).map((tab) => {
              const active = actionItemSubTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActionItemSubTab(tab.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2 ${
                    active
                      ? tab.key === "blockers"
                        ? "bg-rose-50 text-rose-700 border border-rose-200 shadow-sm"
                        : tab.key === "dependencies"
                        ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                        : "bg-gray-800 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {tab.key === "blockers" ? "⚠️ " : ""}
                  {tab.key === "dependencies" ? "🔗 " : ""}
                  {tab.label}
                  <Badge
                    className={
                      active
                        ? tab.key === "blockers"
                          ? "bg-rose-600 text-white hover:bg-rose-600"
                          : tab.key === "dependencies"
                          ? "bg-blue-600 text-white hover:bg-blue-600"
                          : "bg-gray-700 text-white hover:bg-gray-700"
                        : "bg-gray-200 text-gray-700"
                    }
                  >
                    {tab.count}
                  </Badge>
                </button>
              );
            })}
          </div>

          {activeTabItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {actionItemSubTab === "blockers"
                ? "No active task blockers."
                : actionItemSubTab === "dependencies"
                ? "No task dependencies."
                : "No action items for this project."}
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

import React, { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DataRow, RowPrimary, RowSecondary, RowDataItem, RowActions, TableHeader } from "@/components/ui/data-row";
import { Table, TableBody, TableCell, TableHead, TableHeader as ShadcnTableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2 } from "lucide-react";
import { getAvatarUrl } from "@/lib/utils";

interface ProjectResourcesTabProps {
  id: string;
  type: "resource" | "client";
  members: any[];
  isAdmin: boolean;
  isClient?: boolean;
  profile: any;
  queryClient: any;
  setAddMemberMode: (mode: "resource" | "client") => void;
  setAddMemberOpen: (open: boolean) => void;
  employeeProjects?: Record<string, string[]>;
  projectName?: string;
}

function sortedMembers(members: any[]) {
  return members
    .slice()
    .sort((a: any, b: any) => (a.users?.full_name || "").localeCompare(b.users?.full_name || ""));
}

function activeProjectCount(
  userId: string | undefined,
  employeeProjects: Record<string, string[]> | undefined,
  projectName?: string
) {
  if (!userId || !employeeProjects) return 0;
  const names = employeeProjects[userId] || [];
  // Prefer total active memberships; if map omitted current project, still count it once.
  if (projectName && !names.includes(projectName)) {
    return names.length + 1;
  }
  return names.length;
}

function MemberRemoveDialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ProjectResourcesTab({
  id,
  type,
  members,
  isAdmin,
  isClient = false,
  profile,
  queryClient,
  setAddMemberMode,
  setAddMemberOpen,
  employeeProjects,
  projectName,
}: ProjectResourcesTabProps) {
  const [confirmMemberDelId, setConfirmMemberDelId] = useState<string | null>(null);
  const [confirmMemberDelUserId, setConfirmMemberDelUserId] = useState<string | null>(null);

  const removeMember = async (memberId: string, userId: string) => {
    if (!id) return;
    await supabase.from("project_members").update({ removed_at: new Date().toISOString() }).eq("id", memberId);
    await supabase.from("audit_logs").insert({
      actor_id: profile?.id,
      action: "project.member_removed",
      target_entity: "project_members",
      target_id: id,
      metadata: { user_id: userId },
    });
    toast.success("Member removed");
    queryClient.invalidateQueries({ queryKey: ["project-members", id] });
    setConfirmMemberDelId(null);
    setConfirmMemberDelUserId(null);
  };

  const clearConfirm = () => {
    setConfirmMemberDelId(null);
    setConfirmMemberDelUserId(null);
  };

  const confirmRemove = () => {
    if (confirmMemberDelId && confirmMemberDelUserId) {
      removeMember(confirmMemberDelId, confirmMemberDelUserId);
    }
  };

  // ── Admin: Client Members ──────────────────────────────────────────────
  if (type === "client" && isAdmin) {
    return (
      <div>
        <div className="flex items-center justify-between mb-[18px] flex-wrap gap-2.5">
          <div className="text-[18px] font-bold text-[#17171A]">Client Members</div>
          <button
            type="button"
            onClick={() => {
              setAddMemberMode("client");
              setAddMemberOpen(true);
            }}
            className="inline-flex items-center gap-[7px] bg-[#EB5A1E] text-white font-semibold text-[13px] px-4 py-[9px] rounded-[10px] hover:bg-[#d64f18] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
            Add Client Member
          </button>
        </div>

        <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden">
          {members.length === 0 ? (
            <p className="text-[13px] text-[#8B8B92] py-10 text-center">No client members assigned</p>
          ) : (
            sortedMembers(members).map((m) => {
              const user = m.users as any;
              const name = user?.full_name || "Unknown";
              const roleOrDesignation = user?.designation || user?.role || "";
              const email = user?.email || "";
              const subtitle = [roleOrDesignation, email].filter(Boolean).join(" · ") || "—";
              const initial = name.charAt(0).toUpperCase();

              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3.5 px-[18px] py-3.5 border-b border-black/[0.06] last:border-0"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={getAvatarUrl(user?.avatar_url)} />
                    <AvatarFallback className="text-[13px] font-bold bg-[#E6E9FF] text-[#4C57D9]">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold text-[#17171A] truncate">{name}</div>
                    <div className="text-[12.5px] text-[#8B8B92] truncate mt-0.5">{subtitle}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmMemberDelId(m.id);
                      setConfirmMemberDelUserId(user?.id);
                    }}
                    className="w-[30px] h-[30px] rounded-lg bg-[#FDECEC] flex items-center justify-center shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[#E5484D]" strokeWidth={2} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <MemberRemoveDialog
          open={!!confirmMemberDelId}
          title="Remove Client Member?"
          description="Are you sure you want to remove this client member from the project?"
          onCancel={clearConfirm}
          onConfirm={confirmRemove}
        />
      </div>
    );
  }

  // ── Admin: Team ────────────────────────────────────────────────────────
  if (type === "resource" && isAdmin) {
    return (
      <div>
        <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] flex-wrap gap-2.5">
            <div className="text-[15px] font-bold text-[#17171A]">
              {members.length} team member{members.length === 1 ? "" : "s"}
            </div>
            <button
              type="button"
              onClick={() => {
                setAddMemberMode("resource");
                setAddMemberOpen(true);
              }}
              className="inline-flex items-center gap-[7px] bg-[#EB5A1E] text-white font-semibold text-[13px] px-4 py-[9px] rounded-[10px] hover:bg-[#d64f18] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
              Add Team Member
            </button>
          </div>

          {members.length === 0 ? (
            <p className="text-[13px] text-[#8B8B92] py-10 text-center">No team members assigned</p>
          ) : (
            <>
              <div
                className="grid gap-3 px-5 py-2.5 border-b border-black/[0.06] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-[0.05em] text-[#B0B0B6]"
                style={{ gridTemplateColumns: "2fr .9fr 1fr 1fr .5fr" }}
              >
                <span>Team Member</span>
                <span>Active Projects</span>
                <span>Hours Spent</span>
                <span>Assigned</span>
                <span className="text-right">Actions</span>
              </div>
              {sortedMembers(members).map((m) => {
                const user = m.users as any;
                const name = user?.full_name || "Unknown";
                const designation = user?.designation || "—";
                const userId = user?.id || m.user_id;
                const activeCount = activeProjectCount(userId, employeeProjects, projectName);
                const hours = m._hoursSpent != null ? Number(m._hoursSpent) : 0;
                const hoursLabel = `${Math.round(hours * 10) / 10}h`;

                return (
                  <div
                    key={m.id}
                    className="grid gap-3 px-5 py-3.5 border-b border-black/[0.06] last:border-0 items-center"
                    style={{ gridTemplateColumns: "2fr .9fr 1fr 1fr .5fr" }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={getAvatarUrl(user?.avatar_url)} />
                        <AvatarFallback className="text-[11px] font-bold bg-[#F1F1F3] text-[#4E4E55]">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-bold text-[#17171A] truncate">{name}</div>
                        <div className="text-[12px] text-[#8B8B92] truncate">{designation}</div>
                      </div>
                    </div>
                    <div>
                      <span className="inline-flex items-center bg-[#FDECE3] text-[#EB5A1E] text-[11px] font-bold px-[9px] py-[3px] rounded-full whitespace-nowrap">
                        {activeCount} active
                      </span>
                    </div>
                    <div className="text-[13px] font-semibold text-[#4B4B52]">{hoursLabel}</div>
                    <div className="text-[13px] text-[#4B4B52]">
                      {m.assigned_at ? format(new Date(m.assigned_at), "MMM d, yyyy") : "—"}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmMemberDelId(m.id);
                          setConfirmMemberDelUserId(userId);
                        }}
                        className="w-[30px] h-[30px] rounded-lg bg-[#FDECEC] flex items-center justify-center"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-[#E5484D]" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <MemberRemoveDialog
          open={!!confirmMemberDelId}
          title="Remove Team Member?"
          description="Are you sure you want to remove this team member from the project?"
          onCancel={clearConfirm}
          onConfirm={confirmRemove}
        />
      </div>
    );
  }

  // ── Non-admin client type (fallback) ───────────────────────────────────
  if (type === "client") {
    return (
      <>
        <Card>
          <div className="p-4 flex justify-between items-center border-b">
            <span className="font-medium">
              {members.length} Client Member{members.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Table>
            <ShadcnTableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
              </TableRow>
            </ShadcnTableHeader>
            <TableBody>
              {sortedMembers(members).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={getAvatarUrl((m.users as any)?.avatar_url)} />
                        <AvatarFallback className="text-xs">{((m.users as any)?.full_name || "?")[0]}</AvatarFallback>
                      </Avatar>
                      {(m.users as any)?.full_name}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {members.length === 0 && (
                <TableRow>
                  <TableCell className="text-center text-muted-foreground py-8">
                    No client members assigned
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </>
    );
  }

  // ── Resource: client view or non-admin employee ────────────────────────
  return (
    <>
      {isClient ? (
        <div>
          <h3 className="client-section-title">Resources</h3>
          <div className="client-table-card">
            <div className="flex items-center justify-between gap-3 px-3.5 py-[11px] border-b border-[#E9E9EC] bg-[#FCFCFD]">
              <div>
                <div className="text-[10.5px] font-semibold text-[#17171A]">
                  {members.length} project resource{members.length !== 1 ? "s" : ""}
                </div>
                <div className="text-[8.5px] text-[#8F8F96] mt-0.5">
                  People currently visible to the client for this project
                </div>
              </div>
              <span className="inline-flex items-center min-h-[22px] px-2 rounded-md text-[8px] font-semibold bg-[#F2F2F4] text-[#5D5D64]">
                Client view
              </span>
            </div>
            <div className="overflow-hidden">
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-[#9595A0] text-[9px] font-medium tracking-[0.02em] uppercase px-3.5 py-2.5 border-b border-[#E2E2E5] bg-white w-[50%]">
                      Resource
                    </th>
                    <th className="text-left text-[#9595A0] text-[9px] font-medium tracking-[0.02em] uppercase px-3.5 py-2.5 border-b border-[#E2E2E5] bg-white w-[25%]">
                      Hours spent
                    </th>
                    <th className="text-left text-[#9595A0] text-[9px] font-medium tracking-[0.02em] uppercase px-3.5 py-2.5 border-b border-[#E2E2E5] bg-white w-[25%]">
                      Assigned since
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-[38px] text-center text-[9.5px] text-[#96969D]">
                        No resources assigned
                      </td>
                    </tr>
                  ) : (
                    sortedMembers(members).map((m) => {
                      const name = (m.users as any)?.full_name || "Unknown";
                      const role = (m.users as any)?.designation || "—";
                      return (
                        <tr key={m.id} className="border-b border-[#F3F3F5] last:border-0 hover:bg-[#FAFAFB]">
                          <td className="px-3.5 py-3">
                            <div className="flex items-center gap-[7px] min-w-0">
                              <span className="w-6 h-6 rounded-[7px] bg-[#F1F1F3] text-[#4E4E55] text-[7.5px] font-bold flex items-center justify-center shrink-0">
                                {name.charAt(0).toUpperCase()}
                              </span>
                              <div className="min-w-0 overflow-hidden">
                                <div className="text-[10.7px] font-semibold text-[#17171A] leading-[1.45] truncate" title={name}>
                                  {name}
                                </div>
                                <div className="text-[8.4px] text-[#97979E] mt-0.5 truncate" title={role}>
                                  {role}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3.5 py-3 text-[10.5px] text-[#4C4C53]">
                            {m._hoursSpent != null ? `${m._hoursSpent}h` : "0h"}
                          </td>
                          <td className="px-3.5 py-3 text-[10.5px] text-[#4C4C53]">
                            {m.assigned_at ? format(new Date(m.assigned_at), "MMM d, yyyy") : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <Card>
          <div className="p-4 flex justify-between items-center border-b">
            <span className="font-medium">
              {members.length} resource{members.length !== 1 ? "s" : ""}
            </span>
          </div>
          {members.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">No resources assigned</div>
          ) : (
            <div>
              <TableHeader gridCols="1fr 112px 112px">
                <span>RESOURCE</span>
                <span>HOURS SPENT</span>
                <span>ASSIGNED</span>
              </TableHeader>
              {sortedMembers(members).map((m) => (
                <DataRow key={m.id} gridCols="1fr 112px 112px">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={getAvatarUrl((m.users as any)?.avatar_url)} />
                      <AvatarFallback className="text-xs">{((m.users as any)?.full_name || "?")[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <RowPrimary>{(m.users as any)?.full_name}</RowPrimary>
                      <RowSecondary>{(m.users as any)?.designation}</RowSecondary>
                    </div>
                  </div>
                  <RowDataItem label="HOURS SPENT">{m._hoursSpent}h</RowDataItem>
                  <RowDataItem label="ASSIGNED">
                    {m.assigned_at ? format(new Date(m.assigned_at), "MMM d, yyyy") : "—"}
                  </RowDataItem>
                </DataRow>
              ))}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

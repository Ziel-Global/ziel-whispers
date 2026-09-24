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

  if (type === "client") {
    return (
      <>
        <Card>
          <div className="p-4 flex justify-between items-center border-b">
            <span className="font-medium">
              {members.length} Client Member{members.length !== 1 ? "s" : ""}
            </span>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => {
                  setAddMemberMode("client");
                  setAddMemberOpen(true);
                }}
                className="rounded-button"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Client Member
              </Button>
            )}
          </div>
          <Table>
            <ShadcnTableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </ShadcnTableHeader>
            <TableBody>
              {members
                .sort((a: any, b: any) => (a.users?.full_name || "").localeCompare(b.users?.full_name || ""))
                .map((m) => (
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
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setConfirmMemberDelId(m.id);
                            setConfirmMemberDelUserId((m.users as any)?.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 2 : 1} className="text-center text-muted-foreground py-8">
                    No client members assigned
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <AlertDialog open={!!confirmMemberDelId} onOpenChange={(o) => !o && setConfirmMemberDelId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Member?</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to remove this member from the project?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmMemberDelId(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmMemberDelId && confirmMemberDelUserId) {
                    removeMember(confirmMemberDelId, confirmMemberDelUserId);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      {isClient ? (
        <div>
          <h3 className="client-section-title">Resources</h3>
          {members.length === 0 ? (
            <div className="client-empty-state">
              <div className="text-[12px] font-semibold text-[#3F3F45] mb-1">No resources assigned</div>
              <p className="text-[9.5px] max-w-[360px] mx-auto leading-relaxed">Team members assigned to this project will appear here.</p>
            </div>
          ) : (
            <div className="client-table-card">
              <div className="client-table-summary">
                <span className="text-[12px] font-semibold text-[#17171A]">
                  {members.length} resource{members.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="border-b border-[#E9E9EC] text-[10px] uppercase tracking-[0.05em] text-[#9ca3af] font-semibold">
                      <th className="px-4 py-2.5 text-left">Resource</th>
                      <th className="px-4 py-2.5 text-left">Hours</th>
                      <th className="px-4 py-2.5 text-left">Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members
                      .sort((a: any, b: any) => (a.users?.full_name || "").localeCompare(b.users?.full_name || ""))
                      .map((m) => (
                        <tr key={m.id} className="border-b border-[#F3F3F5] last:border-0 hover:bg-[#FAFAFB]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-7 w-7 shrink-0">
                                <AvatarImage src={getAvatarUrl((m.users as any)?.avatar_url)} />
                                <AvatarFallback className="text-xs bg-[#FFF0E9] text-[#EB5A1E]">
                                  {((m.users as any)?.full_name || "?")[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="text-[13px] font-semibold text-[#17171A]">{(m.users as any)?.full_name}</div>
                                <div className="text-[11px] text-[#8B8B92]">{(m.users as any)?.designation}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[13px] text-[#374151]">{m._hoursSpent}h</td>
                          <td className="px-4 py-3 text-[13px] text-[#374151]">
                            {m.assigned_at ? format(new Date(m.assigned_at), "MMM d, yyyy") : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
      <Card>
        <div className="p-4 flex justify-between items-center border-b">
          <span className="font-medium">
            {members.length} resource{members.length !== 1 ? "s" : ""}
          </span>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => {
                setAddMemberMode("resource");
                setAddMemberOpen(true);
              }}
              className="rounded-button"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Resource
            </Button>
          )}
        </div>
        {members.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">No resources assigned</div>
        ) : (
          <div>
            <TableHeader gridCols={isAdmin ? "1fr 112px 112px 80px" : "1fr 112px 112px"}>
              <span>RESOURCE</span>
              <span>HOURS SPENT</span>
              <span>ASSIGNED</span>
              {isAdmin && <span className="text-right">ACTIONS</span>}
            </TableHeader>
            {members
              .sort((a: any, b: any) => (a.users?.full_name || "").localeCompare(b.users?.full_name || ""))
              .map((m) => (
                <DataRow key={m.id} gridCols={isAdmin ? "1fr 112px 112px 80px" : "1fr 112px 112px"}>
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
                  {isAdmin && (
                    <RowActions className="justify-self-end">
                      <button
                        onClick={() => {
                          setConfirmMemberDelId(m.id);
                          setConfirmMemberDelUserId((m.users as any)?.id);
                        }}
                        className="shrink-0 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors text-destructive"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </RowActions>
                  )}
                </DataRow>
              ))}
          </div>
        )}
      </Card>
      )}

      <AlertDialog open={!!confirmMemberDelId} onOpenChange={(o) => !o && setConfirmMemberDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Resource?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to remove this resource from the project?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmMemberDelId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmMemberDelId && confirmMemberDelUserId) {
                  removeMember(confirmMemberDelId, confirmMemberDelUserId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

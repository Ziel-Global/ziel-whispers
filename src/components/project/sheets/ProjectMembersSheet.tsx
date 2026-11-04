import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";

interface ProjectMembersSheetProps {
  id: string;
  addMemberOpen: boolean;
  setAddMemberOpen: (open: boolean) => void;
  addMemberMode: "resource" | "client";
  allEmployees: any[] | undefined;
  members: any[] | undefined;
  employeeProjects: Record<string, string[]> | undefined;
  profile: any;
  queryClient: any;
}

export function ProjectMembersSheet({
  id,
  addMemberOpen,
  setAddMemberOpen,
  addMemberMode,
  allEmployees,
  members,
  employeeProjects,
  profile,
  queryClient,
}: ProjectMembersSheetProps) {
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userAllocations, setUserAllocations] = useState<Record<string, number>>({});

  const availableEmployees =
    allEmployees?.filter((e) => {
      const notMember = !members?.some((m) => (m.users as any)?.id === e.id);
      const matchesSearch = e.full_name.toLowerCase().includes(memberSearch.toLowerCase());
      const matchesMode =
        addMemberMode === "client"
          ? e.designation === "Client" || e.designation === "Client Member"
          : e.designation !== "Client" && e.designation !== "Client Member";
      return notMember && matchesSearch && matchesMode;
    }) || [];

  const toggleUser = (uid: string) => {
    setSelectedUsers((prev) => {
      if (prev.includes(uid)) {
        return prev.filter((u) => u !== uid);
      } else {
        if (!userAllocations[uid]) {
          setUserAllocations((alloc) => ({ ...alloc, [uid]: 100 }));
        }
        return [...prev, uid];
      }
    });
  };

  const setAllocation = (uid: string, pct: number) => {
    setUserAllocations((prev) => ({ ...prev, [uid]: Math.max(5, Math.min(100, pct)) }));
  };

  const addMembers = async () => {
    if (selectedUsers.length === 0 || !id) return;
    try {
      for (const uid of selectedUsers) {
        const emp = allEmployees?.find((e) => e.id === uid);
        const roleName = emp?.designation || "Member";
        let roleId: string | null = null;
        const { data: existingRole } = await supabase
          .from("project_roles")
          .select("id")
          .eq("project_id", id)
          .eq("name", roleName)
          .maybeSingle();

        if (existingRole) {
          roleId = existingRole.id;
        } else {
          const { data: newRole } = await supabase
            .from("project_roles")
            .insert({ project_id: id, name: roleName })
            .select("id")
            .single();
          roleId = newRole?.id || null;
        }

        const allocation = userAllocations[uid] ?? 100;

        await supabase.from("project_members").insert({
          project_id: id,
          user_id: uid,
          project_role_id: roleId,
          allocation_percentage: allocation,
        });

        await supabase.from("audit_logs").insert({
          actor_id: profile?.id,
          action: "project.member_added",
          target_entity: "project_members",
          target_id: id,
          metadata: { user_id: uid, allocation_percentage: allocation },
        });
      }
      toast.success(`${selectedUsers.length} member(s) added`);
      setSelectedUsers([]);
      setUserAllocations({});
      setAddMemberOpen(false);
      queryClient.invalidateQueries({ queryKey: ["project-members", id] });
      queryClient.invalidateQueries({ queryKey: ["module5-project-members"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Sheet open={addMemberOpen} onOpenChange={setAddMemberOpen}>
      <SheetContent className="flex flex-col h-full">
        <SheetHeader>
          <SheetTitle>{addMemberMode === "client" ? "Add Client Member" : "Add Resource"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={addMemberMode === "client" ? "Search client users..." : "Search resources..."}
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {availableEmployees.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {memberSearch
                ? "No matching users found."
                : addMemberMode === "client"
                ? "All client users are already on this project."
                : "All resources are already on this project."}
            </p>
          )}
          {availableEmployees.map((e) => (
            <div
              key={e.id}
              className={`p-3 rounded-md border cursor-pointer transition-colors ${
                selectedUsers.includes(e.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
              onClick={() => toggleUser(e.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{e.full_name}</span>
                  <span className="text-xs text-muted-foreground block">{e.designation}</span>
                  {employeeProjects?.[e.id] && employeeProjects[e.id].length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-black">
                      <span className="text-[10px] uppercase tracking-wider font-semibold">Active Projects:</span>
                      {employeeProjects[e.id].map((pName, idx) => (
                        <span key={idx} className="text-[10px] bg-primary px-1.5 py-0.5 rounded-sm">
                          {pName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {selectedUsers.includes(e.id) && <Badge className="bg-primary text-primary-foreground">Selected</Badge>}
              </div>

              {selectedUsers.includes(e.id) && (
                <div className="mt-2.5 pt-2 border-t flex items-center justify-between gap-3" onClick={(e2) => e2.stopPropagation()}>
                  <p className="text-xs text-muted-foreground">
                    Role: <span className="font-medium text-foreground">{e.designation || "Member"}</span>
                  </p>
                  {addMemberMode !== "client" && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-medium text-muted-foreground">Allocation:</span>
                      <Input
                        type="number"
                        min="5"
                        max="100"
                        step="5"
                        value={userAllocations[e.id] ?? 100}
                        onChange={(ev) => setAllocation(e.id, Number(ev.target.value))}
                        className="h-6 w-16 text-xs text-right pr-1"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <SheetFooter className="mt-4 pt-4 border-t shrink-0">
          <Button onClick={addMembers} disabled={selectedUsers.length === 0} className="rounded-button w-full">
            Add {selectedUsers.length} {addMemberMode === "client" ? "Client Member" : "Resource"}
            {selectedUsers.length !== 1 ? "s" : ""}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

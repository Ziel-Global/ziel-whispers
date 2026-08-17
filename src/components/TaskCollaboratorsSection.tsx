import { useState } from "react";
import { useTaskCollaborators } from "@/hooks/useTaskCollaborators";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, X, Loader2 } from "lucide-react";
import { getAvatarUrl } from "@/lib/utils";

interface TaskCollaboratorsSectionProps {
  taskId: string;
  projectMembers?: any[];
  primaryOwnerId?: string | null;
}

export function TaskCollaboratorsSection({
  taskId,
  projectMembers = [],
  primaryOwnerId,
}: TaskCollaboratorsSectionProps) {
  const { collaborators, loading, addCollaborator, removeCollaborator } = useTaskCollaborators(taskId);
  const [adding, setAdding] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Filter out members who are already collaborators, primary owner, or client members
  const existingCollaboratorUserIds = new Set(collaborators.map((c) => c.user_id));
  const availableMembers = projectMembers.filter((m: any) => {
    const uid = m.user_id;
    if (!uid) return false;
    if (uid === primaryOwnerId) return false; // Primary owner is not a secondary collaborator
    if (existingCollaboratorUserIds.has(uid)) return false; // Already added

    const role = (m.users?.role || "").toLowerCase();
    const designation = (m.users?.designation || "").toLowerCase();

    // Exclude client and client member users
    if (role === "client" || role === "client member") return false;
    if (designation === "client" || designation === "client member") return false;

    return true;
  });

  const handleAddSubmit = async () => {
    if (!selectedUserId) return;
    setSubmitting(true);
    await addCollaborator(selectedUserId);
    setSelectedUserId("");
    setAdding(false);
    setSubmitting(false);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Users className="h-4 w-4" /> Collaborators
      </h4>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : collaborators.length === 0 ? (
        <p className="text-xs text-muted-foreground">No collaborators added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2 items-center max-h-32 overflow-y-auto p-1 border rounded-md bg-muted/20">
          {collaborators.map((collab) => {
            const userName = collab.user?.full_name || "Team Member";
            const avatarUrl = collab.user?.avatar_url || getAvatarUrl(userName);
            return (
              <Badge
                key={collab.id}
                variant="secondary"
                className="flex items-center gap-1.5 py-1 px-2.5 text-xs bg-background hover:bg-muted font-normal border shadow-sm"
              >
                <Avatar className="h-4 w-4">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-[8px]">{userName.charAt(0)}</AvatarFallback>
                </Avatar>
                <span>{userName}</span>
                <button
                  type="button"
                  onClick={() => removeCollaborator(collab.user_id)}
                  className="ml-1 text-muted-foreground hover:text-destructive transition-colors rounded-full p-0.5"
                  title={`Remove ${userName}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {adding ? (
        <div className="space-y-2 border rounded-md p-3">
          <div className="space-y-2">
            <label className="text-xs font-medium">Select Collaborator</label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue placeholder="Select team member..." />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((m: any) => {
                  const name = (m as any).users?.full_name || "Unknown";
                  const designation = (m as any).users?.designation;
                  return (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      <div className="flex items-center gap-2">
                        <span>{name}</span>
                        {designation && <span className="text-xs text-muted-foreground">— {designation}</span>}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAddSubmit}
              disabled={!selectedUserId || submitting}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setAdding(false);
                setSelectedUserId("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Collaborator
        </Button>
      )}
    </div>
  );
}


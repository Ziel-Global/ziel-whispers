import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProjectStatusUpdatesTabProps {
  statusUpdates: any[];
  statusUpdatesLoading: boolean;
  getAvatarUrl: (name: string) => string;
}

export function ProjectStatusUpdatesTab({
  statusUpdates,
  statusUpdatesLoading,
  getAvatarUrl,
}: ProjectStatusUpdatesTabProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Project Updates</h3>
      {statusUpdatesLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : statusUpdates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No status updates yet.</p>
      ) : (
        <div className="space-y-3">
          {statusUpdates.map((u: any) => (
            <div key={u.id} className="flex gap-2 bg-muted/30 rounded-md p-3">
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                <AvatarImage src={getAvatarUrl(u.author?.full_name)} />
                <AvatarFallback className="text-[10px]">{u.author?.full_name?.charAt(0) || "?"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{u.author?.full_name || (u.author_type === "ai" ? "AI" : "Unknown")}</span>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(u.created_at), "MMM d, h:mm a")}</span>
                </div>
                <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{u.summary}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
      <h3 className="client-section-title">Project Updates</h3>
      {statusUpdatesLoading ? (
        <div className="client-empty-state">Loading…</div>
      ) : statusUpdates.length === 0 ? (
        <div className="client-empty-state">
          <div className="text-[12px] font-semibold text-[#3F3F45] mb-1">No status updates yet</div>
          <p className="text-[9.5px] max-w-[360px] mx-auto leading-relaxed">
            Project updates from the team will appear here when posted.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {statusUpdates.map((u: any) => (
            <div
              key={u.id}
              className="flex gap-3 client-table-card p-4"
            >
              <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                <AvatarImage src={getAvatarUrl(u.author?.full_name)} />
                <AvatarFallback className="text-[10px] bg-[#FFF0E9] text-[#EB5A1E]">
                  {u.author?.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold text-[#17171A]">
                    {u.author?.full_name || (u.author_type === "ai" ? "AI" : "Unknown")}
                  </span>
                  <span className="text-[10px] text-[#8B8B92]">
                    {format(new Date(u.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
                <p className="text-[13px] text-[#3F3F45] mt-1.5 whitespace-pre-wrap break-words leading-relaxed">
                  {u.summary}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

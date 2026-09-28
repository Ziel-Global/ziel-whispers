import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface ProjectBlockersTabProps {
  blockers: any[];
  tasks: any[];
}

export function ProjectBlockersTab({ blockers, tasks }: ProjectBlockersTabProps) {
  const taskTitle = (taskId: string | null) => {
    if (!taskId) return "—";
    return (tasks || []).find((t: any) => t.id === taskId)?.title || "—";
  };

  const openCount = blockers.filter((b: any) => b.status !== "resolved").length;
  const resolvedCount = blockers.filter((b: any) => b.status === "resolved").length;

  return (
    <div>
      <h3 className="client-section-title">Blockers</h3>
      {blockers.length === 0 ? (
        <div className="client-empty-state">
          <div className="text-[12px] font-semibold text-[#3F3F45] mb-1">No blockers reported</div>
          <p className="text-[9.5px] max-w-[360px] mx-auto leading-relaxed">There are no open or resolved blockers for this project.</p>
        </div>
      ) : (
        <div className="client-table-card">
          <div className="client-table-summary">
            <span className="text-[12px] font-semibold text-[#17171A]">
              {blockers.length} blocker{blockers.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="bg-[#FFF1E8] text-[#C95627] font-semibold px-2 py-0.5 rounded-full">{openCount} open</span>
              <span className="bg-[#E8F7EC] text-[#1A8B49] font-semibold px-2 py-0.5 rounded-full">{resolvedCount} resolved</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-[#E9E9EC] text-[10px] uppercase tracking-[0.05em] text-[#9ca3af] font-semibold">
                  <th className="px-4 py-2.5 text-left">Blocker</th>
                  <th className="px-4 py-2.5 text-left">Task</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Raised</th>
                </tr>
              </thead>
              <tbody>
                {blockers.map((b: any) => (
                  <tr key={b.id} className="border-b border-[#F3F3F5] last:border-0 hover:bg-[#FAFAFB]">
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold text-[#17171A] break-words">{b.description || "—"}</div>
                      <div className="text-[11px] text-[#8B8B92] mt-0.5">by {b.raiser?.full_name || "Unknown"}</div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#374151] break-words">{taskTitle(b.task_id)}</td>
                    <td className="px-4 py-3">
                      {b.status === "resolved" ? (
                        <Badge className="bg-[#E8F7EC] text-[#1A8B49] border-0 shadow-none text-[10px]">Resolved</Badge>
                      ) : (
                        <Badge className="bg-[#FFF1E8] text-[#C95627] border-0 shadow-none text-[10px]">Open</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#374151]">
                      {b.raised_at ? format(new Date(b.raised_at), "MMM d, yyyy") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

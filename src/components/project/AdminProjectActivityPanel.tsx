import { buildProjectActivityFeed } from "@/lib/projectActivityFeed";

type Props = {
  tasks: any[];
  workflowStatuses?: any[];
  openBlockers: { description?: string | null; status?: string }[];
  statusUpdates: any[];
  sprints: any[];
  resourceMembers: any[];
};

export function AdminProjectActivityPanel({
  tasks,
  workflowStatuses = [],
  openBlockers,
  statusUpdates,
  sprints,
  resourceMembers,
}: Props) {
  const feed = buildProjectActivityFeed({
    tasks,
    workflowStatuses,
    openBlockers,
    statusUpdates,
    sprints,
    resourceMembers,
  });

  return (
    <div>
      <div className="mb-[18px]">
        <div className="text-[18px] font-bold text-[#17171A]">Project Activity</div>
        <div className="text-[12.5px] text-[#8B8B92] mt-1">
          Milestones, approvals, delays, and team changes
        </div>
      </div>

      <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden">
        {feed.length === 0 ? (
          <p className="text-[13px] text-[#8B8B92] py-6 text-center px-[22px]">No project activity yet.</p>
        ) : (
          <div className="max-h-[min(520px,calc(100vh-360px))] overflow-y-auto overscroll-contain p-[22px]">
            <div className="flex flex-col">
              {feed.map((m) => (
                <div
                  key={m.key}
                  className="flex items-start gap-3.5 pb-4 mb-4 border-b border-black/[0.06] last:border-0 last:mb-0 last:pb-0"
                >
                  <div
                    className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0"
                    style={{ background: m.iconBg, color: m.iconColor }}
                  >
                    <m.Icon className="h-3.5 w-3.5" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="text-[13.5px] text-[#17171A] leading-snug">{m.text}</div>
                    {m.time && (
                      <div className="text-xs text-[#B0B0B6] mt-1">{m.time}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const AVATAR_PALETTE = [
  { bg: "#FDECE3", color: "#EB5A1E" },
  { bg: "#E6E9FF", color: "#4C57D9" },
  { bg: "#DFF6E4", color: "#1B8A46" },
  { bg: "#FDF3E3", color: "#A9720B" },
  { bg: "#F5E8FF", color: "#7B4DB8" },
  { bg: "#EAF3FF", color: "#1C6FC9" },
];

type Props = {
  resourceMembers: any[];
  hoursByMember: { name: string; hours: number }[];
};

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export function AdminWorkloadPanel({ resourceMembers, hoursByMember }: Props) {
  const workloadRows =
    (resourceMembers || []).length > 0
      ? (resourceMembers || []).map((m: any, i: number) => {
          const name = m.users?.full_name || "Unknown";
          const hrs = Math.round(Number(m._hoursSpent || 0) * 10) / 10;
          const palette = AVATAR_PALETTE[i % AVATAR_PALETTE.length];
          return { name, hrs, initials: initials(name), ...palette };
        })
      : (hoursByMember || []).map((m, i) => {
          const palette = AVATAR_PALETTE[i % AVATAR_PALETTE.length];
          return {
            name: m.name,
            hrs: Math.round(Number(m.hours || 0) * 10) / 10,
            initials: initials(m.name),
            ...palette,
          };
        });
  const maxHrs = Math.max(1, ...workloadRows.map((w) => w.hrs), 1);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[18px] font-bold text-[#17171A]">Workload</div>
        <div className="text-[12.5px] text-[#8B8B92] mt-1">Team capacity and hours distribution</div>
      </div>

      <div className="bg-white border border-black/[0.08] rounded-[14px] p-5">
        <div className="text-[15px] font-bold text-[#17171A] mb-4">Workload by Team Member</div>
        {workloadRows.length === 0 ? (
          <p className="text-[13px] text-[#8B8B92]">No logged hours yet.</p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {workloadRows.map((w) => (
              <div key={w.name} className="flex items-center gap-3 min-w-0">
                <div
                  className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-bold text-[10.5px] shrink-0"
                  style={{ background: w.bg, color: w.color }}
                >
                  {w.initials}
                </div>
                <div className="w-[150px] shrink-0 text-[13px] font-semibold text-[#17171A] truncate">
                  {w.name}
                </div>
                <div className="flex-1 h-1.5 rounded bg-[#F3E9E3] overflow-hidden min-w-0">
                  <div
                    className="h-full rounded bg-[#EB5A1E]"
                    style={{ width: `${Math.min(100, (w.hrs / maxHrs) * 100)}%` }}
                  />
                </div>
                <div className="text-[12.5px] font-bold text-[#4B4B52] w-12 text-right shrink-0">
                  {w.hrs}h
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

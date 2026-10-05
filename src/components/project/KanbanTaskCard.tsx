import { format } from "date-fns";
import { avatarStyleFor, initialsFromName } from "@/components/project/AdminWorkFilters";

const PRIORITY_PILL: Record<string, { bg: string; color: string }> = {
  high: { bg: "#FDECEC", color: "#E5484D" },
  medium: { bg: "#FDF3E3", color: "#A9720B" },
  low: { bg: "#F6F5F3", color: "#6B6B72" },
};

type Props = {
  task: any;
  sprints: any[];
  showProgressBar: boolean;
  onClick: () => void;
};

export function KanbanTaskCard({ task: t, sprints, showProgressBar, onClick }: Props) {
  const assignee = t.users?.full_name as string | undefined;
  const av = assignee ? avatarStyleFor(assignee) : null;
  const sprint = t.sprint_id ? (sprints || []).find((s: any) => s.id === t.sprint_id) : null;
  const pri = PRIORITY_PILL[t.priority] || PRIORITY_PILL.medium;
  const progress = t.completed_at ? 100 : showProgressBar ? 50 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white border border-black/[0.07] rounded-[11px] p-3.5 text-left min-w-0 w-full hover:border-[#EB5A1E]/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-[13.5px] font-bold text-[#17171A] truncate min-w-0">
          {t.title}
          {t.parent_id ? (
            <span className="ml-1.5 inline-flex align-middle bg-[#F0F0F2] text-[#55555B] text-[10px] font-bold px-1.5 py-0.5 rounded-xl">
              Subtask
            </span>
          ) : null}
        </div>
        <span
          className="text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0 capitalize"
          style={{ background: pri.bg, color: pri.color }}
        >
          {t.priority}
        </span>
      </div>
      {sprint && (
        <div className="mb-2.5">
          <span className="bg-[#E6E9FF] text-[#4C57D9] text-[10.5px] font-bold px-2 py-0.5 rounded-xl">
            {sprint.name}
          </span>
        </div>
      )}
      {t.description && (
        <div className="text-xs text-[#8B8B92] leading-relaxed mb-2.5 line-clamp-3">{t.description}</div>
      )}
      <div className="flex items-center gap-2 mb-2">
        {assignee && av ? (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0"
            style={{ background: av.bg, color: av.color }}
          >
            {initialsFromName(assignee)}
          </div>
        ) : null}
        <div className="text-xs text-[#4B4B52] truncate">{assignee || "Unassigned"}</div>
      </div>
      {showProgressBar && (
        <>
          <div className="flex items-center justify-between text-[11.5px] text-[#8B8B92] mb-1">
            <span>Progress</span>
            <span className="font-bold text-[#17171A]">{progress}%</span>
          </div>
          <div className="h-[5px] rounded bg-[#F3E9E3] overflow-hidden mb-2.5">
            <div className="h-full rounded bg-[#1FAA59]" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}
      <div className="flex items-center justify-between pt-[9px] border-t border-black/[0.06] text-[11.5px] text-[#8B8B92]">
        <span>{t.estimated_hours != null ? `${t.estimated_hours}h` : "—"}</span>
        <span>
          Due {t.due_date ? format(new Date(t.due_date + "T00:00:00"), "MMM d") : "—"}
        </span>
      </div>
    </button>
  );
}

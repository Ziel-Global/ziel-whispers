import { format } from "date-fns";

type RunRow = {
  id: string;
  result: string;
  triggered_at: string;
  error_message?: string | null;
  automation_rules?: { name?: string | null } | null;
};

type Props = {
  runs: RunRow[];
};

function resultPill(result: string) {
  if (result === "success") return { label: "Success", bg: "#DFF6E4", color: "#1B8A46" };
  if (result === "failed") return { label: "Failed", bg: "#FDECEC", color: "#E5484D" };
  if (result === "skipped") return { label: "Skipped", bg: "#F6F5F3", color: "#6B6B72" };
  if (result === "condition_not_met")
    return { label: "Condition not met", bg: "#FDF3E3", color: "#A9720B" };
  return {
    label: result.replace(/_/g, " "),
    bg: "#F6F5F3",
    color: "#6B6B72",
  };
}

export function AdminAutomationRunHistoryPanel({ runs }: Props) {
  return (
    <div>
      <div className="mb-[18px]">
        <div className="text-[18px] font-bold text-[#17171A]">Run History</div>
        <div className="text-[12.5px] text-[#8B8B92] mt-1">
          Recent automation executions for this project
        </div>
      </div>

      <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden">
        {(runs || []).length === 0 ? (
          <p className="text-[13px] text-[#8B8B92] py-10 text-center m-0">No runs yet.</p>
        ) : (
          <div className="max-h-[min(520px,calc(100vh-360px))] overflow-y-auto overscroll-contain">
            {(runs || []).map((run) => {
              const pill = resultPill(run.result);
              const name = run.automation_rules?.name || "Unknown rule";
              const time = run.triggered_at
                ? format(new Date(run.triggered_at), "MMM d, yyyy · h:mm a")
                : "—";
              return (
                <div
                  key={run.id}
                  className="flex items-center justify-between gap-3 px-[18px] py-3.5 border-b border-black/[0.06] last:border-0"
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[#17171A] truncate">{name}</div>
                    <div className="text-[12px] text-[#B0B0B6] mt-0.5">{time}</div>
                    {run.error_message && (
                      <div className="text-[11.5px] text-[#E5484D] mt-1 truncate" title={run.error_message}>
                        {run.error_message}
                      </div>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-bold px-[9px] py-[3px] rounded-full whitespace-nowrap shrink-0"
                    style={{ background: pill.bg, color: pill.color }}
                  >
                    {pill.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

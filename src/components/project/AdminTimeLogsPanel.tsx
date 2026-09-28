import { format } from "date-fns";
import { Download } from "lucide-react";
import { Input } from "@/components/ui/input";

type Props = {
  logs: any[];
  projectName: string;
  logFilterDate: string;
  setLogFilterDate: (v: string) => void;
  exportCSV: (rows: any[], filename: string) => void;
  formatHours: (h: number) => string;
};

function statusPill(status?: string) {
  const s = (status || "submitted").toLowerCase();
  if (s === "approved") {
    return { label: "Approved", bg: "#DFF6E4", color: "#1B8A46" };
  }
  return { label: "Submitted", bg: "#DFF6E4", color: "#1B8A46" };
}

function taskLabel(log: any) {
  const title = log.tasks?.title;
  if (title) return title;
  if (log.category) return log.category;
  if (log.description) return log.description;
  return "—";
}

export function AdminTimeLogsPanel({
  logs,
  projectName,
  logFilterDate,
  setLogFilterDate,
  exportCSV,
  formatHours,
}: Props) {
  const filtered = (logs || []).filter((l) => !logFilterDate || l.log_date === logFilterDate);

  return (
    <div>
      <div className="flex items-center justify-between mb-[18px] flex-wrap gap-2.5">
        <div className="text-[18px] font-bold text-[#17171A]">Time Logs</div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Input
            type="date"
            value={logFilterDate}
            onChange={(e) => setLogFilterDate(e.target.value)}
            className="h-9 w-[160px] rounded-[10px] border-black/10 text-[13px] bg-white shadow-none"
          />
          <button
            type="button"
            onClick={() =>
              exportCSV(
                filtered.map((l) => ({
                  Date: l.log_date,
                  Employee: (l.users as any)?.full_name,
                  Task: taskLabel(l),
                  Category: l.category,
                  Hours: l.hours,
                  Status: l.status || "submitted",
                  Description: l.description,
                })),
                `${projectName}-logs-${logFilterDate || "all"}.csv`
              )
            }
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] border border-black/[0.08] bg-white text-[13px] font-semibold text-[#4B4B52] hover:bg-[#F6F5F3] transition-colors"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="text-[12.5px] text-[#8B8B92] mb-3">
        {filtered.length} log{filtered.length === 1 ? "" : "s"} found
      </div>

      <div className="bg-white border border-black/[0.08] rounded-[14px] overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-[13px] text-[#8B8B92] py-12 text-center">No logs found for this date</p>
        ) : (
          <>
            <div
              className="grid gap-3 px-5 py-2.5 border-b border-black/[0.06] bg-[#FAFAFB] text-[10px] font-bold uppercase tracking-[0.05em] text-[#B0B0B6]"
              style={{ gridTemplateColumns: "1.4fr 2fr 1fr .8fr 1fr" }}
            >
              <span>Team Member</span>
              <span>Task</span>
              <span>Date</span>
              <span>Hours</span>
              <span>Status</span>
            </div>
            {filtered.map((log: any) => {
              const pill = statusPill(log.status);
              return (
                <div
                  key={log.id}
                  className="grid gap-3 px-5 py-3.5 border-b border-black/[0.06] last:border-0 items-center"
                  style={{ gridTemplateColumns: "1.4fr 2fr 1fr .8fr 1fr" }}
                >
                  <div className="text-[13.5px] font-semibold text-[#17171A] truncate">
                    {(log.users as any)?.full_name || "Unknown"}
                  </div>
                  <div className="text-[13px] text-[#4B4B52] truncate" title={taskLabel(log)}>
                    {taskLabel(log)}
                  </div>
                  <div className="text-[13px] text-[#4B4B52]">
                    {log.log_date
                      ? format(new Date(log.log_date + "T00:00:00"), "MMM d, yyyy")
                      : "—"}
                  </div>
                  <div className="text-[13.5px] font-bold text-[#17171A]">
                    {formatHours(Number(log.hours))}
                  </div>
                  <div>
                    <span
                      className="inline-flex text-[11px] font-bold px-[9px] py-[3px] rounded-full"
                      style={{ background: pill.bg, color: pill.color }}
                    >
                      {pill.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

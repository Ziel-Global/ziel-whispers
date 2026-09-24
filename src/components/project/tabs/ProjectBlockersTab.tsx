import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { DataRow, RowPrimary, RowSecondary, RowDataItem, TableHeader } from "@/components/ui/data-row";

interface ProjectBlockersTabProps {
  blockers: any[];
  tasks: any[];
}

export function ProjectBlockersTab({ blockers, tasks }: ProjectBlockersTabProps) {
  const taskTitle = (taskId: string | null) => {
    if (!taskId) return "—";
    return (tasks || []).find((t: any) => t.id === taskId)?.title || "—";
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Blockers</h3>
      {blockers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No blockers reported.</p>
      ) : (
        <div>
          <TableHeader gridCols="1fr 140px 120px 140px">
            <span>BLOCKER</span>
            <span>TASK</span>
            <span>STATUS</span>
            <span>RAISED</span>
          </TableHeader>
          {blockers.map((b: any) => (
            <DataRow key={b.id} gridCols="1fr 140px 120px 140px">
              <div>
                <RowPrimary className="whitespace-normal break-words">{b.description || "—"}</RowPrimary>
                <RowSecondary>by {b.raiser?.full_name || "Unknown"}</RowSecondary>
              </div>
              <RowDataItem label="TASK">
                <span className="break-words">{taskTitle(b.task_id)}</span>
              </RowDataItem>
              <RowDataItem label="STATUS">
                {b.status === "resolved" ? (
                  <Badge className="bg-green-100 text-green-800">Resolved</Badge>
                ) : (
                  <Badge className="bg-orange-100 text-orange-800">Open</Badge>
                )}
              </RowDataItem>
              <RowDataItem label="RAISED">
                {b.raised_at ? format(new Date(b.raised_at), "MMM d, yyyy") : "—"}
              </RowDataItem>
            </DataRow>
          ))}
        </div>
      )}
    </div>
  );
}

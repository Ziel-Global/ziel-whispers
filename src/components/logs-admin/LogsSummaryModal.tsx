import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getInitials } from "@/lib/utils";

export interface LogsSummaryModalProps {
  modalType: "missed" | "added" | "late" | null;
  onClose: () => void;
  selectedDate: string;
  modalTitle: string;
  modalData: Array<{ userId: string; name: string }>;
}

export function LogsSummaryModal({
  modalType,
  onClose,
  selectedDate,
  modalTitle,
  modalData,
}: LogsSummaryModalProps) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(selectedDate + "T00:00:00"));

  return (
    <Dialog open={!!modalType} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {modalTitle} — {formattedDate}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {modalData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No employees</p>
          ) : (
            <div className="divide-y divide-black/30">
              {modalData.map((emp) => (
                <div key={emp.userId} className="flex items-center gap-3 py-3 px-1">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {getInitials(emp.name)}
                  </div>
                  <span className="text-sm font-medium">{emp.name}</span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

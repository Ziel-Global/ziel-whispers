import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Lock, User, Clock, FileText, ShieldAlert } from "lucide-react";
import { format } from "date-fns";

export interface BlockerDetail {
  id: string;
  description: string;
  created_at: string;
  raised_by_name?: string;
  status: string;
  client_visible?: boolean;
}

interface BlockerAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle?: string;
  blockers: BlockerDetail[];
  actionAttempted?: "status" | "assignee" | "drag" | "log";
}

export function BlockerAlertModal({
  isOpen,
  onClose,
  taskTitle,
  blockers,
  actionAttempted = "status",
}: BlockerAlertModalProps) {
  if (!isOpen) return null;

  const actionText =
    actionAttempted === "assignee"
      ? "reassign this task"
      : actionAttempted === "drag"
      ? "move this task on the board"
      : actionAttempted === "log"
      ? "submit log outcome status"
      : "change status";

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className="max-w-lg border-rose-200 shadow-2xl">
        <AlertDialogHeader className="space-y-3">
          <div className="flex items-center gap-3 text-rose-700">
            <div className="p-2.5 bg-rose-100 rounded-full border border-rose-200 shrink-0">
              <ShieldAlert className="h-6 w-6 text-rose-600" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-bold text-rose-950 flex items-center gap-2">
                Task is Blocked
                <Badge variant="destructive" className="bg-rose-600 text-white text-[10px] uppercase tracking-wider">
                  Locked
                </Badge>
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-rose-800/80 mt-0.5">
                Cannot {actionText} while this task has active blockers.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-3 my-2 max-h-[340px] overflow-y-auto pr-1">
          {taskTitle && (
            <div className="bg-rose-50/70 border border-rose-200/80 rounded-lg p-3">
              <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider block mb-0.5">Target Task</span>
              <p className="text-sm font-medium text-rose-950 leading-snug">{taskTitle}</p>
            </div>
          )}

          <div className="space-y-2.5">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
              Active Blocker Details ({blockers.length})
            </span>

            {blockers.length === 0 ? (
              <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500 italic">
                Active blocker details loading...
              </div>
            ) : (
              blockers.map((b) => (
                <div key={b.id} className="bg-white border border-rose-200 rounded-lg p-3.5 shadow-sm space-y-2.5">
                  <div className="flex items-start gap-2 text-rose-900">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium leading-tight text-gray-900">{b.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100 text-gray-600">
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">Raised by: <strong className="text-gray-800">{b.raised_by_name || "Unknown"}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate justify-end">
                      <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span>{b.created_at ? format(new Date(b.created_at), "MMM d, yyyy") : "—"}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            <Lock className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Resolve all open blockers above to unlock status and assignee edits.</span>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose} className="bg-gray-900 hover:bg-gray-800 text-white rounded-md text-xs font-semibold px-4 py-2">
            Understand & Close
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

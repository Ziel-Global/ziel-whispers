import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { formatHours, MISC_PROJECT_ID } from "@/lib/utils";

export interface EditLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editLog: any;
  editEmpName?: string;
  allProjects: any[];
  categories: string[];
  editProjectId: string | null;
  setEditProjectId: (id: string | null) => void;
  editCategory: string;
  setEditCategory: (cat: string) => void;
  editDescription: string;
  setEditDescription: (desc: string) => void;
  comment: string;
  setComment: (comm: string) => void;
  onSave: (logId: string) => void;
}

export function EditLogModal({
  open,
  onOpenChange,
  editLog,
  editEmpName,
  allProjects,
  categories,
  editProjectId,
  setEditProjectId,
  editCategory,
  setEditCategory,
  editDescription,
  setEditDescription,
  comment,
  setComment,
  onSave,
}: EditLogModalProps) {
  if (!editLog) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Log</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Employee</span>
              <p className="font-medium">{editEmpName || editLog.users?.full_name}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Date</span>
              <p className="font-medium">{format(new Date(editLog.log_date + "T00:00:00"), "MMM d, yyyy")}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Hours</span>
              <p className="font-medium">{formatHours(editLog.hours)}</p>
            </div>
            {editLog.submitted_at && (
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Submitted</span>
                <p className="font-medium">{format(new Date(editLog.submitted_at), "h:mm a")}</p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Description</Label>
            <Textarea
              rows={3}
              placeholder="Log description..."
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Project</Label>
            <Select value={editProjectId || MISC_PROJECT_ID} onValueChange={setEditProjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Category</Label>
            <Select value={editCategory} onValueChange={setEditCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Admin Comment</Label>
            <Textarea
              rows={2}
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => onSave(editLog.id)}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

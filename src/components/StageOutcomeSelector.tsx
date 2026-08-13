import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAllowedTransitions, getStatusColor, getStatusDisplay } from "@/lib/workflow";
import type { WorkflowStatus, WorkflowTransition } from "@/lib/workflow";

interface StageOutcomeSelectorProps {
  taskId: string;
  currentStatusId: string | null;
  workflowStatuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
  onDeclare: (toStatusId: string) => Promise<void>;
  onTargetChange?: (toStatusId: string | null) => void;
  compact?: boolean;
  /** B2-B: the acting user's project_role_id for role-gated transition filtering */
  userRoleId?: string | null;
  /** B2-B: true when the user is a system admin/manager (bypasses role-gating) */
  isSystemAdmin?: boolean;
}

export function StageOutcomeSelector({
  taskId,
  currentStatusId,
  workflowStatuses,
  transitions,
  onDeclare,
  onTargetChange,
  compact = false,
  userRoleId = null,
  isSystemAdmin = false,
}: StageOutcomeSelectorProps) {
  const [declaring, setDeclaring] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState("");

  // B2-A + B2-B: filter out retired destinations and role-gated transitions
  const allowedTransitions = useMemo(
    () => getAllowedTransitions(workflowStatuses, transitions, currentStatusId, userRoleId, isSystemAdmin),
    [currentStatusId, workflowStatuses, transitions, userRoleId, isSystemAdmin]
  );

  useEffect(() => {
    if (allowedTransitions.length === 1) {
      setSelectedStatusId(allowedTransitions[0].id);
    } else {
      setSelectedStatusId("");
    }
  }, [currentStatusId, taskId]);

  useEffect(() => {
    if (!onTargetChange) return;
    const pendingTarget = selectedStatusId || (allowedTransitions.length === 1 ? allowedTransitions[0].id : "");
    onTargetChange(pendingTarget || null);
  }, [selectedStatusId, allowedTransitions, onTargetChange]);

  if (allowedTransitions.length === 0) return null;

  const handleDeclare = async () => {
    const targetId = selectedStatusId || (allowedTransitions.length === 1 ? allowedTransitions[0].id : "");
    if (!targetId) return;
    setDeclaring(true);
    try {
      await onDeclare(targetId);
    } finally {
      setDeclaring(false);
    }
  };

  if (compact) {
    return (
      <div className="border-t pt-3 space-y-2">
        <div>
          <p className="text-sm font-semibold">Move task to next stage</p>
          <p className="text-xs text-muted-foreground">Advance the task when this stage's work is done.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge className={getStatusColor(workflowStatuses, currentStatusId)}>
            {getStatusDisplay(workflowStatuses, currentStatusId).name}
          </Badge>
          <span className="text-muted-foreground">→</span>
          {allowedTransitions.length === 1 ? (
            <>
              <Badge className={getStatusColor(workflowStatuses, allowedTransitions[0].id)}>
                {getStatusDisplay(workflowStatuses, allowedTransitions[0].id).name}
              </Badge>
              <Button size="sm" variant="outline" onClick={handleDeclare} disabled={declaring} className="rounded-button text-xs">
                {declaring ? "Moving..." : `Move to ${getStatusDisplay(workflowStatuses, allowedTransitions[0].id).name}`}
              </Button>
            </>
          ) : (
            <>
              <Select value={selectedStatusId} onValueChange={setSelectedStatusId}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue placeholder="Which stage?" />
                </SelectTrigger>
                <SelectContent>
                  {allowedTransitions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleDeclare} disabled={declaring || !selectedStatusId} className="rounded-button text-xs">
                {declaring ? "Moving..." : "Move"}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <div>
        <p className="text-sm font-semibold">Move task to next stage</p>
        <p className="text-xs text-muted-foreground">Advance the task when this stage's work is done.</p>
      </div>
      <div className="flex items-center gap-3">
        <Badge className={getStatusColor(workflowStatuses, currentStatusId)}>
          {getStatusDisplay(workflowStatuses, currentStatusId).name}
        </Badge>
        <span className="text-muted-foreground">→</span>
        {allowedTransitions.length === 1 ? (
          <Badge className={getStatusColor(workflowStatuses, allowedTransitions[0].id)}>
            {getStatusDisplay(workflowStatuses, allowedTransitions[0].id).name}
          </Badge>
        ) : (
          <Select value={selectedStatusId} onValueChange={setSelectedStatusId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Which stage actually happened?" />
            </SelectTrigger>
            <SelectContent>
              {allowedTransitions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button size="sm" onClick={handleDeclare} disabled={declaring || (allowedTransitions.length > 1 && !selectedStatusId)} className="rounded-button">
          {declaring ? "Moving..." : "Move"}
        </Button>
      </div>
    </div>
  );
}

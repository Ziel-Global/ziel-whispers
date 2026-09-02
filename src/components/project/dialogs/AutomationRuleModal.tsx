import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Calendar as CalendarIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface AutomationRuleModalProps {
  automationRulesOpen: boolean;
  setAutomationRulesOpen: (open: boolean) => void;
  editRuleId: string | null;
    ruleName: string; setRuleName: (v: string) => void;
  ruleDescription: string; setRuleDescription: (v: string) => void;
  ruleStatus: string; setRuleStatus: (v: string) => void;
  ruleTriggerType: string; setRuleTriggerType: (v: string) => void;
  rulePriority: number; setRulePriority: (v: number) => void;
  ruleAllowTriggering: boolean; setRuleAllowTriggering: (v: boolean) => void;
  ruleConditions: any; setRuleConditions: (v: any) => void;
  ruleActions: any; setRuleActions: (v: any) => void;
  saveAutomationRule: (e: React.FormEvent) => void;
  resetRuleForm: () => void;
  workflowStatuses: any[];
  members: any[];
}

export function AutomationRuleModal(props: AutomationRuleModalProps) {
  const [ruleDatePickerOpenIdx, setRuleDatePickerOpenIdx] = useState<number | null>(null);

  const addCondition = () => {
    props.setRuleConditions([...props.ruleConditions, { field: "status_id", operator: "eq", value: "" }]);
  };
  const updateCondition = (index: number, key: string, val: string) => {
    props.setRuleConditions(props.ruleConditions.map((c: any, i: number) => i === index ? { ...c, [key]: val } : c));
  };
  const removeCondition = (index: number) => {
    props.setRuleConditions(props.ruleConditions.filter((_: any, i: number) => i !== index));
  };
  const addAction = () => {
    props.setRuleActions([...props.ruleActions, { type: "change_status", params: {} }]);
  };
  const updateAction = (index: number, key: string, val: any) => {
    props.setRuleActions(props.ruleActions.map((a: any, i: number) => i === index ? { ...a, [key]: val } : a));
  };
  const removeAction = (index: number) => {
    props.setRuleActions(props.ruleActions.filter((_: any, i: number) => i !== index));
  };
  const {
    automationRulesOpen, setAutomationRulesOpen,
    editRuleId,   ruleName, setRuleName,
    ruleDescription, setRuleDescription,
    ruleStatus, setRuleStatus,
    ruleTriggerType, setRuleTriggerType,
    rulePriority, setRulePriority,
    ruleAllowTriggering, setRuleAllowTriggering,
    ruleConditions, setRuleConditions,
    ruleActions, setRuleActions,
    saveAutomationRule, resetRuleForm,
    workflowStatuses, members
  } = props;

  return (
      <Dialog open={automationRulesOpen} onOpenChange={(o) => { if (!o) { resetRuleForm(); } setAutomationRulesOpen(o); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editRuleId ? "Edit Automation Rule" : "Add Automation Rule"}</DialogTitle></DialogHeader>
          <form onSubmit={saveAutomationRule} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ruleName">Name *</Label>
              <Input id="ruleName" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Block critical task on blocker" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ruleDescription">Description *</Label>
              <Textarea id="ruleDescription" value={ruleDescription} onChange={(e) => setRuleDescription(e.target.value)} placeholder="Describe what this rule does" rows={2} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={ruleStatus} onValueChange={setRuleStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trigger</Label>
                <Select value={ruleTriggerType} onValueChange={setRuleTriggerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status_change">Status Change</SelectItem>
                    <SelectItem value="blocker_raised">Blocker Raised</SelectItem>
                    <SelectItem value="blocker_resolved">Blocker Resolved</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rulePriority">Priority (higher = runs first)</Label>
                <Input id="rulePriority" type="number" value={rulePriority} onChange={(e) => setRulePriority(Number(e.target.value))} />
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Switch id="ruleAllowTriggering" checked={ruleAllowTriggering} onCheckedChange={setRuleAllowTriggering} />
                  <Label htmlFor="ruleAllowTriggering" className="text-sm">Allow triggering other rules</Label>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Conditions (all must match)</Label>
                <Button variant="outline" size="sm" onClick={addCondition} type="button">
                  <Plus className="h-4 w-4" /> Add Condition
                </Button>
              </div>
              {ruleConditions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No conditions — rule matches all events.</p>
              ) : (
                ruleConditions.map((cond, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Select value={cond.field} onValueChange={(v) => setRuleConditions(ruleConditions.map((c, i) => i === idx ? { field: v, operator: "eq", value: "" } : c))}>
                      <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="status_id">Task Status</SelectItem>
                        <SelectItem value="priority">Task Priority</SelectItem>
                        <SelectItem value="due_date">Due Date</SelectItem>
                        <SelectItem value="assigned_to">Assigned To</SelectItem>
                        <SelectItem value="description">Task Description</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={cond.operator} onValueChange={(v) => updateCondition(idx, "operator", v)}>
                      <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eq">equals</SelectItem>
                        <SelectItem value="neq">not equals</SelectItem>
                        <SelectItem value="gt">greater than</SelectItem>
                        <SelectItem value="lt">less than</SelectItem>
                        <SelectItem value="contains">contains</SelectItem>
                      </SelectContent>
                    </Select>
                    {cond.field === "status_id" ? (
                      <Select value={cond.value} onValueChange={(v) => updateCondition(idx, "value", v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select status" /></SelectTrigger>
                        <SelectContent>
                          {(workflowStatuses || []).map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : cond.field === "priority" ? (
                      <Select value={cond.value} onValueChange={(v) => updateCondition(idx, "value", v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select priority" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : cond.field === "due_date" ? (
                      <Popover open={ruleDatePickerOpenIdx === idx} onOpenChange={(open) => setRuleDatePickerOpenIdx(open ? idx : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !cond.value && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {cond.value ? format(new Date(cond.value + "T00:00:00"), "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={cond.value ? new Date(cond.value + "T00:00:00") : undefined} onSelect={(d) => { updateCondition(idx, "value", d ? format(d, "yyyy-MM-dd") : ""); setRuleDatePickerOpenIdx(null); }} initialFocus />
                        </PopoverContent>
                      </Popover>
                    ) : cond.field === "assigned_to" ? (
                      <Select value={cond.value} onValueChange={(v) => updateCondition(idx, "value", v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select user" /></SelectTrigger>
                        <SelectContent>
                          {(members || []).map((m: any) => (
                            <SelectItem key={m.user_id} value={m.user_id}>{m.users?.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={cond.value} onChange={(e) => updateCondition(idx, "value", e.target.value)} placeholder="value" className="flex-1" />
                    )}
                    <Button variant="ghost" size="icon" onClick={() => removeCondition(idx)} type="button">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-3">
              <Label>Actions (run in sequence) *</Label>
              {ruleActions.length === 0 && (
                <p className="text-xs text-muted-foreground">No actions yet. Add at least one action.</p>
              )}
              {ruleActions.map((act, idx) => (
                <Card key={idx} className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                      <Select value={act.type} onValueChange={(v) => setActionType(idx, v)}>
                        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="change_status">Change Task Status</SelectItem>
                          <SelectItem value="assign_user">Assign to Member</SelectItem>
                          <SelectItem value="assign_role">Assign to Role</SelectItem>
                          <SelectItem value="add_comment">Add Comment to Task</SelectItem>
                          <SelectItem value="resolve_blocker">Resolve the Blocker</SelectItem>
                          <SelectItem value="reassign_to_stage_owner">Reassign to Stage Owner</SelectItem>
                          <SelectItem value="notify_user">Notify User / Group</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeAction(idx)} type="button">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {act.type === "change_status" && (
                    <Select value={act.params.status_id || ""} onValueChange={(v) => setActionParam(idx, "status_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Select target status" /></SelectTrigger>
                      <SelectContent>
                        {(workflowStatuses || []).map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {act.type === "assign_user" && (
                    <Select value={act.params.user_id || ""} onValueChange={(v) => setActionParam(idx, "user_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                      <SelectContent>
                        {(members || []).map((m: any) => (
                          <SelectItem key={m.user_id} value={m.user_id}>{m.users?.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {act.type === "assign_role" && (
                    <Select value={act.params.role_id || ""} onValueChange={(v) => setActionParam(idx, "role_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        {(projectRoles || []).map((r: any) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {act.type === "add_comment" && (
                    <Textarea value={act.params.body || ""} onChange={(e) => setActionParam(idx, "body", e.target.value)} placeholder="Comment text" rows={2} />
                  )}
                  {act.type === "resolve_blocker" && (
                    <p className="text-xs text-muted-foreground">This action resolves the blocker that triggered the rule. No additional parameters needed.</p>
                  )}
                  {act.type === "reassign_to_stage_owner" && (
                    <div className="space-y-2">
                      <Select value={act.params.status_id || ""} onValueChange={(v) => setActionParam(idx, "status_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Select target status" /></SelectTrigger>
                        <SelectContent>
                          {(workflowStatuses || []).map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={act.params.lookup_by || "from"} onValueChange={(v) => setActionParam(idx, "lookup_by", v)}>
                        <SelectTrigger><SelectValue placeholder="Lookup direction" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="from">Who sent task away from stage (e.g. Original Developer)</SelectItem>
                          <SelectItem value="to">Who last arrived at stage</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={act.params.fallback_role_id || ""} onValueChange={(v) => setActionParam(idx, "fallback_role_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Fallback role (optional)" /></SelectTrigger>
                        <SelectContent>
                          {(projectRoles || []).map((r: any) => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Looks up the previous assignee who held this task at the target status (e.g. the original developer). If none found, falls back to a balanced assignment from the selected role.</p>
                    </div>
                  )}
                  {act.type === "notify_user" && (
                    <div className="space-y-2">
                      <Select value={act.params.recipient || "task_assignee"} onValueChange={(v) => setActionParam(idx, "recipient", v)}>
                        <SelectTrigger><SelectValue placeholder="Select recipient" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="task_assignee">Task Assignee</SelectItem>
                          <SelectItem value="specific_user">Specific User</SelectItem>
                          <SelectItem value="admins_managers">Admins & Managers</SelectItem>
                          <SelectItem value="project_members">All Project Members</SelectItem>
                        </SelectContent>
                      </Select>
                      {act.params.recipient === "specific_user" && (
                        <Select value={act.params.user_id || ""} onValueChange={(v) => setActionParam(idx, "user_id", v)}>
                          <SelectTrigger><SelectValue placeholder="Select user to notify" /></SelectTrigger>
                          <SelectContent>
                            {(members || []).map((m: any) => (
                              <SelectItem key={m.user_id} value={m.user_id}>{m.users?.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Input
                        value={act.params.title || ""}
                        onChange={(e) => setActionParam(idx, "title", e.target.value)}
                        placeholder="Notification Title (e.g., Task Moved to QA)"
                      />
                      <Textarea
                        value={act.params.message_template || ""}
                        onChange={(e) => setActionParam(idx, "message_template", e.target.value)}
                        placeholder="Message Template (Supports {task_title}, {project_name}, {assignee_name})"
                        rows={2}
                      />
                    </div>
                  )}
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={addAction} type="button">
                <Plus className="h-4 w-4" /> Add Action
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { resetRuleForm(); setAutomationRulesOpen(false); }}>Cancel</Button>
              <Button type="submit">{editRuleId ? "Update Rule" : "Create Rule"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
  );
}

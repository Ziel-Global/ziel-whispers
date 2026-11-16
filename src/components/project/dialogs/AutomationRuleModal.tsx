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
import { Plus, Calendar as CalendarIcon, Trash2, X } from "lucide-react";
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
  projectRoles?: any[];
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
  const setActionType = (index: number, type: string) => {
    props.setRuleActions(props.ruleActions.map((a: any, i: number) => i === index ? { type, params: {} } : a));
  };
  const setActionParam = (index: number, key: string, val: any) => {
    props.setRuleActions(props.ruleActions.map((a: any, i: number) => i === index ? { ...a, params: { ...(a.params || {}), [key]: val } } : a));
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
    workflowStatuses, members,
    projectRoles = []
  } = props;

  return (
      <Dialog open={automationRulesOpen} onOpenChange={(o) => { if (!o) { resetRuleForm(); } setAutomationRulesOpen(o); }}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto rounded-[20px] border-black/[0.08] p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-black/[0.06]">
            <DialogTitle className="text-[17px] font-bold text-[#17171A]">
              {editRuleId ? "Edit Automation Rule" : "Create Automation Rule"}
            </DialogTitle>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              Set up an automatic workflow: choose when it starts, what conditions must match, and what actions to take.
            </p>
          </DialogHeader>
          <form onSubmit={saveAutomationRule} className="space-y-6 px-6 py-5">
            {/* Section 1: Basic Info & Trigger */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ruleName" className="text-[13px] font-semibold text-[#17171A]">Rule Name *</Label>
                <Input
                  id="ruleName"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g., Return task to original developer when sent back from QA"
                  required
                  className="rounded-[10px] border-black/10 text-[13.5px] shadow-none"
                />
                <p className="text-[11.5px] text-muted-foreground">
                  A short, clear name so your team can easily recognize this rule.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ruleDescription" className="text-[13px] font-semibold text-[#17171A]">Description *</Label>
                <Textarea
                  id="ruleDescription"
                  value={ruleDescription}
                  onChange={(e) => setRuleDescription(e.target.value)}
                  placeholder="e.g., When QA moves a task back to Development, automatically assign it to the developer who worked on it before."
                  rows={2}
                  required
                  className="rounded-[10px] border-black/10 text-[13.5px] shadow-none resize-y"
                />
                <p className="text-[11.5px] text-muted-foreground">
                  Briefly explain what this rule does and why it exists.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-semibold text-[#17171A]">Rule Status</Label>
                  <Select value={ruleStatus} onValueChange={setRuleStatus}>
                    <SelectTrigger className="rounded-[10px] border-black/10 shadow-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft (Saved, not active)</SelectItem>
                      <SelectItem value="enabled">Enabled (Active)</SelectItem>
                      <SelectItem value="disabled">Disabled (Paused)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11.5px] text-muted-foreground">
                    Only Enabled rules run automatically.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[13px] font-semibold text-[#17171A]">When Should This Rule Run? (Trigger)</Label>
                  <Select value={ruleTriggerType} onValueChange={setRuleTriggerType}>
                    <SelectTrigger className="rounded-[10px] border-black/10 shadow-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="status_change">When a task's status changes</SelectItem>
                      <SelectItem value="blocker_raised">When a blocker is reported</SelectItem>
                      <SelectItem value="blocker_resolved">When a blocker is resolved</SelectItem>
                      <SelectItem value="scheduled">On a recurring schedule</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11.5px] text-muted-foreground">
                    The event that starts checking this rule.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Execution Settings */}
            <div className="rounded-[12px] border border-black/[0.08] bg-[#FAFAFB] p-4 space-y-4">
              <div>
                <h4 className="text-[13px] font-semibold text-[#17171A]">Execution Settings</h4>
                <p className="text-[11.5px] text-muted-foreground">Control rule order and whether this rule can trigger others.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label htmlFor="rulePriority" className="text-[12.5px] font-medium text-[#4B4B52]">Execution Order (Priority)</Label>
                  <Input
                    id="rulePriority"
                    type="number"
                    value={rulePriority}
                    onChange={(e) => setRulePriority(Number(e.target.value))}
                    className="rounded-[10px] border-black/10 bg-white shadow-none"
                  />
                  <p className="text-[11.5px] text-muted-foreground">
                    Higher numbers run first if multiple rules match at once (default: 0).
                  </p>
                </div>

                <div className="space-y-1.5 sm:pt-1">
                  <Label htmlFor="ruleAllowTriggering" className="text-[12.5px] font-medium text-[#4B4B52] block">Chain Other Rules</Label>
                  <div className="flex items-center gap-2.5 rounded-[10px] border border-black/[0.08] bg-white px-3 py-2">
                    <Switch
                      id="ruleAllowTriggering"
                      checked={ruleAllowTriggering}
                      onCheckedChange={setRuleAllowTriggering}
                      className="data-[state=checked]:bg-[#EB5A1E]"
                    />
                    <span className="text-[12.5px] text-[#4B4B52]">Allow triggering other rules</span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground">
                    Turn on if changes made by this rule should also trigger other rules.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Conditions */}
            <div className="space-y-3 pt-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="text-[13px] font-semibold text-[#17171A]">Conditions (Only run if all match)</Label>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    Filter which tasks this rule applies to. If no conditions are added, it runs for every matching trigger.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addCondition} type="button" className="shrink-0 rounded-[10px] border-black/10">
                  <Plus className="h-4 w-4 mr-1" /> Add Condition
                </Button>
              </div>
              {ruleConditions.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-black/10 bg-[#FAFAFB] px-4 py-3 text-xs text-muted-foreground">
                  No conditions set — this rule will run on every matching event.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {ruleConditions.map((cond, idx) => (
                    <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-[10px] border border-black/[0.08] bg-[#FAFAFB] p-2.5">
                      <Select value={cond.field} onValueChange={(v) => setRuleConditions(ruleConditions.map((c, i) => i === idx ? { field: v, operator: "eq", value: "" } : c))}>
                        <SelectTrigger className="w-[160px] bg-white rounded-[8px] border-black/10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="status_id">Task Status</SelectItem>
                          <SelectItem value="priority">Task Priority</SelectItem>
                          <SelectItem value="due_date">Due Date</SelectItem>
                          <SelectItem value="assigned_to">Assigned To</SelectItem>
                          <SelectItem value="description">Task Description</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={cond.operator} onValueChange={(v) => updateCondition(idx, "operator", v)}>
                        <SelectTrigger className="w-[130px] bg-white rounded-[8px] border-black/10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eq">equals</SelectItem>
                          <SelectItem value="neq">does not equal</SelectItem>
                          <SelectItem value="gt">is after / greater than</SelectItem>
                          <SelectItem value="lt">is before / less than</SelectItem>
                          <SelectItem value="contains">contains</SelectItem>
                        </SelectContent>
                      </Select>
                      {cond.field === "status_id" ? (
                        <Select value={cond.value || undefined} onValueChange={(v) => updateCondition(idx, "value", v)}>
                          <SelectTrigger className="flex-1 bg-white rounded-[8px] border-black/10"><SelectValue placeholder="Choose task status" /></SelectTrigger>
                          <SelectContent>
                            {(workflowStatuses || []).length === 0 ? (
                              <SelectItem value="__none__" disabled>No statuses available</SelectItem>
                            ) : (
                              (workflowStatuses || []).map((s: any) => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      ) : cond.field === "priority" ? (
                        <Select value={cond.value} onValueChange={(v) => updateCondition(idx, "value", v)}>
                          <SelectTrigger className="flex-1 bg-white rounded-[8px] border-black/10"><SelectValue placeholder="Choose priority" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : cond.field === "due_date" ? (
                        <Popover open={ruleDatePickerOpenIdx === idx} onOpenChange={(open) => setRuleDatePickerOpenIdx(open ? idx : null)}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal bg-white rounded-[8px] border-black/10", !cond.value && "text-muted-foreground")}>
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
                          <SelectTrigger className="flex-1 bg-white rounded-[8px] border-black/10"><SelectValue placeholder="Choose team member" /></SelectTrigger>
                          <SelectContent>
                            {(members || []).map((m: any) => (
                              <SelectItem key={m.user_id} value={m.user_id}>{m.users?.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={cond.value} onChange={(e) => updateCondition(idx, "value", e.target.value)} placeholder="Enter text to match" className="flex-1 bg-white rounded-[8px] border-black/10" />
                      )}
                      <Button variant="ghost" size="icon" onClick={() => removeCondition(idx)} type="button" title="Remove condition">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Actions */}
            <div className="space-y-3 pt-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="text-[13px] font-semibold text-[#17171A]">Actions (What should happen automatically) *</Label>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    Add one or more actions to perform in order from top to bottom when the conditions match.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addAction} type="button" className="shrink-0 rounded-[10px] border-black/10">
                  <Plus className="h-4 w-4 mr-1" /> Add Action
                </Button>
              </div>
              {ruleActions.length === 0 && (
                <div className="rounded-[10px] border border-dashed border-black/10 bg-[#FAFAFB] px-4 py-3 text-xs text-muted-foreground">
                  No actions added yet. Click <strong>Add Action</strong> to choose what this rule should do.
                </div>
              )}
              {ruleActions.map((act, idx) => (
                <Card key={idx} className="p-4 rounded-[12px] border-black/[0.08] bg-[#FAFAFB] shadow-none space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/[0.06]">
                    <div className="flex items-center gap-2.5 flex-1">
                      <span className="inline-flex items-center justify-center h-6 px-2 rounded-full bg-black/[0.06] text-[11px] font-semibold text-[#4B4B52]">
                        Step #{idx + 1}
                      </span>
                      <Select value={act.type} onValueChange={(v) => setActionType(idx, v)}>
                        <SelectTrigger className="w-[240px] bg-white rounded-[8px] border-black/10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="change_status">Change Task Status</SelectItem>
                          <SelectItem value="assign_user">Assign to Specific Member</SelectItem>
                          <SelectItem value="assign_role">Assign to Team Role</SelectItem>
                          <SelectItem value="reassign_to_stage_owner">Reassign to Previous Stage Owner</SelectItem>
                          <SelectItem value="add_comment">Add Comment to Task</SelectItem>
                          <SelectItem value="resolve_blocker">Resolve the Blocker</SelectItem>
                          <SelectItem value="notify_user">Send a Notification</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeAction(idx)} type="button" title="Remove action">
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>

                  {act.type === "change_status" && (
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-[#4B4B52]">New Task Status</Label>
                      <Select value={act.params.status_id || undefined} onValueChange={(v) => setActionParam(idx, "status_id", v)}>
                        <SelectTrigger className="bg-white rounded-[8px] border-black/10"><SelectValue placeholder="Choose the status to move the task to" /></SelectTrigger>
                        <SelectContent>
                          {(workflowStatuses || []).length === 0 ? (
                            <SelectItem value="__none__" disabled>No statuses available</SelectItem>
                          ) : (
                            (workflowStatuses || []).map((s: any) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-[11.5px] text-muted-foreground">The task will automatically move to this stage.</p>
                    </div>
                  )}

                  {act.type === "assign_user" && (
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-[#4B4B52]">Assign Task To</Label>
                      <Select value={act.params.user_id || ""} onValueChange={(v) => setActionParam(idx, "user_id", v)}>
                        <SelectTrigger className="bg-white rounded-[8px] border-black/10"><SelectValue placeholder="Choose a team member" /></SelectTrigger>
                        <SelectContent>
                          {(members || []).map((m: any) => (
                            <SelectItem key={m.user_id} value={m.user_id}>{m.users?.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11.5px] text-muted-foreground">The task will always be assigned to this person.</p>
                    </div>
                  )}

                  {act.type === "assign_role" && (
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-[#4B4B52]">Assign to Team Role</Label>
                      <Select value={act.params.role_id || undefined} onValueChange={(v) => setActionParam(idx, "role_id", v)}>
                        <SelectTrigger className="bg-white rounded-[8px] border-black/10"><SelectValue placeholder="Choose a project role" /></SelectTrigger>
                        <SelectContent>
                          {(projectRoles || []).length === 0 ? (
                            <SelectItem value="__none__" disabled>No roles available</SelectItem>
                          ) : (
                            (projectRoles || []).map((r: any) => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-[11.5px] text-muted-foreground">
                        Automatically assigns the task to the member in this role with the fewest active tasks.
                      </p>
                    </div>
                  )}

                  {act.type === "add_comment" && (
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-[#4B4B52]">Comment Message</Label>
                      <Textarea
                        value={act.params.body || ""}
                        onChange={(e) => setActionParam(idx, "body", e.target.value)}
                        placeholder="Write the comment to post on the task..."
                        rows={2}
                        className="bg-white rounded-[8px] border-black/10"
                      />
                      <p className="text-[11.5px] text-muted-foreground">Posted automatically as a system comment on the task.</p>
                    </div>
                  )}

                  {act.type === "resolve_blocker" && (
                    <p className="text-xs text-muted-foreground bg-white rounded-[8px] border border-black/[0.06] p-2.5">
                      Automatically marks the blocker that triggered this rule as resolved. No extra settings needed.
                    </p>
                  )}

                  {act.type === "reassign_to_stage_owner" && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-[#4B4B52]">Stage to Look Up</Label>
                        <Select value={act.params.status_id || undefined} onValueChange={(v) => setActionParam(idx, "status_id", v)}>
                          <SelectTrigger className="bg-white rounded-[8px] border-black/10"><SelectValue placeholder="Choose the stage (e.g., Development)" /></SelectTrigger>
                          <SelectContent>
                            {(workflowStatuses || []).length === 0 ? (
                              <SelectItem value="__none__" disabled>No statuses available</SelectItem>
                            ) : (
                              (workflowStatuses || []).map((s: any) => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-[11.5px] text-muted-foreground">
                          The stage whose previous owner you want to restore (for example, Development).
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-[#4B4B52]">Which Person to Pick</Label>
                        <Select value={act.params.lookup_by || undefined} onValueChange={(v) => setActionParam(idx, "lookup_by", v)}>
                          <SelectTrigger className="bg-white rounded-[8px] border-black/10"><SelectValue placeholder="Choose an option" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="from">Person who sent the task out of this stage (e.g., Original Developer)</SelectItem>
                            <SelectItem value="to">Person who most recently arrived at this stage</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[11.5px] text-muted-foreground">
                          Usually you want the person who sent the task away from that stage (such as the developer who sent it to QA).
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-[#4B4B52]">Backup Role (Optional)</Label>
                        <Select value={act.params.fallback_role_id || ""} onValueChange={(v) => setActionParam(idx, "fallback_role_id", v)}>
                          <SelectTrigger className="bg-white rounded-[8px] border-black/10"><SelectValue placeholder="Choose a backup role if no history exists" /></SelectTrigger>
                          <SelectContent>
                            {(projectRoles || []).map((r: any) => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11.5px] text-muted-foreground">
                          If no previous owner is found in task history, the task is assigned to someone in this role instead.
                        </p>
                      </div>
                    </div>
                  )}

                  {act.type === "notify_user" && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-[#4B4B52]">Who Should Be Notified</Label>
                        <Select value={act.params.recipient || "task_assignee"} onValueChange={(v) => setActionParam(idx, "recipient", v)}>
                          <SelectTrigger className="bg-white rounded-[8px] border-black/10"><SelectValue placeholder="Choose who receives this notification" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="task_assignee">Current Task Assignee</SelectItem>
                            <SelectItem value="specific_user">A Specific Team Member</SelectItem>
                            <SelectItem value="admins_managers">Admins & Project Managers</SelectItem>
                            <SelectItem value="project_members">All Project Members</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {act.params.recipient === "specific_user" && (
                        <div className="space-y-1.5">
                          <Label className="text-[12px] font-medium text-[#4B4B52]">Select Team Member</Label>
                          <Select value={act.params.user_id || ""} onValueChange={(v) => setActionParam(idx, "user_id", v)}>
                            <SelectTrigger className="bg-white rounded-[8px] border-black/10"><SelectValue placeholder="Choose user to notify" /></SelectTrigger>
                            <SelectContent>
                              {(members || []).map((m: any) => (
                                <SelectItem key={m.user_id} value={m.user_id}>{m.users?.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-[#4B4B52]">Notification Title</Label>
                        <Input
                          value={act.params.title || ""}
                          onChange={(e) => setActionParam(idx, "title", e.target.value)}
                          placeholder="e.g., Task Moved to QA"
                          className="bg-white rounded-[8px] border-black/10"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-medium text-[#4B4B52]">Notification Message</Label>
                        <Textarea
                          value={act.params.message_template || ""}
                          onChange={(e) => setActionParam(idx, "message_template", e.target.value)}
                          placeholder="e.g., {task_title} in {project_name} is now assigned to {assignee_name}."
                          rows={2}
                          className="bg-white rounded-[8px] border-black/10"
                        />
                        <p className="text-[11.5px] text-muted-foreground">
                          Optional placeholders: <code>{"{task_title}"}</code>, <code>{"{project_name}"}</code>, <code>{"{assignee_name}"}</code>.
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
            <DialogFooter className="px-0 pt-2 pb-1 gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { resetRuleForm(); setAutomationRulesOpen(false); }}
                className="rounded-[10px] border-black/10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-[10px] bg-[#EB5A1E] text-white hover:bg-[#d64f18]"
              >
                {editRuleId ? "Save Rule" : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
  );
}

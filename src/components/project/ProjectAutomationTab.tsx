import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export interface ProjectAutomationTabProps {
  automationRules: any[];
  openAddRule: () => void;
  openEditRule: (rule: any) => void;
  toggleRuleStatus: (id: string, checked: boolean) => void;
  setDeleteRuleConfirmId: (id: string | null) => void;
}

export function ProjectAutomationTab({
  automationRules,
  openAddRule,
  openEditRule,
  toggleRuleStatus,
  setDeleteRuleConfirmId,
}: ProjectAutomationTabProps) {
  return (
    <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Automation Rules</h3>
              <Button onClick={openAddRule}><Plus className="h-4 w-4" /> Add Rule</Button>
            </div>
            {automationRules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No automation rules yet. Create rules to automate project workflows.</p>
            ) : (
              <div className="space-y-3">
                {automationRules.map((rule: any) => (
                  <Card key={rule.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold">{rule.name}</h4>
                          <Badge variant="outline">{rule.trigger_type.replace(/_/g, " ")}</Badge>
                          <Badge variant={rule.status === "enabled" ? "default" : "secondary"}>{rule.status}</Badge>
                        </div>
                        {rule.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{rule.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">Priority: {rule.priority} &middot; {rule.allow_triggering_other_rules ? "Chainable" : "No chaining"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={rule.status === "enabled"} onCheckedChange={(c) => toggleRuleStatus(rule.id, c)} />
                        <Button variant="ghost" size="icon" onClick={() => openEditRule(rule)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteRuleConfirmId(rule.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
    </>
  );
}

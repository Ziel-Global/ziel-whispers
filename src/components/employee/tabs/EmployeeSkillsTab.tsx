import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { SkillProficiencyBadge, SkillProgressBar } from "@/components/skills/SkillProficiencyBadge";
import { useSkillMetricsData } from "@/hooks/useSkillMetricsData";
import { ProficiencyLevel, PROFICIENCY_MAP } from "@/types/skills";
import { Plus, Trash2, Award, CheckCircle2 } from "lucide-react";

export interface EmployeeSkillsTabProps {
  userId: string;
  isAdmin: boolean;
  isOwnProfile: boolean;
}

export function EmployeeSkillsTab({ userId, isAdmin, isOwnProfile }: EmployeeSkillsTabProps) {
  const {
    allSkills,
    employeeSkills,
    loadingEmployeeSkills,
    skillEvaluations,
    updateEmployeeSkill,
    removeEmployeeSkill,
    submitEvaluation,
  } = useSkillMetricsData({ userId });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<ProficiencyLevel>(3);
  const [evalComment, setEvalComment] = useState("");

  const canManage = isAdmin || isOwnProfile;

  const handleSaveSkill = async () => {
    if (!selectedSkillId) return;
    await updateEmployeeSkill(userId, selectedSkillId, selectedLevel);
    if (isAdmin && evalComment.trim()) {
      await submitEvaluation(userId, selectedSkillId, selectedLevel, evalComment);
    }
    setAddModalOpen(false);
    setSelectedSkillId("");
    setSelectedLevel(3);
    setEvalComment("");
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> Skill Matrix & Proficiencies
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Track technical, domain, and soft skills with verified proficiency metrics (Level 1–5).
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setAddModalOpen(true)} className="rounded-button gap-1 shrink-0">
              <Plus className="h-4 w-4" /> Add / Update Skill
            </Button>
          )}
        </div>
      </Card>

      {/* Skills Grid */}
      {loadingEmployeeSkills ? (
        <Card className="p-8 text-center text-muted-foreground">Loading skills…</Card>
      ) : employeeSkills.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground bg-muted/20 border-2 border-dashed">
          <Award className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="font-medium">No Skills Recorded Yet</p>
          <p className="text-xs mt-1">Click "Add / Update Skill" above to assign skills to this profile.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employeeSkills.map((es) => {
            const skillObj = es.skills || allSkills.find((s) => s.id === es.skill_id);
            const level = es.proficiency_level;
            const isVerified = skillEvaluations.some((ev) => ev.skill_id === es.skill_id);

            return (
              <Card key={es.id} className="p-5 space-y-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-base text-foreground">{skillObj?.name || "Skill"}</h4>
                      <Badge variant="outline" className="text-[10px]">{skillObj?.category || "Technical"}</Badge>
                      {isVerified ? (
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] flex items-center gap-1 font-medium">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Admin Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] text-muted-foreground font-normal">
                          Self-Assessed
                        </Badge>
                      )}
                    </div>
                    {skillObj?.description && (
                      <p className="text-xs text-muted-foreground mt-1">{skillObj.description}</p>
                    )}
                  </div>

                  {canManage && (
                    <button
                      onClick={() => removeEmployeeSkill(userId, es.skill_id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remove Skill"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <SkillProficiencyBadge level={level} showStars showDescription={false} />
                  </div>
                  <SkillProgressBar level={level} />
                </div>

                {canManage && (
                  <div className="pt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">Adjust Level:</span>
                    <Select
                      value={String(level)}
                      onValueChange={(val) => updateEmployeeSkill(userId, es.skill_id, Number(val) as ProficiencyLevel)}
                    >
                      <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {([1, 2, 3, 4, 5] as ProficiencyLevel[]).map((lvl) => (
                          <SelectItem key={lvl} value={String(lvl)}>
                            L{lvl}: {PROFICIENCY_MAP[lvl].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Skill Evaluations History */}
      {skillEvaluations.length > 0 && (
        <Card className="p-6 space-y-4">
          <h4 className="font-semibold text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Verified Skill Evaluations
          </h4>
          <div className="divide-y divide-border">
            {skillEvaluations.map((ev) => (
              <div key={ev.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{ev.skills?.name || "Skill"}</span>
                    <SkillProficiencyBadge level={ev.score} showStars={false} size="sm" />
                  </div>
                  {ev.comments && <p className="text-xs text-muted-foreground mt-1">"{ev.comments}"</p>}
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  by {ev.evaluator?.full_name || "Admin"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add / Update Skill Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add or Update Skill</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Skill *</Label>
              <Select value={selectedSkillId} onValueChange={setSelectedSkillId}>
                <SelectTrigger><SelectValue placeholder="Choose a skill..." /></SelectTrigger>
                <SelectContent>
                  {allSkills.map((sk) => (
                    <SelectItem key={sk.id} value={sk.id}>
                      {sk.name} ({sk.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Proficiency Level *</Label>
              <Select value={String(selectedLevel)} onValueChange={(val) => setSelectedLevel(Number(val) as ProficiencyLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {([1, 2, 3, 4, 5] as ProficiencyLevel[]).map((lvl) => (
                    <SelectItem key={lvl} value={String(lvl)}>
                      Level {lvl} — {PROFICIENCY_MAP[lvl].label}: {PROFICIENCY_MAP[lvl].description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-medium">Admin Evaluation Note (Optional)</Label>
                <Input
                  placeholder="e.g. Verified through recent project deliverable"
                  value={evalComment}
                  onChange={(e) => setEvalComment(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSkill} disabled={!selectedSkillId} className="rounded-button">
              Save Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

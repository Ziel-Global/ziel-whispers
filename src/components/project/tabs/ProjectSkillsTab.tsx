import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SkillProficiencyBadge } from "@/components/skills/SkillProficiencyBadge";
import { ResourceRecommendationModal } from "@/components/skills/ResourceRecommendationModal";
import { useSkillMetricsData } from "@/hooks/useSkillMetricsData";
import { ProficiencyLevel, PROFICIENCY_MAP } from "@/types/skills";
import { Sparkles, Plus, Trash2, Zap, CheckCircle2 } from "lucide-react";

export interface ProjectSkillsTabProps {
  projectId: string;
  projectName: string;
  isAdmin: boolean;
  onAssignCandidate?: (userId: string) => Promise<void>;
}

export function ProjectSkillsTab({
  projectId,
  projectName,
  isAdmin,
  onAssignCandidate,
}: ProjectSkillsTabProps) {
  const {
    allSkills,
    projectRequirements,
    loadingProjectRequirements,
    recommendations,
    addProjectRequirement,
    removeProjectRequirement,
  } = useSkillMetricsData({ projectId });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [recommendationModalOpen, setRecommendationModalOpen] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<ProficiencyLevel>(3);

  const handleAddRequirement = async () => {
    if (!selectedSkillId) return;
    await addProjectRequirement(projectId, selectedSkillId, selectedLevel);
    setAddModalOpen(false);
    setSelectedSkillId("");
    setSelectedLevel(3);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <Card className="p-6 bg-gradient-to-r from-primary/5 via-background to-amber-500/5 border-primary/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500 fill-amber-500" /> Project Skill Requirements
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Define the required technical and domain skills for <strong>{projectName}</strong> to power candidate match scoring.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <Button onClick={() => setAddModalOpen(true)} variant="outline" className="gap-1">
                <Plus className="h-4 w-4" /> Add Required Skill
              </Button>
            )}
            <Button
              onClick={() => setRecommendationModalOpen(true)}
              disabled={projectRequirements.length === 0}
              className="gap-1.5 rounded-button bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
            >
              <Sparkles className="h-4 w-4 fill-white" /> Find Recommended Resources
            </Button>
          </div>
        </div>
      </Card>

      {/* Project Required Skills List */}
      <Card className="p-6 space-y-4">
        <h4 className="font-semibold text-base">Required Skill Profiles ({projectRequirements.length})</h4>

        {loadingProjectRequirements ? (
          <div className="py-8 text-center text-muted-foreground">Loading requirements…</div>
        ) : projectRequirements.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
            <p className="font-medium">No Required Skills Added</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add target skills to enable automated resource recommendations for this project.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projectRequirements.map((req) => {
              const skillObj = req.skills || allSkills.find((s) => s.id === req.skill_id);

              return (
                <div key={req.id} className="p-4 border rounded-lg bg-card flex items-start justify-between gap-3 hover:border-primary/40 transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{skillObj?.name || "Skill"}</span>
                      <Badge variant="outline" className="text-[10px]">{skillObj?.category || "Technical"}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Target:</span>
                      <SkillProficiencyBadge level={req.required_proficiency_level} showStars size="sm" />
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => removeProjectRequirement(projectId, req.skill_id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remove Requirement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recommended Candidates Snapshot Preview */}
      {projectRequirements.length > 0 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Candidate Recommendation Snapshot
            </h4>
            <Button variant="link" size="sm" onClick={() => setRecommendationModalOpen(true)} className="text-xs">
              View Full Ranked Candidates →
            </Button>
          </div>

          {recommendations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Evaluating candidate metrics…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {recommendations.slice(0, 3).map((cand) => (
                <div key={cand.userId} className="p-3 border rounded-lg bg-muted/20 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-xs truncate">{cand.fullName}</p>
                    <p className="text-[10px] text-muted-foreground">{cand.department} · {cand.activeProjectsCount} active projects</p>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-bold text-xs shrink-0">
                    {cand.compositeMatchScore}% Match
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Add Skill Requirement Dialog */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Project Required Skill</DialogTitle>
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
              <Label className="text-sm font-medium">Target Required Proficiency *</Label>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRequirement} disabled={!selectedSkillId} className="rounded-button">
              Add Requirement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resource Recommendation Engine Modal */}
      <ResourceRecommendationModal
        open={recommendationModalOpen}
        onOpenChange={setRecommendationModalOpen}
        projectId={projectId}
        projectName={projectName}
        onAssignCandidate={onAssignCandidate}
      />
    </div>
  );
}

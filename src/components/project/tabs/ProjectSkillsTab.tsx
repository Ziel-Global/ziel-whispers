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

  const dialogs = (
    <>
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Project Required Skill</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Skill *</Label>
              <Select value={selectedSkillId} onValueChange={setSelectedSkillId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a skill..." />
                </SelectTrigger>
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
              <Select
                value={String(selectedLevel)}
                onValueChange={(val) => setSelectedLevel(Number(val) as ProficiencyLevel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddRequirement}
              disabled={!selectedSkillId}
              className="rounded-[10px] bg-[#EB5A1E] text-white hover:bg-[#d64f18]"
            >
              Add Requirement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResourceRecommendationModal
        open={recommendationModalOpen}
        onOpenChange={setRecommendationModalOpen}
        projectId={projectId}
        projectName={projectName}
        onAssignCandidate={onAssignCandidate}
      />
    </>
  );

  if (isAdmin) {
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[18px] font-bold text-[#17171A]">Skills</div>
            <p className="text-[12.5px] text-[#8B8B92] mt-1 max-w-xl">
              Define required skills for <span className="font-semibold text-[#4B4B52]">{projectName}</span>{" "}
              to power candidate match scoring.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-[7px] bg-[#EB5A1E] text-white font-semibold text-[13px] px-4 py-[9px] rounded-[10px] hover:bg-[#d64f18] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
              Add Required Skill
            </button>
            <button
              type="button"
              onClick={() => setRecommendationModalOpen(true)}
              disabled={projectRequirements.length === 0}
              className="inline-flex items-center gap-[7px] border border-black/[0.08] bg-white text-[#4B4B52] font-semibold text-[13px] px-4 py-[9px] rounded-[10px] hover:bg-[#F6F5F3] transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#EB5A1E]" strokeWidth={2} />
              Find Recommended Resources
            </button>
          </div>
        </div>

        <div className="bg-white border border-black/[0.08] rounded-[14px] p-5">
          <div className="text-[15px] font-bold text-[#17171A] mb-4">
            Required Skill Profiles ({projectRequirements.length})
          </div>

          {loadingProjectRequirements ? (
            <p className="text-[13px] text-[#8B8B92] py-8 text-center">Loading requirements…</p>
          ) : projectRequirements.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-black/[0.1] rounded-[12px] bg-[#FAFAFB]">
              <p className="text-[14px] font-semibold text-[#17171A]">No required skills added</p>
              <p className="text-[12.5px] text-[#8B8B92] mt-1 max-w-sm mx-auto">
                Add target skills to enable automated resource recommendations for this project.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projectRequirements.map((req) => {
                const skillObj = req.skills || allSkills.find((s) => s.id === req.skill_id);
                return (
                  <div
                    key={req.id}
                    className="p-[18px] bg-white border border-black/[0.08] rounded-[14px] flex items-start justify-between gap-3 hover:border-[#EB5A1E]/35 transition-colors"
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[14px] text-[#17171A]">
                          {skillObj?.name || "Skill"}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F6F5F3] text-[#6B6B72]">
                          {skillObj?.category || "Technical"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-[#8B8B92]">Target:</span>
                        <SkillProficiencyBadge
                          level={req.required_proficiency_level}
                          showStars
                          size="sm"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProjectRequirement(projectId, req.skill_id)}
                      className="w-[30px] h-[30px] rounded-lg bg-[#FDECEC] flex items-center justify-center shrink-0"
                      title="Remove Requirement"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#E5484D]" strokeWidth={2} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {projectRequirements.length > 0 && (
          <div className="bg-white border border-black/[0.08] rounded-[14px] p-5">
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <div className="text-[15px] font-bold text-[#17171A] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#1B8A46]" strokeWidth={2} />
                Candidate Recommendation Snapshot
              </div>
              <button
                type="button"
                onClick={() => setRecommendationModalOpen(true)}
                className="text-[12.5px] font-semibold text-[#EB5A1E] hover:underline"
              >
                View Full Ranked Candidates →
              </button>
            </div>

            {recommendations.length === 0 ? (
              <p className="text-[13px] text-[#8B8B92] text-center py-4">Evaluating candidate metrics…</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {recommendations.slice(0, 3).map((cand) => (
                  <div
                    key={cand.userId}
                    className="p-3.5 border border-black/[0.08] rounded-[12px] bg-[#FAFAFB] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[13px] text-[#17171A] truncate">{cand.fullName}</p>
                      <p className="text-[11px] text-[#8B8B92]">
                        {cand.department} · {cand.activeProjectsCount} active projects
                      </p>
                    </div>
                    <span className="bg-[#DFF6E4] text-[#1B8A46] font-bold text-[11px] px-2 py-1 rounded-full shrink-0">
                      {cand.compositeMatchScore}% Match
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {dialogs}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-r from-primary/5 via-background to-amber-500/5 border-primary/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500 fill-amber-500" /> Project Skill Requirements
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Define the required technical and domain skills for <strong>{projectName}</strong> to
              power candidate match scoring.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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

      <Card className="p-6 space-y-4">
        <h4 className="font-semibold text-base">
          Required Skill Profiles ({projectRequirements.length})
        </h4>

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
                <div
                  key={req.id}
                  className="p-4 border rounded-lg bg-card flex items-start justify-between gap-3 hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {skillObj?.name || "Skill"}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {skillObj?.category || "Technical"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Target:</span>
                      <SkillProficiencyBadge
                        level={req.required_proficiency_level}
                        showStars
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {projectRequirements.length > 0 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Candidate Recommendation Snapshot
            </h4>
            <Button
              variant="link"
              size="sm"
              onClick={() => setRecommendationModalOpen(true)}
              className="text-xs"
            >
              View Full Ranked Candidates →
            </Button>
          </div>

          {recommendations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Evaluating candidate metrics…
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {recommendations.slice(0, 3).map((cand) => (
                <div
                  key={cand.userId}
                  className="p-3 border rounded-lg bg-muted/20 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-xs truncate">{cand.fullName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {cand.department} · {cand.activeProjectsCount} active projects
                    </p>
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

      {dialogs}
    </div>
  );
}

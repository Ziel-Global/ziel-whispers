import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSkillMetricsData } from "@/hooks/useSkillMetricsData";
import { getAvatarUrl } from "@/lib/utils";
import { Sparkles, CheckCircle2, AlertTriangle, UserPlus, Zap } from "lucide-react";

export interface ResourceRecommendationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onAssignCandidate?: (userId: string) => Promise<void>;
}

export function ResourceRecommendationModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  onAssignCandidate,
}: ResourceRecommendationModalProps) {
  const { recommendations, loadingRecommendations, projectRequirements } = useSkillMetricsData({ projectId });
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const handleAssign = async (userId: string) => {
    if (!onAssignCandidate) return;
    setAssigningId(userId);
    try {
      await onAssignCandidate(userId);
      onOpenChange(false);
    } finally {
      setAssigningId(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500 text-white";
    if (score >= 60) return "bg-blue-500 text-white";
    if (score >= 40) return "bg-amber-500 text-white";
    return "bg-gray-400 text-white";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Resource Recommendation Engine
          </DialogTitle>
          <DialogDescription>
            Smart candidate scoring for <strong>{projectName}</strong> based on required skills, candidate bandwidth, and role compatibility.
          </DialogDescription>
        </DialogHeader>

        {projectRequirements.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground bg-muted/30 rounded-lg border-2 border-dashed">
            <Zap className="h-8 w-8 mx-auto mb-2 text-amber-500" />
            <p className="font-medium">No Skill Requirements Defined</p>
            <p className="text-xs mt-1">Add required skills in the Project Skills tab to activate the recommendation engine.</p>
          </div>
        ) : loadingRecommendations ? (
          <div className="py-12 text-center text-muted-foreground">Evaluating candidates…</div>
        ) : recommendations.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No matching candidates found.</div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((cand, idx) => (
              <Card key={cand.userId} className="p-4 transition-all hover:border-primary/50 relative overflow-hidden">
                {idx === 0 && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-bl">
                    ★ Best Match
                  </div>
                )}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <Avatar className="h-12 w-12 border shrink-0">
                      <AvatarImage src={getAvatarUrl(cand.avatarUrl)} />
                      <AvatarFallback className="bg-muted font-bold text-xs">{cand.fullName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-base text-foreground">{cand.fullName}</h4>
                        <Badge variant="outline" className="text-xs capitalize">{cand.role}</Badge>
                        <Badge variant="secondary" className="text-xs">{cand.department}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{cand.email}</p>

                      {/* Sub scores */}
                      <div className="flex items-center gap-4 text-xs mt-2 text-muted-foreground flex-wrap">
                        <span>Skills: <strong className="text-foreground">{cand.skillMatchScore}%</strong></span>
                        <span>Bandwidth: <strong className="text-foreground">{cand.bandwidthScore}%</strong> ({cand.activeProjectsCount} active projects)</span>
                        <span>Role Align: <strong className="text-foreground">{cand.roleAlignmentScore}%</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                    <div className="text-center">
                      <div className={`text-lg font-extrabold px-3 py-1 rounded-full ${getScoreColor(cand.compositeMatchScore)}`}>
                        {cand.compositeMatchScore}%
                      </div>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">Match Score</span>
                    </div>

                    {onAssignCandidate && (
                      <Button
                        size="sm"
                        disabled={assigningId === cand.userId}
                        onClick={() => handleAssign(cand.userId)}
                        className="gap-1 rounded-button"
                      >
                        <UserPlus className="h-4 w-4" />
                        {assigningId === cand.userId ? "Assigning..." : "Assign"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Skill Details Expansion */}
                <div className="mt-3 pt-3 border-t grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-semibold text-emerald-700 flex items-center gap-1 mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Matched Skills ({cand.matchedSkills.length})
                    </span>
                    {cand.matchedSkills.length === 0 ? (
                      <p className="text-muted-foreground text-[11px]">None</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {cand.matchedSkills.map((m) => (
                          <Badge key={m.skillId} variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200">
                            {m.skillName} (L{m.actualLevel}/{m.requiredLevel})
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="font-semibold text-amber-700 flex items-center gap-1 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Missing / Gap Skills ({cand.missingSkills.length})
                    </span>
                    {cand.missingSkills.length === 0 ? (
                      <p className="text-emerald-600 text-[11px] font-medium">Full skill coverage!</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {cand.missingSkills.map((m) => (
                          <Badge key={m.skillId} variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                            {m.skillName} (L{m.actualLevel}/{m.requiredLevel})
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

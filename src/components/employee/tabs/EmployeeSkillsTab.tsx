/**
 * Admin user-detail — Skills tab (ud-* Skill Matrix from zielAdmin mock).
 *
 * IMPLEMENTED (wired via useSkillMetricsData):
 *   - Matrix card + 2-col skill grid (L# pill, 5 segments, proficiency foot)
 *   - KPI row: Technical / Domain / Soft / Verified (derived)
 *   - Add Skill dialog → updateEmployeeSkill (+ optional admin evaluation)
 *
 * BEYOND MOCK (kept extras):
 *   - Compact delete + level adjust on each skill card
 *   - Verified Skill Evaluations history below KPIs
 *
 * DEFERRED: page header chrome; other user-detail tabs
 */
import { useMemo, useState } from "react";
import { formatDistanceToNow, format, parseISO, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSkillMetricsData } from "@/hooks/useSkillMetricsData";
import { ProficiencyLevel, PROFICIENCY_MAP, SkillCategory } from "@/types/skills";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmployeeSkillsTabProps {
  userId: string;
  isAdmin: boolean;
  isOwnProfile: boolean;
}

function categoryLabel(cat?: string) {
  if (cat === "Soft Skill") return "Soft Skills";
  return cat || "Technical";
}

function isTechnicalCategory(cat?: string) {
  return cat === "Technical" || cat === "Tools" || !cat;
}

function formatUpdated(iso?: string) {
  if (!iso) return "—";
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return "—";
    const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (days < 7) return formatDistanceToNow(d, { addSuffix: true });
    return format(d, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

function SkillSegments({ level }: { level: number }) {
  return (
    <div className="flex gap-1 mt-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="h-[5px] flex-1 rounded"
          style={{ background: i <= level ? "#EB5A1E" : "#EAE9E7" }}
        />
      ))}
    </div>
  );
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

  const enriched = useMemo(() => {
    return employeeSkills.map((es) => {
      const skillObj = es.skills || allSkills.find((s) => s.id === es.skill_id);
      const isVerified = skillEvaluations.some((ev) => ev.skill_id === es.skill_id);
      return { es, skillObj, isVerified, category: (skillObj?.category || "Technical") as SkillCategory };
    });
  }, [employeeSkills, allSkills, skillEvaluations]);

  const kpis = useMemo(() => {
    const technical = enriched.filter((e) => isTechnicalCategory(e.category));
    const domain = enriched.filter((e) => e.category === "Domain");
    const soft = enriched.filter((e) => e.category === "Soft Skill");
    const verifiedCount = enriched.filter((e) => e.isVerified).length;
    const total = enriched.length;

    const techAvg =
      technical.length > 0
        ? technical.reduce((s, e) => s + e.es.proficiency_level, 0) / technical.length
        : 0;

    return {
      technicalCount: technical.length,
      techAvg: techAvg ? techAvg.toFixed(1) : "—",
      domainCount: domain.length,
      domainSub: domain[0]?.skillObj?.name || "—",
      softCount: soft.length,
      softSub: soft[0]?.skillObj?.name || "—",
      verifiedLabel: total === 0 ? "0/0" : `${verifiedCount}/${total}`,
      verifiedPct: total === 0 ? 0 : Math.round((verifiedCount / total) * 100),
    };
  }, [enriched]);

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
    <div className="flex flex-col gap-4 w-full min-w-0">
      {/* Matrix card */}
      <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px] min-w-0">
        <div className="flex items-start justify-between gap-3.5 mb-[17px] flex-wrap">
          <div className="min-w-0">
            <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">
              Skill Matrix & Proficiencies
            </div>
            <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px]">
              Verified technical, domain and soft skills on a 1–5 scale.
            </div>
          </div>
          {canManage && (
            <Button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="h-[38px] rounded-[9px] px-3.5 bg-[#EB5A1E] hover:bg-[#C64715] text-white text-[12px] font-semibold gap-1.5 shrink-0"
            >
              <Plus className="h-[13px] w-[13px]" />
              Add Skill
            </Button>
          )}
        </div>

        {loadingEmployeeSkills ? (
          <div className="py-10 text-center text-[12px] text-[#8B8B92]">Loading skills…</div>
        ) : employeeSkills.length === 0 ? (
          <div className="py-10 px-4 text-center border border-dashed border-[#D8D8DD] rounded-xl bg-[#FCFCFD]">
            <div className="text-[11px] font-bold text-[#66666D]">No skills recorded yet</div>
            <div className="text-[10px] text-[#9A9AA0] mt-1">
              {canManage ? 'Click "Add Skill" to assign skills to this profile.' : "No skills on this profile yet."}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {enriched.map(({ es, skillObj, isVerified, category }) => {
              const level = es.proficiency_level;
              return (
                <div
                  key={es.id}
                  className="border border-black/[0.08] rounded-xl p-3.5 bg-white min-w-0"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-[#2F2F34] truncate">
                        {skillObj?.name || "Skill"}
                      </div>
                      <div className="text-[10.5px] text-[#929298] mt-0.5">
                        {categoryLabel(category)} · {isVerified ? "Verified" : "Self assessed"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* BEYOND MOCK: remove */}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => removeEmployeeSkill(userId, es.skill_id)}
                          className="w-7 h-7 rounded-lg border border-black/[0.08] flex items-center justify-center text-[#C23A3A] hover:bg-[#FDECEC]"
                          title="Remove skill"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <div className="min-w-[30px] h-7 rounded-lg bg-[#FDECE3] text-[#B84A1D] flex items-center justify-center text-[10.5px] font-extrabold px-1.5">
                        L{level}
                      </div>
                    </div>
                  </div>

                  <SkillSegments level={level} />

                  <div className="flex justify-between gap-2 text-[10px] text-[#96969C] mt-2">
                    <span>Proficiency {level}/5</span>
                    <span>{formatUpdated(es.updated_at)}</span>
                  </div>

                  {/* BEYOND MOCK: inline level adjust */}
                  {canManage && (
                    <div className="pt-2.5 mt-2.5 border-t border-black/[0.06] flex items-center justify-between gap-2">
                      <span className="text-[10px] text-[#96969C]">Adjust level</span>
                      <Select
                        value={String(level)}
                        onValueChange={(val) =>
                          updateEmployeeSkill(userId, es.skill_id, Number(val) as ProficiencyLevel)
                        }
                      >
                        <SelectTrigger className="h-7 w-[148px] text-[11px] rounded-lg border-black/10 bg-[#FBFBFA]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {([1, 2, 3, 4, 5] as ProficiencyLevel[]).map((lvl) => (
                            <SelectItem key={lvl} value={String(lvl)} className="text-[11px]">
                              L{lvl}: {PROFICIENCY_MAP[lvl].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* KPI row — derived */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
          <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Technical Skills</div>
          <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
            {kpis.technicalCount}
          </div>
          <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">
            {kpis.techAvg === "—" ? "No technical skills yet" : `Average level ${kpis.techAvg}`}
          </div>
        </div>
        <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
          <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Domain Skills</div>
          <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
            {kpis.domainCount}
          </div>
          <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug truncate">{kpis.domainSub}</div>
        </div>
        <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
          <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Soft Skills</div>
          <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
            {kpis.softCount}
          </div>
          <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug truncate">{kpis.softSub}</div>
        </div>
        <div className="bg-white border border-black/[0.08] rounded-[13px] p-[15px] min-w-0">
          <div className="text-[10.5px] text-[#8B8B92] font-medium truncate">Verified</div>
          <div className="text-[22px] font-bold tracking-[-0.45px] text-[#17171A] mt-1">
            {kpis.verifiedLabel}
          </div>
          <div className="text-[10px] text-[#A0A0A7] mt-1 leading-snug">
            {kpis.verifiedPct}% verification coverage
          </div>
        </div>
      </div>

      {/* BEYOND MOCK: evaluations history */}
      {skillEvaluations.length > 0 && (
        <section className="bg-white border border-black/[0.08] rounded-[14px] p-[18px]">
          <div className="text-[14px] font-bold tracking-[-0.15px] text-[#252529]">
            Verified Skill Evaluations
          </div>
          <div className="text-[11.5px] text-[#8B8B92] leading-normal mt-[3px] mb-3.5">
            Admin-submitted verification notes for this employee.
          </div>
          <div className="flex flex-col">
            {skillEvaluations.map((ev, idx) => (
              <div
                key={ev.id}
                className={cn(
                  "flex items-start justify-between gap-4 py-3",
                  idx < skillEvaluations.length - 1 && "border-b border-black/[0.055]"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px] font-semibold text-[#2F2F34]">
                      {ev.skills?.name || "Skill"}
                    </span>
                    <span className="min-w-[28px] h-6 px-1.5 rounded-md bg-[#FDECE3] text-[#B84A1D] inline-flex items-center justify-center text-[10px] font-extrabold">
                      L{ev.score}
                    </span>
                  </div>
                  {ev.comments && (
                    <p className="text-[10.5px] text-[#8B8B92] mt-1 leading-snug">"{ev.comments}"</p>
                  )}
                </div>
                <span className="text-[10px] text-[#96969C] whitespace-nowrap shrink-0">
                  by {ev.evaluator?.full_name || "Admin"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add / Update Skill Modal — wired (mock was toast-only) */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md rounded-[13px] border-black/[0.075] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-black/[0.06]">
            <DialogTitle className="text-[15px] font-bold text-[#17171A]">Add or Update Skill</DialogTitle>
          </DialogHeader>

          <div className="px-5 py-4 space-y-3.5">
            <div>
              <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">
                Select Skill
              </div>
              <Select value={selectedSkillId} onValueChange={setSelectedSkillId}>
                <SelectTrigger className="h-9 text-[12px]">
                  <SelectValue placeholder="Choose a skill…" />
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

            <div>
              <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">
                Proficiency Level
              </div>
              <Select
                value={String(selectedLevel)}
                onValueChange={(val) => setSelectedLevel(Number(val) as ProficiencyLevel)}
              >
                <SelectTrigger className="h-9 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {([1, 2, 3, 4, 5] as ProficiencyLevel[]).map((lvl) => (
                    <SelectItem key={lvl} value={String(lvl)}>
                      Level {lvl} — {PROFICIENCY_MAP[lvl].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <div>
                <div className="text-[9px] font-semibold text-[#A0A0A7] mb-1 uppercase tracking-wide">
                  Admin Evaluation Note (Optional)
                </div>
                <Input
                  placeholder="e.g. Verified through recent project deliverable"
                  value={evalComment}
                  onChange={(e) => setEvalComment(e.target.value)}
                  className="h-9 text-[12px]"
                />
              </div>
            )}
          </div>

          <DialogFooter className="px-5 py-3.5 border-t border-black/[0.06] sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setAddModalOpen(false)} className="h-9 text-[12px]">
              Cancel
            </Button>
            <Button
              onClick={handleSaveSkill}
              disabled={!selectedSkillId}
              className="h-9 text-[12px] rounded-[10px] bg-[#EB5A1E] hover:bg-[#C64715] text-white"
            >
              Save Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

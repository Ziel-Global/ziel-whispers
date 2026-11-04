import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { detectSpofSkills } from "@/lib/spofEngine";
import { useSkillMetricsData } from "@/hooks/useSkillMetricsData";
import { AlertTriangle, ShieldCheck, CheckCircle2, UserCheck, Wrench } from "lucide-react";

export function SkillsStaffingSection() {
  const { allSkills } = useSkillMetricsData();

  // Fetch Users
  const { data: users = [] } = useQuery({
    queryKey: ["skills-sec-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, role, department, designation, status")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch Employee Skills
  const { data: employeeSkills = [] } = useQuery({
    queryKey: ["skills-sec-emp-skills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_skills" as any)
        .select("user_id, skill_id, proficiency_level");
      if (error || !data) return [];
      return data as { user_id: string; skill_id: string; proficiency_level: number }[];
    },
  });

  // SPOF Alerts
  const spofAlerts = useMemo(() => {
    return detectSpofSkills(allSkills, employeeSkills, users);
  }, [allSkills, employeeSkills, users]);

  return (
    <Card className="p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Skills Staffing & Redundancy Analysis (SPOF)
            </h3>
            <p className="text-xs text-muted-foreground">
              Critical capabilities with only one expert practitioner and recommended cross-training
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {allSkills.length} Skills Tracked
          </Badge>
          <Badge
            variant={spofAlerts.length > 0 ? "destructive" : "outline"}
            className="text-xs font-semibold"
          >
            {spofAlerts.length} SPOF Risks
          </Badge>
        </div>
      </div>

      {spofAlerts.length === 0 ? (
        <div className="py-6 text-center space-y-1.5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto" />
          <p className="text-xs font-semibold text-foreground">Operational Skills Redundancy Met</p>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            Every required skill has two or more practitioners across active project teams.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {spofAlerts.slice(0, 3).map((spof) => (
            <div
              key={spof.skillId}
              className="p-3 rounded-lg border border-rose-200/80 bg-rose-50/20 dark:bg-rose-950/10 dark:border-rose-900/40 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">{spof.skillName}</span>
                <Badge variant="outline" className="text-[9px] text-rose-600 border-rose-300 font-bold uppercase">
                  Level {spof.proficiencyLevel}
                </Badge>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Sole Expert: <strong className="text-foreground">{spof.soleExpertName}</strong>
              </p>

              <div className="pt-1.5 border-t border-rose-200/40 text-[10px] text-muted-foreground">
                Recommended Cross-Train:{" "}
                <span className="font-medium text-foreground">
                  {spof.recommendedCrossTrainUsers.slice(0, 2).map((u) => u.fullName).join(", ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}


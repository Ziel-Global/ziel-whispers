import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsBreadcrumbs, BreadcrumbSegment } from "@/components/analytics/AnalyticsBreadcrumbs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { detectSpofSkills, SpofSkillAlert } from "@/lib/spofEngine";
import { useSkillMetricsData } from "@/hooks/useSkillMetricsData";
import {
  Wrench,
  AlertTriangle,
  UserCheck,
  Briefcase,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export default function SkillsStaffingDashboardPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // 1. Fetch Skills Dictionary
  const { allSkills } = useSkillMetricsData();

  // 2. Fetch Projects
  const { data: projects = [] } = useQuery({
    queryKey: ["skills-staffing-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const activeProjectId = selectedProjectId || projects[0]?.id || "";

  // 3. Fetch Users
  const { data: users = [] } = useQuery({
    queryKey: ["skills-staffing-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, role, department, designation, status, avatar_url")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // 4. Fetch Employee Skills
  const { data: employeeSkills = [] } = useQuery({
    queryKey: ["skills-staffing-emp-skills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_skills" as any)
        .select("user_id, skill_id, proficiency_level");
      if (error || !data) return [];
      return data as { user_id: string; skill_id: string; proficiency_level: number }[];
    },
  });

  // 5. Fetch Project Requirements
  const { data: projectRequirements = [] } = useQuery({
    queryKey: ["skills-staffing-reqs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_skill_requirements" as any)
        .select("project_id, skill_id, required_proficiency_level, projects (name)");
      if (error || !data) return [];
      return data as any[];
    },
  });

  // 6. Detect SPOF Alerts
  const spofAlerts: SpofSkillAlert[] = useMemo(() => {
    return detectSpofSkills(allSkills, employeeSkills, users, projectRequirements);
  }, [allSkills, employeeSkills, users, projectRequirements]);

  // Use the recommendation engine from useSkillMetricsData for the selected project
  const { recommendations, projectRequirements: activeReqs } = useSkillMetricsData({
    projectId: activeProjectId,
  });

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: "Executive Control Room", href: "/analytics" },
    { label: "Skills Matching & Bench Staffing", level: "company" },
  ];

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto w-full pb-16">
      {/* 1. Header Toolbar & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="space-y-1">
          <AnalyticsBreadcrumbs segments={breadcrumbs} />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Skills-Based Staffing & Bench Matcher
          </h1>
          <p className="text-xs text-muted-foreground">
            Algorithmic resource matching, bench utilization, and Single Point of Failure (SPOF) mitigation
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="outline" className="text-xs font-semibold py-1 px-2.5">
            {allSkills.length} Verified Skills in Taxonomy
          </Badge>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold tracking-tight uppercase text-muted-foreground">
              Tracked Skills
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {allSkills.length}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">Technical, Tools & Domain</p>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Wrench className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold tracking-tight uppercase text-rose-600 dark:text-rose-400">
              SPOF Vulnerabilities
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {spofAlerts.length}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">Critical skills with 1 expert</p>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold tracking-tight uppercase text-emerald-600 dark:text-emerald-400">
              Active Staff Pool
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {users.length}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">Available for assignment</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* 3. Single Point of Failure (SPOF) Early Warning Panel */}
      <Card className="p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Single Point of Failure (SPOF) Risk Registry
              </h3>
              <p className="text-xs text-muted-foreground">
                Critical capabilities possessed by only 1 employee with suggested cross-training partners
              </p>
            </div>
          </div>

          <Badge variant={spofAlerts.length > 0 ? "destructive" : "outline"} className="text-xs font-semibold">
            {spofAlerts.length} Identified
          </Badge>
        </div>

        {spofAlerts.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-foreground">Zero SPOF Vulnerabilities</p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Every critical skill has at least 2 qualified practitioners for operational redundancy.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {spofAlerts.map((spof) => (
              <div
                key={spof.skillId}
                className="p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/20 dark:bg-rose-950/10 dark:border-rose-900/40 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-xs">{spof.skillName}</span>
                  <Badge variant="outline" className="text-[9px] uppercase font-bold text-rose-600 border-rose-300">
                    Level {spof.proficiencyLevel} Sole Expert
                  </Badge>
                </div>

                <div className="text-[11px] text-muted-foreground space-y-1">
                  <p>
                    Sole Practitioner: <strong className="text-foreground">{spof.soleExpertName}</strong>
                  </p>
                  {spof.activeProjectsAffected.length > 0 && (
                    <p>
                      Projects at Risk:{" "}
                      <span className="text-rose-600 font-semibold">
                        {spof.activeProjectsAffected.join(", ")}
                      </span>
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-rose-200/50 dark:border-rose-900/30 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Cross-Train Candidates:</span>
                  <span className="font-medium text-foreground">
                    {spof.recommendedCrossTrainUsers.map((u) => u.fullName).join(", ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 4. Automated Bench Resource Recommender for Open Projects */}
      <Card className="p-5 bg-card border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Smart Staffing & Bench Matcher
              </h3>
              <p className="text-xs text-muted-foreground">
                Matches project skill requirements with available bench candidates (60% Skill + 30% Bandwidth + 10% Role)
              </p>
            </div>
          </div>

          <div className="w-56">
            <Select value={activeProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {recommendations.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No specific skill requirements configured for this project yet.
          </div>
        ) : (
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {recommendations.map((rec, idx) => (
              <div
                key={rec.userId}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-black/[0.015] px-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="font-mono text-xs font-bold text-muted-foreground w-6">
                    #{idx + 1}
                  </div>
                  <Avatar className="h-8 w-8 text-xs">
                    <AvatarImage src={rec.avatarUrl || undefined} alt={rec.fullName} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {rec.fullName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground truncate">{rec.fullName}</span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {rec.department}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {rec.matchedSkills.length} skills matched • {rec.activeProjectsCount} active assignments
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                  <div className="text-right">
                    <div className="flex items-baseline gap-1 justify-end">
                      <span className="text-base font-bold font-mono text-primary">
                        {rec.compositeMatchScore}%
                      </span>
                      <span className="text-[10px] text-muted-foreground">fit</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Skill: {rec.skillMatchScore}% | Bandwidth: {rec.bandwidthScore}%
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => toast.success(`Allocation request initiated for ${rec.fullName}`)}
                    className="h-7 text-xs font-semibold px-2.5"
                  >
                    Assign Staff
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}


import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Skill,
  EmployeeSkill,
  ProjectSkillRequirement,
  SkillEvaluation,
  ProficiencyLevel,
  SkillCategory,
  ResourceRecommendation,
  SkillMatchDetail,
} from "@/types/skills";

// Fallback seed skills in case database tables are newly created or empty
const SEED_SKILLS: Skill[] = [
  { id: "sk-1", name: "React.js / Frontend", category: "Technical", description: "UI Component design, state management & React hooks." },
  { id: "sk-2", name: "Node.js / Express", category: "Technical", description: "REST API development & backend architecture." },
  { id: "sk-3", name: "PostgreSQL / SQL", category: "Technical", description: "Database schema design, queries, and optimization." },
  { id: "sk-4", name: "TypeScript", category: "Technical", description: "Static typing, generics, and strict TypeScript patterns." },
  { id: "sk-5", name: "UI/UX Design & Figma", category: "Tools", description: "Wireframing, prototyping, and design systems." },
  { id: "sk-6", name: "Project Management", category: "Domain", description: "Agile, Scrum, sprint planning, and task tracking." },
  { id: "sk-7", name: "SQA & Automated Testing", category: "Technical", description: "Test automation, E2E testing, and QA validation." },
  { id: "sk-8", name: "Communication & Leadership", category: "Soft Skill", description: "Client handling, team mentorship, and collaboration." },
];

export function useSkillMetricsData(options?: { userId?: string; projectId?: string }) {
  const { profile: myProfile } = useAuth();
  const queryClient = useQueryClient();
  const { userId, projectId } = options || {};

  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 1. All Skills Dictionary Query
  const { data: allSkills = [], isLoading: loadingSkills } = useQuery<Skill[]>({
    queryKey: ["skills-dictionary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skills" as any)
        .select("*")
        .order("name");
      if (error || !data || data.length === 0) {
        return SEED_SKILLS;
      }
      return data as Skill[];
    },
  });

  // 2. Employee Skills Query (for a specific employee)
  const { data: employeeSkills = [], isLoading: loadingEmployeeSkills } = useQuery<EmployeeSkill[]>({
    queryKey: ["employee-skills", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("employee_skills" as any)
        .select("*, skills(*)")
        .eq("user_id", userId);
      if (error || !data) return [];
      return data as EmployeeSkill[];
    },
    enabled: !!userId,
  });

  // 3. Project Skill Requirements Query (for a specific project)
  const { data: projectRequirements = [], isLoading: loadingProjectRequirements } = useQuery<ProjectSkillRequirement[]>({
    queryKey: ["project-skill-requirements", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_skill_requirements" as any)
        .select("*, skills(*)")
        .eq("project_id", projectId);
      if (error || !data) return [];
      return data as ProjectSkillRequirement[];
    },
    enabled: !!projectId,
  });

  // 4. Skill Evaluations Query (for an employee)
  const { data: skillEvaluations = [] } = useQuery<SkillEvaluation[]>({
    queryKey: ["skill-evaluations", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("skill_evaluations" as any)
        .select("*, skills(*), evaluator:users!skill_evaluations_evaluator_id_fkey(full_name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error || !data) return [];
      return data as SkillEvaluation[];
    },
    enabled: !!userId,
  });

  // 5. All Active Employees & Project Memberships (for Smart Recommendation Engine)
  const { data: recommendations = [], isLoading: loadingRecommendations } = useQuery<ResourceRecommendation[]>({
    queryKey: ["resource-recommendations", projectId, projectRequirements],
    queryFn: async () => {
      if (!projectId || projectRequirements.length === 0) return [];

      // Fetch active employees
      const { data: employees } = await supabase
        .from("users")
        .select("id, full_name, email, role, department, avatar_url")
        .eq("status", "active")
        .neq("role", "client member");

      if (!employees || employees.length === 0) return [];

      // Fetch all employee skills
      const { data: allEmpSkills } = await supabase
        .from("employee_skills" as any)
        .select("user_id, skill_id, proficiency_level, skills(*)");

      // Fetch active project memberships to calculate bandwidth
      const { data: activeMemberships } = await supabase
        .from("project_members")
        .select("user_id, project_id")
        .is("removed_at", null);

      const empSkillsMap: Record<string, Record<string, { level: ProficiencyLevel; skill: Skill }>> = {};
      (allEmpSkills || []).forEach((es: any) => {
        empSkillsMap[es.user_id] = empSkillsMap[es.user_id] || {};
        empSkillsMap[es.user_id][es.skill_id] = {
          level: es.proficiency_level as ProficiencyLevel,
          skill: es.skills as Skill,
        };
      });

      const activeProjectsCountMap: Record<string, number> = {};
      (activeMemberships || []).forEach((m: any) => {
        activeProjectsCountMap[m.user_id] = (activeProjectsCountMap[m.user_id] || 0) + 1;
      });

      // Calculate candidate scores
      const totalReqWeight = projectRequirements.reduce((sum, req) => sum + (req.required_proficiency_level || 3), 0);

      const ranked: ResourceRecommendation[] = employees.map((emp) => {
        const empSkills = empSkillsMap[emp.id] || {};
        const matchedSkills: SkillMatchDetail[] = [];
        const missingSkills: SkillMatchDetail[] = [];
        let totalAchievedSkillLevel = 0;

        projectRequirements.forEach((req) => {
          const empSkillInfo = empSkills[req.skill_id];
          const actualLevel = empSkillInfo?.level || 0;
          const requiredLevel = req.required_proficiency_level;
          const skillName = req.skills?.name || "Required Skill";
          const category = (req.skills?.category || "Technical") as SkillCategory;
          const meets = actualLevel >= requiredLevel;

          const detail: SkillMatchDetail = {
            skillId: req.skill_id,
            skillName,
            category,
            requiredLevel,
            actualLevel: actualLevel as ProficiencyLevel,
            meetsRequirement: meets,
          };

          if (meets) {
            matchedSkills.push(detail);
          } else {
            missingSkills.push(detail);
          }

          totalAchievedSkillLevel += Math.min(actualLevel, requiredLevel);
        });

        // 1. Skill Match Score (0 - 100%)
        const skillMatchScore = totalReqWeight > 0
          ? Math.round((totalAchievedSkillLevel / totalReqWeight) * 100)
          : 100;

        // 2. Bandwidth Score (0 - 100%)
        const activeCount = activeProjectsCountMap[emp.id] || 0;
        const bandwidthScore = Math.max(0, 100 - activeCount * 25);

        // 3. Role Alignment Score (0 - 100%)
        const isEngOrDesign = ["Engineering", "Design", "SQA"].includes(emp.department || "");
        const roleAlignmentScore = isEngOrDesign ? 100 : 70;

        // Composite Match Score: 60% Skill + 30% Bandwidth + 10% Role Alignment
        const compositeMatchScore = Math.round(
          0.6 * skillMatchScore + 0.3 * bandwidthScore + 0.1 * roleAlignmentScore
        );

        return {
          userId: emp.id,
          fullName: emp.full_name,
          email: emp.email,
          role: emp.role,
          department: emp.department || "Other",
          avatarUrl: emp.avatar_url,
          compositeMatchScore,
          skillMatchScore,
          bandwidthScore,
          roleAlignmentScore,
          activeProjectsCount: activeCount,
          matchedSkills,
          missingSkills,
        };
      });

      return ranked.sort((a, b) => b.compositeMatchScore - a.compositeMatchScore);
    },
    enabled: !!projectId && projectRequirements.length > 0,
  });

  // --- Mutations ---

  const addSkillToDictionary = async (name: string, category: SkillCategory, description?: string) => {
    try {
      const { error } = await supabase.from("skills" as any).insert({
        name: name.trim(),
        category,
        description: description?.trim() || null,
      });
      if (error) throw error;
      toast.success(`Skill "${name}" added to dictionary.`);
      queryClient.invalidateQueries({ queryKey: ["skills-dictionary"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to add skill.");
    }
  };

  const updateEmployeeSkill = async (targetUserId: string, skillId: string, level: ProficiencyLevel) => {
    try {
      let validSkillId = skillId;
      if (skillId.startsWith("sk-")) {
        const seed = SEED_SKILLS.find((s) => s.id === skillId);
        if (seed) {
          const { data: existingSkill } = await supabase
            .from("skills" as any)
            .select("id")
            .eq("name", seed.name)
            .maybeSingle();

          if (existingSkill?.id) {
            validSkillId = existingSkill.id;
          } else {
            const { data: newSkill, error: seedErr } = await supabase
              .from("skills" as any)
              .insert({ name: seed.name, category: seed.category, description: seed.description })
              .select("id")
              .single();
            if (seedErr) throw seedErr;
            validSkillId = newSkill.id;
          }
        }
      }

      const { error } = await supabase.from("employee_skills" as any).upsert(
        {
          user_id: targetUserId,
          skill_id: validSkillId,
          proficiency_level: level,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,skill_id" }
      );
      if (error) {
        if (error.message.includes("schema cache") || error.code === "42P01") {
          toast.error("Database table 'employee_skills' not found. Please run the SQL migration script in your Supabase SQL Editor.", { duration: 7000 });
          return;
        }
        throw error;
      }
      toast.success("Skill proficiency updated.");
      queryClient.invalidateQueries({ queryKey: ["employee-skills", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["skills-dictionary"] });
      queryClient.invalidateQueries({ queryKey: ["resource-recommendations"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update skill.");
    }
  };

  const removeEmployeeSkill = async (targetUserId: string, skillId: string) => {
    try {
      const { error } = await supabase
        .from("employee_skills" as any)
        .delete()
        .eq("user_id", targetUserId)
        .eq("skill_id", skillId);
      if (error) throw error;
      toast.success("Skill removed.");
      queryClient.invalidateQueries({ queryKey: ["employee-skills", targetUserId] });
      queryClient.invalidateQueries({ queryKey: ["resource-recommendations"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to remove skill.");
    }
  };

  const addProjectRequirement = async (targetProjectId: string, skillId: string, requiredLevel: ProficiencyLevel) => {
    try {
      let validSkillId = skillId;
      if (skillId.startsWith("sk-")) {
        const seed = SEED_SKILLS.find((s) => s.id === skillId);
        if (seed) {
          const { data: existingSkill } = await supabase
            .from("skills" as any)
            .select("id")
            .eq("name", seed.name)
            .maybeSingle();

          if (existingSkill?.id) {
            validSkillId = existingSkill.id;
          } else {
            const { data: newSkill, error: seedErr } = await supabase
              .from("skills" as any)
              .insert({ name: seed.name, category: seed.category, description: seed.description })
              .select("id")
              .single();
            if (seedErr) throw seedErr;
            validSkillId = newSkill.id;
          }
        }
      }

      const { error } = await supabase.from("project_skill_requirements" as any).upsert(
        {
          project_id: targetProjectId,
          skill_id: validSkillId,
          required_proficiency_level: requiredLevel,
        },
        { onConflict: "project_id,skill_id" }
      );
      if (error) {
        if (error.message.includes("schema cache") || error.code === "42P01") {
          toast.error("Database table 'project_skill_requirements' not found. Please run the SQL migration script in your Supabase SQL Editor.", { duration: 7000 });
          return;
        }
        throw error;
      }
      toast.success("Project skill requirement added.");
      queryClient.invalidateQueries({ queryKey: ["project-skill-requirements", targetProjectId] });
      queryClient.invalidateQueries({ queryKey: ["skills-dictionary"] });
      queryClient.invalidateQueries({ queryKey: ["resource-recommendations"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to add requirement.");
    }
  };

  const removeProjectRequirement = async (targetProjectId: string, skillId: string) => {
    try {
      const { error } = await supabase
        .from("project_skill_requirements" as any)
        .delete()
        .eq("project_id", targetProjectId)
        .eq("skill_id", skillId);
      if (error) throw error;
      toast.success("Skill requirement removed.");
      queryClient.invalidateQueries({ queryKey: ["project-skill-requirements", targetProjectId] });
      queryClient.invalidateQueries({ queryKey: ["resource-recommendations"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to remove requirement.");
    }
  };

  const submitEvaluation = async (targetUserId: string, skillId: string, score: ProficiencyLevel, comments?: string) => {
    try {
      const { error } = await supabase.from("skill_evaluations" as any).insert({
        user_id: targetUserId,
        skill_id: skillId,
        evaluator_id: myProfile?.id,
        score,
        comments: comments?.trim() || null,
      });
      if (error) throw error;
      toast.success("Skill evaluation submitted.");
      queryClient.invalidateQueries({ queryKey: ["skill-evaluations", targetUserId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit evaluation.");
    }
  };

  const filteredSkills = useMemo(() => {
    return allSkills.filter((s) => {
      const matchCat = filterCategory === "all" || s.category === filterCategory;
      const matchSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allSkills, filterCategory, searchQuery]);

  return {
    allSkills,
    filteredSkills,
    loadingSkills,
    employeeSkills,
    loadingEmployeeSkills,
    projectRequirements,
    loadingProjectRequirements,
    skillEvaluations,
    recommendations,
    loadingRecommendations,
    filterCategory,
    setFilterCategory,
    searchQuery,
    setSearchQuery,
    addSkillToDictionary,
    updateEmployeeSkill,
    removeEmployeeSkill,
    addProjectRequirement,
    removeProjectRequirement,
    submitEvaluation,
  };
}

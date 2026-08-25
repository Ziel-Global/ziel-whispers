export type SkillCategory = "Technical" | "Soft Skill" | "Domain" | "Tools";

export type ProficiencyLevel = 1 | 2 | 3 | 4 | 5;

export interface ProficiencyInfo {
  level: ProficiencyLevel;
  label: string;
  description: string;
  color: string;
  bgLight: string;
}

export const PROFICIENCY_MAP: Record<ProficiencyLevel, ProficiencyInfo> = {
  1: {
    level: 1,
    label: "Beginner",
    description: "Basic conceptual understanding; requires guidance.",
    color: "text-amber-700 border-amber-300",
    bgLight: "bg-amber-50 text-amber-800",
  },
  2: {
    level: 2,
    label: "Intermediate",
    description: "Can execute routine tasks independently.",
    color: "text-blue-700 border-blue-300",
    bgLight: "bg-blue-50 text-blue-800",
  },
  3: {
    level: 3,
    label: "Advanced",
    description: "Strong working capability; handles complex scenarios.",
    color: "text-indigo-700 border-indigo-300",
    bgLight: "bg-indigo-50 text-indigo-800",
  },
  4: {
    level: 4,
    label: "Expert",
    description: "Deep domain knowledge; mentors and guides team.",
    color: "text-purple-700 border-purple-300",
    bgLight: "bg-purple-50 text-purple-800",
  },
  5: {
    level: 5,
    label: "Master",
    description: "Industry expert; sets architecture and strategy.",
    color: "text-emerald-700 border-emerald-300",
    bgLight: "bg-emerald-50 text-emerald-800",
  },
};

export const SKILL_CATEGORIES: SkillCategory[] = [
  "Technical",
  "Soft Skill",
  "Domain",
  "Tools",
];

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description?: string | null;
  created_at?: string;
}

export interface EmployeeSkill {
  id: string;
  user_id: string;
  skill_id: string;
  proficiency_level: ProficiencyLevel;
  updated_at?: string;
  skills?: Skill;
}

export interface ProjectSkillRequirement {
  id: string;
  project_id: string;
  skill_id: string;
  required_proficiency_level: ProficiencyLevel;
  weight?: number;
  skills?: Skill;
}

export interface SkillEvaluation {
  id: string;
  user_id: string;
  skill_id: string;
  evaluator_id: string;
  score: ProficiencyLevel;
  comments?: string | null;
  created_at: string;
  evaluator?: { full_name: string };
  skills?: Skill;
}

export interface SkillMatchDetail {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  requiredLevel: ProficiencyLevel;
  actualLevel: ProficiencyLevel;
  meetsRequirement: boolean;
}

export interface ResourceRecommendation {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  avatarUrl?: string;
  compositeMatchScore: number; // 0 - 100%
  skillMatchScore: number;     // 0 - 100%
  bandwidthScore: number;      // 0 - 100%
  roleAlignmentScore: number;  // 0 - 100%
  activeProjectsCount: number;
  matchedSkills: SkillMatchDetail[];
  missingSkills: SkillMatchDetail[];
}

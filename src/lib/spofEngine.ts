export interface SpofSkillAlert {
  skillId: string;
  skillName: string;
  category: string;
  soleExpertUserId: string;
  soleExpertName: string;
  proficiencyLevel: number;
  activeProjectsAffected: string[];
  recommendedCrossTrainUsers: { userId: string; fullName: string }[];
}

export function detectSpofSkills(
  skills: { id: string; name: string; category?: string }[],
  employeeSkills: { user_id: string; skill_id: string; proficiency_level: number }[],
  users: { id: string; full_name: string; department?: string; status?: string }[],
  projectRequirements?: { project_id: string; skill_id: string; projects?: { name: string } }[]
): SpofSkillAlert[] {
  const activeUsers = users.filter((u) => u.status !== "inactive");
  const userMap = new Map(activeUsers.map((u) => [u.id, u.full_name]));

  const alerts: SpofSkillAlert[] = [];

  skills.forEach((skill) => {
    // Employees with proficiency >= 3
    const skilledUsers = employeeSkills.filter(
      (es) => es.skill_id === skill.id && es.proficiency_level >= 3 && userMap.has(es.user_id)
    );

    if (skilledUsers.length === 1) {
      const soleExpertId = skilledUsers[0].user_id;
      const soleExpertName = userMap.get(soleExpertId) || "Unknown";

      // Find projects requiring this skill
      const affectedProjectNames: string[] = [];
      if (projectRequirements) {
        projectRequirements
          .filter((pr) => pr.skill_id === skill.id)
          .forEach((pr) => {
            const pName = (pr.projects as any)?.name || "Active Project";
            if (!affectedProjectNames.includes(pName)) {
              affectedProjectNames.push(pName);
            }
          });
      }

      // Potential candidates for cross-training (same department or adjacent skills)
      const potentialCrossTrainers = activeUsers
        .filter((u) => u.id !== soleExpertId)
        .slice(0, 3)
        .map((u) => ({ userId: u.id, fullName: u.full_name }));

      alerts.push({
        skillId: skill.id,
        skillName: skill.name,
        category: skill.category || "Technical",
        soleExpertUserId: soleExpertId,
        soleExpertName,
        proficiencyLevel: skilledUsers[0].proficiency_level,
        activeProjectsAffected: affectedProjectNames,
        recommendedCrossTrainUsers: potentialCrossTrainers,
      });
    }
  });

  return alerts;
}


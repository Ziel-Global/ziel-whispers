-- =========================================================
-- DYNAMIC SKILL METRICS & RESOURCE RECOMMENDATION SYSTEM
-- Supabase PostgreSQL Migration Script
-- =========================================================

-- 1. Create Master Skills Dictionary Table
CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('Technical', 'Soft Skill', 'Domain', 'Tools')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Employee Skills Table (Proficiency 1-5)
CREATE TABLE IF NOT EXISTS public.employee_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  proficiency_level INT NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, skill_id)
);

-- 3. Create Project Skill Requirements Table
CREATE TABLE IF NOT EXISTS public.project_skill_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  required_proficiency_level INT NOT NULL CHECK (required_proficiency_level BETWEEN 1 AND 5),
  weight INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, skill_id)
);

-- 4. Create Skill Evaluations Table
CREATE TABLE IF NOT EXISTS public.skill_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  evaluator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  score INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_skill_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow read access to authenticated users" ON public.skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access to skills" ON public.skills FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow read access to employee_skills" ON public.employee_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access to employee_skills" ON public.employee_skills FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow read access to project_skill_requirements" ON public.project_skill_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access to project_skill_requirements" ON public.project_skill_requirements FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow read access to skill_evaluations" ON public.skill_evaluations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write access to skill_evaluations" ON public.skill_evaluations FOR ALL TO authenticated USING (true);

-- Seed Default Skill Taxonomy
INSERT INTO public.skills (name, category, description) VALUES
  ('React.js / Frontend', 'Technical', 'UI Component design, state management & React hooks.'),
  ('Node.js / Express', 'Technical', 'REST API development & backend architecture.'),
  ('PostgreSQL / SQL', 'Technical', 'Database schema design, queries, and optimization.'),
  ('TypeScript', 'Technical', 'Static typing, generics, and strict TypeScript patterns.'),
  ('UI/UX Design & Figma', 'Tools', 'Wireframing, prototyping, and design systems.'),
  ('Project Management', 'Domain', 'Agile, Scrum, sprint planning, and task tracking.'),
  ('SQA & Automated Testing', 'Technical', 'Test automation, E2E testing, and QA validation.'),
  ('Communication & Leadership', 'Soft Skill', 'Client handling, team mentorship, and collaboration.')
ON CONFLICT (name) DO NOTHING;

-- M3: Blockers & Comments
-- Matches spec: blockers can be project-level or task-level
-- Comments support human and AI author types

CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL DEFAULT 'human' CHECK (author_type IN ('human', 'ai')),
  author_id UUID REFERENCES public.users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.task_blockers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  client_visible BOOLEAN NOT NULL DEFAULT true,
  raised_by UUID NOT NULL REFERENCES public.users(id),
  raised_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_blockers_task_id ON public.task_blockers(task_id);
CREATE INDEX IF NOT EXISTS idx_task_blockers_project_id ON public.task_blockers(project_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_blockers ENABLE ROW LEVEL SECURITY;

-- Comments: admins/managers all access; others can view all, insert own
DROP POLICY IF EXISTS "admin_manager_all_task_comments" ON public.task_comments;
CREATE POLICY "admin_manager_all_task_comments" ON public.task_comments
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'));

DROP POLICY IF EXISTS "user_select_task_comments" ON public.task_comments;
CREATE POLICY "user_select_task_comments" ON public.task_comments
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user_insert_task_comments" ON public.task_comments;
CREATE POLICY "user_insert_task_comments" ON public.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND author_type = 'human');

-- Blockers: admins/managers all access; others can view all, insert own, resolve own
DROP POLICY IF EXISTS "admin_manager_all_task_blockers" ON public.task_blockers;
CREATE POLICY "admin_manager_all_task_blockers" ON public.task_blockers
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'));

DROP POLICY IF EXISTS "user_select_task_blockers" ON public.task_blockers;
CREATE POLICY "user_select_task_blockers" ON public.task_blockers
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user_insert_task_blockers" ON public.task_blockers;
CREATE POLICY "user_insert_task_blockers" ON public.task_blockers
  FOR INSERT TO authenticated
  WITH CHECK (raised_by = auth.uid());

DROP POLICY IF EXISTS "user_update_task_blockers" ON public.task_blockers;
CREATE POLICY "user_update_task_blockers" ON public.task_blockers
  FOR UPDATE TO authenticated
  USING (raised_by = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'));

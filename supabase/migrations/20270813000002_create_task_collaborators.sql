-- Migration: Create task_collaborators table for secondary contributors
CREATE TABLE IF NOT EXISTS public.task_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT task_collaborators_task_user_unique UNIQUE(task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_collaborators_task_id ON public.task_collaborators(task_id);
CREATE INDEX IF NOT EXISTS idx_task_collaborators_user_id ON public.task_collaborators(user_id);

ALTER TABLE public.task_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manager_all_task_collaborators" ON public.task_collaborators;
CREATE POLICY "admin_manager_all_task_collaborators" ON public.task_collaborators
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'));

DROP POLICY IF EXISTS "user_select_task_collaborators" ON public.task_collaborators;
CREATE POLICY "user_select_task_collaborators" ON public.task_collaborators
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user_manage_task_collaborators" ON public.task_collaborators;
CREATE POLICY "user_manage_task_collaborators" ON public.task_collaborators
  FOR ALL TO authenticated
  USING (true);

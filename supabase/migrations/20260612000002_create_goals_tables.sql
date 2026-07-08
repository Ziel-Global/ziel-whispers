-- Create goals table
CREATE TABLE public.goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create goal_resources table
CREATE TABLE public.goal_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(goal_id, user_id)
);

-- Add FK constraint on tasks.goal_id (column already exists)
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_goal_id_fkey
  FOREIGN KEY (goal_id) REFERENCES public.goals(id)
  ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_resources ENABLE ROW LEVEL SECURITY;

-- Goals: Admin/Manager can do all operations
CREATE POLICY "admin_manager_all_goals"
  ON public.goals
  FOR ALL
  TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))
  WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'manager'::text]));

-- Goals: Resources assigned to the goal can view it
CREATE POLICY "resource_select_goals"
  ON public.goals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_resources
      WHERE goal_resources.goal_id = goals.id
      AND goal_resources.user_id = auth.uid()
    )
  );

-- Goal Resources: Admin/Manager can do all operations
CREATE POLICY "admin_manager_all_goal_resources"
  ON public.goal_resources
  FOR ALL
  TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))
  WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'manager'::text]));

-- Goal Resources: Assigned user can view their own
CREATE POLICY "resource_select_goal_resources"
  ON public.goal_resources
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

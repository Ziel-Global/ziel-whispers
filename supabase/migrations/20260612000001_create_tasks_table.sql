-- Create tasks table for project task management
CREATE TABLE public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  goal_id UUID,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES public.users(id),
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'unlinked' CHECK (status IN ('unlinked', 'linked', 'in_progress', 'complete', 'returned')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Admin/Manager can do all operations on tasks
CREATE POLICY "admin_manager_all_tasks"
  ON public.tasks
  FOR ALL
  TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'manager'::text]))
  WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'manager'::text]));

-- Assigned users can view their own tasks
CREATE POLICY "assigned_user_select_tasks"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

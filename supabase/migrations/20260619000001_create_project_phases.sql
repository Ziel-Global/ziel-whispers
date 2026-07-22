-- Create project_phases table
CREATE TABLE IF NOT EXISTS public.project_phases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  due_date DATE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add phase_id column to existing tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES public.project_phases(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

-- Allow admin/manager full access
DROP POLICY IF EXISTS admin_manager_all_project_phases ON public.project_phases;
CREATE POLICY admin_manager_all_project_phases ON public.project_phases
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

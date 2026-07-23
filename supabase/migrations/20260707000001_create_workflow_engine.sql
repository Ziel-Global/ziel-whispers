-- Create workflow engine tables for Project Management Module (M1)
-- workflow_templates: defines reusable workflow configurations
-- workflow_statuses: statuses within a workflow template
-- workflow_transitions: allowed transitions between statuses
-- task_status_history: audit log of all task status changes

-- 1. WORKFLOW TEMPLATES
CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. WORKFLOW STATUSES
CREATE TABLE IF NOT EXISTS public.workflow_statuses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('todo', 'in_progress', 'done')),
  color TEXT NOT NULL DEFAULT 'bg-gray-100 text-gray-800',
  sort_order INTEGER DEFAULT 0,
  is_initial BOOLEAN DEFAULT false,
  UNIQUE(workflow_template_id, name)
);

-- 3. WORKFLOW TRANSITIONS
CREATE TABLE IF NOT EXISTS public.workflow_transitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  from_status_id UUID REFERENCES public.workflow_statuses(id) ON DELETE CASCADE,
  to_status_id UUID NOT NULL REFERENCES public.workflow_statuses(id) ON DELETE CASCADE,
  UNIQUE(workflow_template_id, from_status_id, to_status_id)
);

-- 4. TASK STATUS HISTORY
CREATE TABLE IF NOT EXISTS public.task_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_status_id UUID REFERENCES public.workflow_statuses(id) ON DELETE SET NULL,
  to_status_id UUID NOT NULL REFERENCES public.workflow_statuses(id) ON DELETE SET NULL,
  changed_by_type TEXT NOT NULL CHECK (changed_by_type IN ('admin', 'system', 'auto')),
  changed_by UUID REFERENCES public.users(id),
  changed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Add status_id to tasks (nullable during dual-write transition)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES public.workflow_statuses(id) ON DELETE SET NULL;

-- 6. Add workflow_template_id to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS workflow_template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_statuses_template_sort
  ON public.workflow_statuses (workflow_template_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_from
  ON public.workflow_transitions (workflow_template_id, from_status_id);
CREATE INDEX IF NOT EXISTS idx_task_status_history_task
  ON public.task_status_history (task_id, changed_at DESC);

-- 8. RLS
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

-- Admin/manager full access to workflow templates
DROP POLICY IF EXISTS "admin_manager_all_workflow_templates" ON public.workflow_templates;
CREATE POLICY "admin_manager_all_workflow_templates" ON public.workflow_templates
  FOR ALL USING (
    public.get_my_role() = ANY (ARRAY['admin', 'manager'])
  );

-- All authenticated users can view templates (needed to read status names)
DROP POLICY IF EXISTS "all_select_workflow_templates" ON public.workflow_templates;
CREATE POLICY "all_select_workflow_templates" ON public.workflow_templates
  FOR SELECT TO authenticated
  USING (true);

-- Admin/manager full access to workflow statuses
DROP POLICY IF EXISTS "admin_manager_all_workflow_statuses" ON public.workflow_statuses;
CREATE POLICY "admin_manager_all_workflow_statuses" ON public.workflow_statuses
  FOR ALL USING (
    public.get_my_role() = ANY (ARRAY['admin', 'manager'])
  );

-- All authenticated users can view statuses
DROP POLICY IF EXISTS "all_select_workflow_statuses" ON public.workflow_statuses;
CREATE POLICY "all_select_workflow_statuses" ON public.workflow_statuses
  FOR SELECT TO authenticated
  USING (true);

-- Admin/manager full access to workflow transitions
DROP POLICY IF EXISTS "admin_manager_all_workflow_transitions" ON public.workflow_transitions;
CREATE POLICY "admin_manager_all_workflow_transitions" ON public.workflow_transitions
  FOR ALL USING (
    public.get_my_role() = ANY (ARRAY['admin', 'manager'])
  );

-- All authenticated users can view transitions
DROP POLICY IF EXISTS "all_select_workflow_transitions" ON public.workflow_transitions;
CREATE POLICY "all_select_workflow_transitions" ON public.workflow_transitions
  FOR SELECT TO authenticated
  USING (true);

-- Admin/manager can view all history; employees can view their own task history
DROP POLICY IF EXISTS "admin_manager_all_task_status_history" ON public.task_status_history;
CREATE POLICY "admin_manager_all_task_status_history" ON public.task_status_history
  FOR ALL USING (
    public.get_my_role() = ANY (ARRAY['admin', 'manager'])
  );

DROP POLICY IF EXISTS "employee_select_own_task_history" ON public.task_status_history;
CREATE POLICY "employee_select_own_task_history" ON public.task_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_status_history.task_id
        AND tasks.assigned_to = auth.uid()
    )
  );

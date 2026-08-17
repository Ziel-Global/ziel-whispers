-- Migration: 20270812000000_create_b1_configuration_roles_task_types.sql
-- Description: B1 Foundation - Key-Value project_settings_kv, project_roles permissions, task_types, and get_project_setting RPC

-- 1. Create project_settings_kv table
CREATE TABLE IF NOT EXISTS public.project_settings_kv (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_settings_kv_project_key
  ON public.project_settings_kv (COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

ALTER TABLE public.project_settings_kv ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_settings_kv_select" ON public.project_settings_kv;
CREATE POLICY "project_settings_kv_select" ON public.project_settings_kv
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "project_settings_kv_admin_manage" ON public.project_settings_kv;
CREATE POLICY "project_settings_kv_admin_manage" ON public.project_settings_kv
  FOR ALL TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin', 'manager']));

-- Grant table access
GRANT ALL ON TABLE public.project_settings_kv TO anon, authenticated, service_role;

-- 2. Add permissions column to project_roles and allow NULL project_id for org role templates
ALTER TABLE public.project_roles ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.project_roles ALTER COLUMN project_id DROP NOT NULL;

-- 3. Create task_types table
CREATE TABLE IF NOT EXISTS public.task_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'bg-gray-100 text-gray-800' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_types_project_name
  ON public.task_types (COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_types_select" ON public.task_types;
CREATE POLICY "task_types_select" ON public.task_types
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "task_types_admin_manage" ON public.task_types;
CREATE POLICY "task_types_admin_manage" ON public.task_types
  FOR ALL TO authenticated USING (public.get_my_role() = ANY (ARRAY['admin', 'manager']));

-- Grant table access
GRANT ALL ON TABLE public.task_types TO anon, authenticated, service_role;

-- 4. Helper Function: get_project_setting
CREATE OR REPLACE FUNCTION public.get_project_setting(
  p_project_id UUID,
  p_key TEXT,
  p_default JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val JSONB;
BEGIN
  -- 1. Check project-specific override
  IF p_project_id IS NOT NULL THEN
    SELECT value INTO v_val FROM public.project_settings_kv
    WHERE project_id = p_project_id AND key = p_key;
    IF v_val IS NOT NULL THEN RETURN v_val; END IF;
  END IF;

  -- 2. Check organization default (project_id IS NULL)
  SELECT value INTO v_val FROM public.project_settings_kv
  WHERE project_id IS NULL AND key = p_key;
  IF v_val IS NOT NULL THEN RETURN v_val; END IF;

  -- 3. Return hardcoded fallback
  RETURN p_default;
END;
$$;

-- Grant execution permissions on get_project_setting
GRANT EXECUTE ON FUNCTION public.get_project_setting(UUID, TEXT, JSONB) TO anon, authenticated, service_role;

-- 5. Seed default configuration settings
INSERT INTO public.project_settings_kv (project_id, key, value)
VALUES (NULL, 'automation.max_chain_depth', '5'::jsonb)
ON CONFLICT (COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), key) DO NOTHING;

-- 6. Seed default task types
INSERT INTO public.task_types (project_id, name, description, color)
VALUES
  (NULL, 'Task', 'Standard work item', 'bg-blue-100 text-blue-800'),
  (NULL, 'Bug', 'Defect or error fix', 'bg-red-100 text-red-800'),
  (NULL, 'Feature', 'New feature or functional enhancement', 'bg-green-100 text-green-800'),
  (NULL, 'Improvement', 'Technical improvement or optimization', 'bg-purple-100 text-purple-800')
ON CONFLICT (COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), name) DO NOTHING;

-- 20271026000000_add_hr_and_project_manager_roles.sql
-- Allow 'hr_manager' and 'project_manager' in users.role while preserving backwards compatibility for 'manager'

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK ((role = ANY (ARRAY[
    'admin'::text, 
    'manager'::text, 
    'hr_manager'::text, 
    'project_manager'::text, 
    'employee'::text, 
    'client'::text, 
    'client member'::text
  ])));

-- Update get_admin_manager_ids() to include all manager types
CREATE OR REPLACE FUNCTION public.get_admin_manager_ids()
RETURNS TABLE (id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.id FROM public.users u 
  WHERE u.role IN ('admin', 'manager', 'hr_manager', 'project_manager');
$$;

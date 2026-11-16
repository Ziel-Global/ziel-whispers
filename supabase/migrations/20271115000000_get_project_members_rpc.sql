-- Project members with safe public display profile fields for co-members.
-- Employees (and clients) cannot SELECT other users from public.users (RLS),
-- which caused embedded joins on project_members -> users to return NULL for
-- teammates on Projects -> Resources.
-- This SECURITY DEFINER function returns ONLY safe display fields (no email,
-- phone, leave/shift/HR metadata) and enforces:
--   1. Caller is admin / project_manager / hr_manager OR an active member of p_project_id
--   2. Tenant isolation (project belongs to caller's tenant, or platform SSA)
--   3. Archived projects remain admin-only

CREATE OR REPLACE FUNCTION public.get_project_members(p_project_id uuid)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  user_id uuid,
  project_role_id uuid,
  allocation_percentage numeric,
  assigned_at timestamptz,
  removed_at timestamptz,
  notified boolean,
  full_name text,
  designation text,
  avatar_url text,
  user_role text,
  project_role_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pm.id,
    pm.project_id,
    pm.user_id,
    pm.project_role_id,
    pm.allocation_percentage::numeric,
    pm.assigned_at,
    pm.removed_at,
    pm.notified,
    u.full_name,
    u.designation,
    u.avatar_url,
    u.role AS user_role,
    pr.name AS project_role_name
  FROM public.project_members pm
  JOIN public.projects p ON p.id = pm.project_id
  LEFT JOIN public.users u ON u.id = pm.user_id
  LEFT JOIN public.project_roles pr ON pr.id = pm.project_role_id
  WHERE pm.project_id = p_project_id
    AND pm.removed_at IS NULL
    AND (
      p.tenant_id = public.current_tenant_id()
      OR public.platform_role() IS NOT NULL
    )
    AND (
      public.get_my_role() = ANY (ARRAY['admin'::text, 'project_manager'::text, 'hr_manager'::text])
      OR public.is_project_member(p_project_id)
    )
    AND (
      public.get_my_role() = 'admin'
      OR NOT public.is_project_archived(p_project_id)
    );
$$;

REVOKE ALL ON FUNCTION public.get_project_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_members(uuid) TO authenticated;


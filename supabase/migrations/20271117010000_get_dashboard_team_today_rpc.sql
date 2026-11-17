-- Migration: Create get_dashboard_team_today RPC
-- Secure, tenant-isolated helper to return active team presence for the Dashboard.
-- Only returns safe public display fields (no salary, phone, personal metadata).

CREATE OR REPLACE FUNCTION public.get_dashboard_team_today(p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  id uuid,
  full_name text,
  designation text,
  avatar_url text,
  role text,
  is_on_leave boolean,
  is_on_leave_from date,
  is_on_leave_to date,
  work_mode text,
  clock_in timestamptz,
  clock_out timestamptz,
  on_leave text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_attendance AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      work_mode,
      clock_in,
      clock_out
    FROM public.attendance
    WHERE date = p_date
      AND (tenant_id = public.current_tenant_id() OR public.platform_role() IS NOT NULL)
    ORDER BY user_id, 
             (clock_out IS NULL AND clock_in IS NOT NULL) DESC, 
             clock_in DESC NULLS LAST
  ),
  user_leaves AS (
    SELECT DISTINCT ON (lr.user_id)
      lr.user_id,
      lt.name AS leave_name
    FROM public.leave_requests lr
    LEFT JOIN public.leave_types lt ON lt.id = lr.leave_type_id
    WHERE lr.status = 'approved'
      AND p_date BETWEEN lr.start_date AND lr.end_date
      AND (lr.tenant_id = public.current_tenant_id() OR public.platform_role() IS NOT NULL)
    ORDER BY lr.user_id, lr.created_at DESC
  )
  SELECT
    u.id,
    u.full_name,
    u.designation,
    u.avatar_url,
    u.role,
    u.is_on_leave,
    u.is_on_leave_from,
    u.is_on_leave_to,
    ua.work_mode,
    ua.clock_in,
    ua.clock_out,
    COALESCE(
      ul.leave_name,
      CASE 
        WHEN u.is_on_leave = true 
         AND (u.is_on_leave_from IS NULL OR u.is_on_leave_from <= p_date)
         AND (u.is_on_leave_to IS NULL OR u.is_on_leave_to >= p_date)
        THEN 'On Leave'
        ELSE NULL
      END
    ) AS on_leave
  FROM public.users u
  LEFT JOIN user_attendance ua ON ua.user_id = u.id
  LEFT JOIN user_leaves ul ON ul.user_id = u.id
  WHERE (u.tenant_id = public.current_tenant_id() OR public.platform_role() IS NOT NULL)
    AND u.status = 'active'
    AND u.role = 'employee'
  ORDER BY u.full_name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_team_today(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_team_today(date) TO authenticated;

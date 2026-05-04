-- Fix: Employees were only able to see their own row in project_members due to
-- an overly restrictive RLS policy. Replace it with one that lets any project
-- member see ALL active members of projects they belong to.

DROP POLICY IF EXISTS "Employees can view own project memberships" ON public.project_members;

CREATE POLICY "Members can view all members of their projects"
ON public.project_members FOR SELECT TO authenticated
USING (
  -- Admin and managers can see everything (already covered by the ALL policy above,
  -- but we keep this explicit for SELECT to avoid any gaps)
  public.get_my_role() = ANY(ARRAY['admin','manager'])
  OR
  -- Employees can see all members of any project they themselves belong to
  project_id IN (
    SELECT pm.project_id
    FROM public.project_members pm
    WHERE pm.user_id = auth.uid()
      AND pm.removed_at IS NULL
  )
);

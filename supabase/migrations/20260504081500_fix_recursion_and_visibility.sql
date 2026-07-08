
-- 1. Create a Security Definer function to check project membership
-- This avoids recursion because SECURITY DEFINER functions bypass RLS for the queries inside them.
CREATE OR REPLACE FUNCTION public.is_project_member(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_id
      AND user_id = auth.uid()
      AND removed_at IS NULL
  );
$$;

-- 2. Fix the project_members policy (The one that caused the recursion)
DROP POLICY IF EXISTS "Members can view all members of their projects" ON public.project_members;
CREATE POLICY "Members can view all members of their projects"
ON public.project_members FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY(ARRAY['admin','manager'])
  OR
  public.is_project_member(project_id)
);

-- 3. Update the projects policy to be cleaner and more robust
DROP POLICY IF EXISTS "Admin/Manager can view all projects" ON public.projects;
CREATE POLICY "Admin/Manager/Members can view projects"
ON public.projects FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY(ARRAY['admin','manager'])
  OR
  public.is_project_member(id)
);

-- 4. Update the clients policy to follow the same logic
DROP POLICY IF EXISTS "Employees can view clients of their projects" ON public.clients;
CREATE POLICY "Admin/Manager/Members can view clients"
ON public.clients FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY(ARRAY['admin','manager'])
  OR
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.client_id = clients.id 
    AND public.is_project_member(p.id)
  )
);

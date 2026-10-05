-- Hide archived projects from client / client member SELECT (admins and employee members unchanged).
-- Safe to re-run.

DROP POLICY IF EXISTS "Admin/Manager/Members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Admin/Manager/Members/Clients can view projects" ON public.projects;

CREATE POLICY "Admin/Manager/Members/Clients can view projects"
ON public.projects FOR SELECT TO authenticated
USING (
  public.get_my_role() = ANY(ARRAY['admin', 'manager'])
  OR
  (
    public.get_my_role() NOT IN ('client', 'client member')
    AND (
      public.is_project_member(id)
      OR client_id IN (
        SELECT client_id FROM public.users WHERE id = auth.uid() AND client_id IS NOT NULL
      )
    )
  )
  OR
  (
    public.get_my_role() = ANY(ARRAY['client', 'client member'])
    AND status IS DISTINCT FROM 'archived'
    AND (
      public.is_project_member(id)
      OR client_id IN (
        SELECT client_id FROM public.users WHERE id = auth.uid() AND client_id IS NOT NULL
      )
    )
  )
);

-- Fix missing RLS DELETE policies for clients, projects, and leave_requests

-- 1. clients: Admin/Manager can delete clients
DROP POLICY IF EXISTS "Admin/Manager can delete clients" ON public.clients;
CREATE POLICY "Admin/Manager can delete clients"
  ON public.clients FOR DELETE
  USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'manager'::text]));

-- 2. projects: Admin/Manager can delete projects
DROP POLICY IF EXISTS "Admin/Manager can delete projects" ON public.projects;
CREATE POLICY "Admin/Manager can delete projects"
  ON public.projects FOR DELETE
  USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'manager'::text]));

-- 3. leave_requests: Admin can delete any leave request; employees can delete own pending/cancelled requests
DROP POLICY IF EXISTS "Admin can delete any; employee can delete own pending" ON public.leave_requests;
CREATE POLICY "Admin can delete any; employee can delete own pending"
  ON public.leave_requests FOR DELETE
  USING (
    (public.get_my_role() = 'admin')
    OR (user_id = auth.uid() AND (status = 'pending' OR status = 'cancelled'))
  );

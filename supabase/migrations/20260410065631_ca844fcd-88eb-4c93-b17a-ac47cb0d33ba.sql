
-- Enable RLS on tables missing it
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- leave_types: all authenticated can view, admin can manage
CREATE POLICY "Authenticated users can view leave types"
ON public.leave_types FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin can manage leave types"
ON public.leave_types FOR ALL TO authenticated
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

-- project_members: admin/manager full, employee sees own
CREATE POLICY "Admin/Manager can manage project members"
ON public.project_members FOR ALL TO authenticated
USING (public.get_my_role() = ANY(ARRAY['admin','manager']))
WITH CHECK (public.get_my_role() = ANY(ARRAY['admin','manager']));

CREATE POLICY "Employees can view own project memberships"
ON public.project_members FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- project_roles: admin/manager manage, all authenticated view
CREATE POLICY "Authenticated can view project roles"
ON public.project_roles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin/Manager can manage project roles"
ON public.project_roles FOR ALL TO authenticated
USING (public.get_my_role() = ANY(ARRAY['admin','manager']))
WITH CHECK (public.get_my_role() = ANY(ARRAY['admin','manager']));

-- system_settings: admin only
CREATE POLICY "Admin can manage system settings"
ON public.system_settings FOR ALL TO authenticated
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

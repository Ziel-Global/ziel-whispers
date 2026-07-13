-- M7: Client Portal
-- Creates client_action_items, client_portal_messages tables and RLS

-- 1. client_action_items table
CREATE TABLE IF NOT EXISTS public.client_action_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'waived')),
  requested_by UUID REFERENCES public.users(id),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. client_portal_messages table
CREATE TABLE IF NOT EXISTS public.client_portal_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  cta_label TEXT,
  cta_url TEXT,
  active BOOLEAN DEFAULT true NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_action_items_project ON public.client_action_items(project_id, status);
CREATE INDEX IF NOT EXISTS idx_client_portal_messages_project ON public.client_portal_messages(project_id, active);

-- 3. RLS
ALTER TABLE public.client_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_messages ENABLE ROW LEVEL SECURITY;

-- client_action_items policies
DROP POLICY IF EXISTS "admin_all_action_items" ON public.client_action_items;
CREATE POLICY "admin_all_action_items" ON public.client_action_items
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'))
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'));

DROP POLICY IF EXISTS "member_read_action_items" ON public.client_action_items;
CREATE POLICY "member_read_action_items" ON public.client_action_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = client_action_items.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.removed_at IS NULL
    )
  );

DROP POLICY IF EXISTS "member_complete_action_items" ON public.client_action_items;
CREATE POLICY "member_complete_action_items" ON public.client_action_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = client_action_items.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.removed_at IS NULL
    )
  )
  WITH CHECK (
    status = 'completed'
    AND EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = client_action_items.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.removed_at IS NULL
    )
  );

-- client_portal_messages policies
DROP POLICY IF EXISTS "admin_all_portal_messages" ON public.client_portal_messages;
CREATE POLICY "admin_all_portal_messages" ON public.client_portal_messages
  FOR ALL
  TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'))
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'));

DROP POLICY IF EXISTS "member_read_portal_messages" ON public.client_portal_messages;
CREATE POLICY "member_read_portal_messages" ON public.client_portal_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = client_portal_messages.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.removed_at IS NULL
    )
  );

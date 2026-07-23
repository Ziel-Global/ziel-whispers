-- Action Item Communication System
-- New messages table for threaded conversations on action items

-- 1. New messages table
CREATE TABLE IF NOT EXISTS public.client_action_item_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_item_id UUID NOT NULL REFERENCES public.client_action_items(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_action_item_messages_item ON public.client_action_item_messages(action_item_id, created_at);

-- 2. Add resolved_by to client_action_items
ALTER TABLE public.client_action_items
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Enable RLS
ALTER TABLE public.client_action_item_messages ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- SELECT: any authenticated user who is an active project member
DROP POLICY IF EXISTS "project_members_select_action_item_messages" ON public.client_action_item_messages;
CREATE POLICY "project_members_select_action_item_messages"
  ON public.client_action_item_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_action_items ai
      JOIN public.project_members pm ON pm.project_id = ai.project_id AND pm.removed_at IS NULL
      WHERE ai.id = action_item_id AND pm.user_id = auth.uid()
    )
  );

-- INSERT: sender must be the auth user
DROP POLICY IF EXISTS "sender_insert_action_item_messages" ON public.client_action_item_messages;
CREATE POLICY "sender_insert_action_item_messages"
  ON public.client_action_item_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- Admin/Manager bypass: role-based access (mirrors admin_all_action_items on parent table)
DROP POLICY IF EXISTS "admin_select_action_item_messages" ON public.client_action_item_messages;
CREATE POLICY "admin_select_action_item_messages"
  ON public.client_action_item_messages FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- 5. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_action_item_messages;

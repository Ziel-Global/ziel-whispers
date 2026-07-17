-- M8: Remove client-writable RLS policy for action items
-- Clients must use the client-complete-action edge function instead

DROP POLICY IF EXISTS "member_complete_action_items" ON public.client_action_items;

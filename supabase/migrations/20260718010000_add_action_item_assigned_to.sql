-- Add assigned_to column to client_action_items for employee assignment
ALTER TABLE client_action_items
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL;

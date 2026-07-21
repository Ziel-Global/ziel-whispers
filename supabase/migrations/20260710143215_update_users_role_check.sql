-- Update the users_role_check constraint to allow 'client' and 'client member' roles
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'employee'::text, 'client'::text, 'client member'::text])));

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_oversight boolean DEFAULT false NOT NULL;
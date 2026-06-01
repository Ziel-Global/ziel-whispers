ALTER TABLE public.users
ADD COLUMN is_oversight boolean DEFAULT false NOT NULL;

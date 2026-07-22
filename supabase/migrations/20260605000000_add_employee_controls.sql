ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS log_edit_days integer,
  ADD COLUMN IF NOT EXISTS remote_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS remote_access_from date,
  ADD COLUMN IF NOT EXISTS remote_access_to date,
  ADD COLUMN IF NOT EXISTS is_on_leave boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_on_leave_from date,
  ADD COLUMN IF NOT EXISTS is_on_leave_to date;

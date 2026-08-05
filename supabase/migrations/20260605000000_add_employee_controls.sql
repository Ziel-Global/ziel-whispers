ALTER TABLE public.users
  ADD COLUMN log_edit_days integer,
  ADD COLUMN remote_access boolean NOT NULL DEFAULT false,
  ADD COLUMN remote_access_from date,
  ADD COLUMN remote_access_to date,
  ADD COLUMN is_on_leave boolean NOT NULL DEFAULT false,
  ADD COLUMN is_on_leave_from date,
  ADD COLUMN is_on_leave_to date;

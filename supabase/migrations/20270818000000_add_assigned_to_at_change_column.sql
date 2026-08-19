-- =======================================================================
-- Migration: 20270818000000_add_assigned_to_at_change_column.sql
-- Description: Adds the missing assigned_to_at_change column to the
--   task_status_history table.
--
--   The original table (20260707000001) was created without this column.
--   Later migrations (20270805000000, 20270814000000, etc.) reference and
--   insert into this column via the record_task_status_history() trigger,
--   causing a "column does not exist" error on any database where the
--   column was never explicitly added (notably production).
--
--   Using IF NOT EXISTS makes this idempotent and safe on dev (where the
--   column may already exist) and on production (where it does not).
-- =======================================================================

ALTER TABLE public.task_status_history
  ADD COLUMN IF NOT EXISTS assigned_to_at_change UUID REFERENCES public.users(id);

-- =======================================================================
-- Migration: 20270819000002_remove_sprints_phase_id_not_null.sql
-- Description: Removes the NOT NULL constraint from phase_id in sprints
--   to align with the Generalised Project Engine Architecture (v1.1)
--   where Sprints no longer strictly depend on Phases.
-- =======================================================================

ALTER TABLE public.sprints 
ALTER COLUMN phase_id DROP NOT NULL;

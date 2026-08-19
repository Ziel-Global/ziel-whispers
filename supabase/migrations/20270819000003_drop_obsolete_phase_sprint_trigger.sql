-- =======================================================================
-- Migration: 20270819000003_drop_obsolete_phase_sprint_trigger.sql
-- Description: Drops the trg_validate_task_phase_sprint trigger that 
--   enforced a strict hierarchy between tasks, sprints, and phases.
--   This aligns with Generalised Project Engine Architecture (v1.1) 
--   where these entities are fully decoupled.
-- =======================================================================

DROP TRIGGER IF EXISTS trg_validate_task_phase_sprint ON public.tasks;
DROP FUNCTION IF EXISTS public.validate_task_phase_sprint();

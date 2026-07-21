-- Fix: allow 'system' as an author_type in task_comments
-- The automation rules engine inserts comments with author_type = 'system'
-- which was rejected by the original CHECK constraint (only 'human', 'ai' allowed)

ALTER TABLE public.task_comments
  DROP CONSTRAINT IF EXISTS task_comments_author_type_check,
  ADD CONSTRAINT task_comments_author_type_check
    CHECK (author_type IN ('human', 'ai', 'system'));

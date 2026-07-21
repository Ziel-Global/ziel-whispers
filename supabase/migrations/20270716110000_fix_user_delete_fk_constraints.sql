-- Fix foreign key constraints on users(id) so deleting a user
-- automatically nullifies references instead of blocking the delete.

-- tasks
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey,
  ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_created_by_fkey,
  ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- task_comments
ALTER TABLE public.task_comments
  DROP CONSTRAINT IF EXISTS task_comments_author_id_fkey,
  ADD CONSTRAINT task_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- task_blockers
ALTER TABLE public.task_blockers
  DROP CONSTRAINT IF EXISTS task_blockers_raised_by_fkey,
  ADD CONSTRAINT task_blockers_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.task_blockers
  DROP CONSTRAINT IF EXISTS task_blockers_resolved_by_fkey,
  ADD CONSTRAINT task_blockers_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- task_status_history
ALTER TABLE public.task_status_history
  DROP CONSTRAINT IF EXISTS task_status_history_changed_by_fkey,
  ADD CONSTRAINT task_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- task_dependencies
ALTER TABLE public.task_dependencies
  DROP CONSTRAINT IF EXISTS task_dependencies_created_by_fkey,
  ADD CONSTRAINT task_dependencies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- project_status_updates
ALTER TABLE public.project_status_updates
  DROP CONSTRAINT IF EXISTS project_status_updates_author_id_fkey,
  ADD CONSTRAINT project_status_updates_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- goals (if table still exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'goals') THEN
    ALTER TABLE public.goals
      DROP CONSTRAINT IF EXISTS goals_created_by_fkey,
      ADD CONSTRAINT goals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- goal_resources (if table still exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'goal_resources') THEN
    ALTER TABLE public.goal_resources
      DROP CONSTRAINT IF EXISTS goal_resources_user_id_fkey,
      ADD CONSTRAINT goal_resources_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- workflow_templates (if table still exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'workflow_templates') THEN
    ALTER TABLE public.workflow_templates
      DROP CONSTRAINT IF EXISTS workflow_templates_created_by_fkey,
      ADD CONSTRAINT workflow_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- client_action_items
ALTER TABLE public.client_action_items
  DROP CONSTRAINT IF EXISTS client_action_items_requested_by_fkey,
  ADD CONSTRAINT client_action_items_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- client_portal_messages
ALTER TABLE public.client_portal_messages
  DROP CONSTRAINT IF EXISTS client_portal_messages_created_by_fkey,
  ADD CONSTRAINT client_portal_messages_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

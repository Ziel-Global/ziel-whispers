-- M: Automation Rules Engine
-- Creates automation_rules, automation_rule_runs tables, execution function, RLS

-- 1. automation_rules table
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'enabled', 'disabled')),
  trigger_type TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  allow_triggering_other_rules BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_project ON public.automation_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON public.automation_rules(project_id, trigger_type, status);

-- 2. automation_rule_runs table
CREATE TABLE IF NOT EXISTS public.automation_rule_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  root_event_id UUID NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  result TEXT NOT NULL CHECK (result IN ('success', 'failed', 'skipped', 'condition_not_met')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_automation_rule_runs_rule ON public.automation_rule_runs(automation_rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_rule_runs_root ON public.automation_rule_runs(root_event_id);

-- 3. Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_automation_rules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_automation_rules_updated_at ON public.automation_rules;
CREATE TRIGGER trg_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_automation_rules_updated_at();

-- 4. RLS
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rule_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_automation_rules" ON public.automation_rules;
DROP POLICY IF EXISTS "employee_view_automation_rules" ON public.automation_rules;
DROP POLICY IF EXISTS "admin_all_automation_rule_runs" ON public.automation_rule_runs;
DROP POLICY IF EXISTS "employee_view_automation_rule_runs" ON public.automation_rule_runs;

CREATE POLICY "admin_all_automation_rules" ON public.automation_rules
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "employee_view_automation_rules" ON public.automation_rules
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_all_automation_rule_runs" ON public.automation_rule_runs
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "employee_view_automation_rule_runs" ON public.automation_rule_runs
  FOR SELECT TO authenticated
  USING (true);

-- 5. Execution engine: run_automation_rules
CREATE OR REPLACE FUNCTION public.run_automation_rules(
  p_project_id UUID,
  p_trigger_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_root_event_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule RECORD;
  v_condition JSONB;
  v_condition_passed BOOLEAN;
  v_action JSONB;
  v_action_result TEXT;
  v_error_msg TEXT;
  v_actual_root_id UUID;
  v_chain_depth INTEGER;
  v_target_status_id UUID;
  v_target_user_id UUID;
  v_target_role_id UUID;
  v_role_holder RECORD;
  v_task_id UUID;
  v_task_record RECORD;
  v_field TEXT;
  v_operator TEXT;
  v_value TEXT;
  v_current_value TEXT;
BEGIN
  -- Determine root event ID (first call generates, chains reuse)
  v_actual_root_id := COALESCE(p_root_event_id, gen_random_uuid());

  -- Count chain depth
  IF p_root_event_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER + 1 INTO v_chain_depth
    FROM automation_rule_runs
    WHERE root_event_id = p_root_event_id;
  ELSE
    v_chain_depth := 1;
  END IF;

  -- Hard cap at 5 hops
  IF v_chain_depth > 5 THEN
    RETURN;
  END IF;

  -- Resolve task_id from entity
  v_task_id := CASE
    WHEN p_entity_type = 'task' THEN p_entity_id
    WHEN p_entity_type = 'blocker' THEN (SELECT task_id FROM task_blockers WHERE id = p_entity_id)
    ELSE NULL
  END;

  FOR v_rule IN
    SELECT * FROM automation_rules
    WHERE project_id = p_project_id
      AND trigger_type = p_trigger_type
      AND status = 'enabled'
    ORDER BY priority DESC
  LOOP
    -- Evaluate conditions (all must pass)
    v_condition_passed := true;
    IF jsonb_array_length(v_rule.conditions) > 0 THEN
      SELECT * INTO v_task_record FROM tasks WHERE id = v_task_id;
      FOR v_condition IN SELECT * FROM jsonb_array_elements(v_rule.conditions)
      LOOP
        v_field := v_condition->>'field';
        v_operator := v_condition->>'operator';
        v_value := v_condition->>'value';

        IF v_operator = 'always' THEN
          CONTINUE;
        END IF;

        -- Resolve current field value from task
        CASE v_field
          WHEN 'status_id' THEN v_current_value := v_task_record.status_id::text;
          WHEN 'priority' THEN v_current_value := v_task_record.priority;
          WHEN 'assigned_to' THEN v_current_value := v_task_record.assigned_to::text;
          WHEN 'due_date' THEN v_current_value := v_task_record.due_date::text;
          WHEN 'description' THEN v_current_value := v_task_record.description;
          ELSE v_current_value := NULL;
        END CASE;

        -- Compare using operator
        CASE v_operator
          WHEN 'eq' THEN v_condition_passed := (v_current_value IS NOT DISTINCT FROM v_value);
          WHEN 'neq' THEN v_condition_passed := (v_current_value IS DISTINCT FROM v_value);
          WHEN 'contains' THEN v_condition_passed := COALESCE(v_current_value, '') LIKE '%' || COALESCE(v_value, '') || '%';
          WHEN 'gt' THEN
            BEGIN
              v_condition_passed := v_current_value::timestamp > v_value::timestamp;
            EXCEPTION WHEN OTHERS THEN
              v_condition_passed := false;
            END;
          WHEN 'lt' THEN
            BEGIN
              v_condition_passed := v_current_value::timestamp < v_value::timestamp;
            EXCEPTION WHEN OTHERS THEN
              v_condition_passed := false;
            END;
          ELSE v_condition_passed := false;
        END CASE;

        IF NOT v_condition_passed THEN EXIT; END IF;
      END LOOP;
    END IF;

    IF NOT v_condition_passed THEN
      INSERT INTO automation_rule_runs (automation_rule_id, entity_type, entity_id, root_event_id, result)
      VALUES (v_rule.id, p_entity_type, p_entity_id, v_actual_root_id, 'condition_not_met');
      CONTINUE;
    END IF;

    -- Execute actions in sequence
    FOR v_action IN SELECT * FROM jsonb_array_elements(v_rule.actions)
    LOOP
      v_error_msg := NULL;
      v_action_result := 'success';

      BEGIN
        CASE v_action->>'type'
          WHEN 'change_status' THEN
            v_target_status_id := (v_action->'params'->>'status_id')::UUID;
            IF v_target_status_id IS NOT NULL AND v_task_id IS NOT NULL THEN
              UPDATE tasks SET status_id = v_target_status_id WHERE id = v_task_id;
            END IF;

          WHEN 'assign_user' THEN
            v_target_user_id := (v_action->'params'->>'user_id')::UUID;
            IF v_target_user_id IS NOT NULL AND v_task_id IS NOT NULL THEN
              UPDATE tasks SET assigned_to = v_target_user_id WHERE id = v_task_id;
            END IF;

          WHEN 'assign_role' THEN
            v_target_role_id := (v_action->'params'->>'role_id')::UUID;
            IF v_target_role_id IS NOT NULL AND v_task_id IS NOT NULL THEN
              SELECT pm.user_id INTO v_role_holder
              FROM project_members pm
              WHERE pm.project_id = p_project_id
                AND pm.project_role_id = v_target_role_id
                AND pm.removed_at IS NULL
              ORDER BY (
                SELECT COUNT(*) FROM tasks t
                JOIN workflow_statuses ws ON ws.id = t.status_id
                WHERE t.assigned_to = pm.user_id AND ws.category != 'done'
              ) ASC
              LIMIT 1;
              IF v_role_holder.user_id IS NOT NULL THEN
                UPDATE tasks SET assigned_to = v_role_holder.user_id WHERE id = v_task_id;
              END IF;
            END IF;

          WHEN 'add_comment' THEN
            IF v_task_id IS NOT NULL THEN
              INSERT INTO task_comments (task_id, author_type, body)
              VALUES (v_task_id, 'system', v_action->'params'->>'body');
            END IF;

          WHEN 'resolve_blocker' THEN
            IF p_entity_type = 'blocker' THEN
              UPDATE task_blockers SET status = 'resolved',
                resolved_at = now(),
                resolved_by = (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
              WHERE id = p_entity_id AND status = 'open';
            END IF;

          ELSE
            v_action_result := 'failed';
            v_error_msg := 'Unknown action type: ' || (v_action->>'type');
        END CASE;
      EXCEPTION WHEN OTHERS THEN
        v_action_result := 'failed';
        v_error_msg := SQLERRM;
      END;

      IF v_action_result = 'failed' THEN
        EXIT;
      END IF;
    END LOOP;

    INSERT INTO automation_rule_runs (automation_rule_id, entity_type, entity_id, root_event_id, result, error_message)
    VALUES (v_rule.id, p_entity_type, p_entity_id, v_actual_root_id, v_action_result, v_error_msg);

    IF v_rule.allow_triggering_other_rules AND v_action_result = 'success' THEN
      PERFORM public.run_automation_rules(
        p_project_id, p_trigger_type, p_entity_type, p_entity_id, v_actual_root_id
      );
    END IF;
  END LOOP;
END;
$$;

-- 6. Wrapper for scheduled automation rules
CREATE OR REPLACE FUNCTION public.run_scheduled_automations()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule RECORD;
  v_task_id UUID;
BEGIN
  FOR v_rule IN
    SELECT DISTINCT ar.project_id
    FROM automation_rules ar
    WHERE ar.trigger_type = 'scheduled' AND ar.status = 'enabled'
  LOOP
    FOR v_task_id IN
      SELECT t.id FROM tasks t
      JOIN workflow_statuses ws ON ws.id = t.status_id
      WHERE t.project_id = v_rule.project_id AND ws.category != 'done'
    LOOP
      PERFORM public.run_automation_rules(v_rule.project_id, 'scheduled', 'task', v_task_id);
    END LOOP;
  END LOOP;
END;
$$;

-- 7. Schedule the automation runner every 15 minutes via pg_cron
SELECT cron.schedule('run-scheduled-automations', '*/15 * * * *', 'SELECT public.run_scheduled_automations();');

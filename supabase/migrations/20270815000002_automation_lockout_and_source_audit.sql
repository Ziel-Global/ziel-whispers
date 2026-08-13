-- Migration: Phase 3 - Lockout rules guard for automation engine & System source audit tagging
-- Section 6: Lockout Rules for System Transition Actions (C6)
-- Section 7: System Source Audit Tagging (C7)

-- 1. Update record_task_status_history to populate source
CREATE OR REPLACE FUNCTION public.record_task_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    INSERT INTO public.task_status_history (
      task_id,
      from_status_id,
      to_status_id,
      changed_by,
      changed_by_type,
      assigned_to_at_change,
      source
    )
    VALUES (
      NEW.id,
      OLD.status_id,
      NEW.status_id,
      auth.uid(),
      COALESCE(auth.role(), 'system'),
      NEW.assigned_to,
      CASE 
        WHEN auth.uid() IS NULL THEN 'system'
        ELSE 'manual'
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Update run_automation_rules to enforce Lockout Rules (C6) and System Audit Tagging (C7)
CREATE OR REPLACE FUNCTION public.run_automation_rules(
  p_project_id UUID,
  p_trigger_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_root_event_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_fallback_role_id UUID;
  v_previous_owner UUID;
  v_role_holder RECORD;
  v_task_id UUID;
  v_task_record RECORD;
  v_field TEXT;
  v_operator TEXT;
  v_value TEXT;
  v_current_value TEXT;
  v_lookup_by TEXT;
  v_recipient TEXT;
  v_notify_user_id UUID;
  v_notification_type TEXT;
  v_notify_title TEXT;
  v_message_template TEXT;
  v_resolved_message TEXT;
  v_project_name TEXT;
  v_task_title TEXT;
  v_assignee_name TEXT;
  -- C6 Lockout Variables
  v_has_active_blockers BOOLEAN := false;
  v_is_task_flagged BOOLEAN := false;
BEGIN
  -- Determine root event ID
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

  -- Check C6 Lockout Conditions on the target task
  IF v_task_id IS NOT NULL THEN
    SELECT COALESCE(is_flagged, false) INTO v_is_task_flagged FROM tasks WHERE id = v_task_id;
    SELECT EXISTS (
      SELECT 1 FROM task_blockers 
      WHERE task_id = v_task_id AND resolved_at IS NULL AND (status IS NULL OR status = 'open')
    ) INTO v_has_active_blockers;
  END IF;

  FOR v_rule IN
    SELECT * FROM automation_rules
    WHERE project_id = p_project_id
      AND trigger_type = p_trigger_type
      AND status = 'enabled'
    ORDER BY priority DESC
  LOOP
    -- C6 Guard: If task has active blockers or is flagged, defer system status transitions
    IF (v_is_task_flagged OR v_has_active_blockers) AND p_trigger_type = 'status_change' THEN
      INSERT INTO automation_rule_runs (
        automation_rule_id, entity_type, entity_id, root_event_id, result, error_message
      )
      VALUES (
        v_rule.id, p_entity_type, p_entity_id, v_actual_root_id, 'deferred_lockout',
        'Automation action deferred: Task is currently locked due to active unresolved blockers or flag lockout.'
      );
      CONTINUE;
    END IF;

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

        CASE v_field
          WHEN 'status_id' THEN v_current_value := v_task_record.status_id::text;
          WHEN 'priority' THEN v_current_value := v_task_record.priority;
          WHEN 'assigned_to' THEN v_current_value := v_task_record.assigned_to::text;
          WHEN 'due_date' THEN v_current_value := v_task_record.due_date::text;
          WHEN 'description' THEN v_current_value := v_task_record.description;
          ELSE v_current_value := NULL;
        END CASE;

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
              -- Update task status
              UPDATE tasks SET status_id = v_target_status_id WHERE id = v_task_id;
              
              -- C7 System Source Audit Tagging
              INSERT INTO task_status_history (
                task_id, from_status_id, to_status_id, changed_by, changed_by_type, source, automation_rule_id
              )
              VALUES (
                v_task_id, v_task_record.status_id, v_target_status_id, auth.uid(), 'system', 'system', v_rule.id
              );
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

          WHEN 'reassign_to_stage_owner' THEN
            v_target_status_id := (v_action->'params'->>'status_id')::UUID;
            v_fallback_role_id := (v_action->'params'->>'fallback_role_id')::UUID;
            v_lookup_by := COALESCE(v_action->'params'->>'lookup_by', 'to');
            IF v_task_id IS NOT NULL THEN
              IF v_target_status_id IS NOT NULL THEN
                IF v_lookup_by = 'from' THEN
                  SELECT tsh.assigned_to_at_change INTO v_previous_owner
                  FROM public.task_status_history tsh
                  WHERE tsh.task_id = v_task_id
                    AND tsh.from_status_id = v_target_status_id
                    AND tsh.assigned_to_at_change IS NOT NULL
                  ORDER BY tsh.changed_at DESC
                  OFFSET 1
                  LIMIT 1;
                ELSE
                  SELECT tsh.assigned_to_at_change INTO v_previous_owner
                  FROM public.task_status_history tsh
                  WHERE tsh.task_id = v_task_id
                    AND tsh.to_status_id = v_target_status_id
                    AND tsh.assigned_to_at_change IS NOT NULL
                  ORDER BY tsh.changed_at DESC
                  OFFSET 1
                  LIMIT 1;
                END IF;

                IF v_previous_owner IS NOT NULL THEN
                  UPDATE tasks SET assigned_to = v_previous_owner WHERE id = v_task_id;
                ELSIF v_fallback_role_id IS NOT NULL THEN
                  SELECT pm.user_id INTO v_role_holder
                  FROM project_members pm
                  WHERE pm.project_id = p_project_id
                    AND pm.project_role_id = v_fallback_role_id
                    AND pm.removed_at IS NULL
                  ORDER BY (
                    SELECT COUNT(*) FROM tasks t
                    JOIN workflow_statuses ws ON ws.id = t.status_id
                    WHERE t.assigned_to = pm.user_id AND ws.category != 'done'
                  ) ASC
                  LIMIT 1;
                  IF v_role_holder.user_id IS NOT NULL THEN
                    UPDATE tasks SET assigned_to = v_role_holder.user_id WHERE id = v_task_id;
                  ELSE
                    v_action_result := 'failed';
                    v_error_msg := 'reassign_to_stage_owner: no previous holder at target status and no fallback role holder';
                  END IF;
                ELSE
                  v_action_result := 'failed';
                  v_error_msg := 'reassign_to_stage_owner: no previous holder and no fallback role';
                END IF;
              ELSE
                v_action_result := 'failed';
                v_error_msg := 'reassign_to_stage_owner: missing target status param';
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

          WHEN 'notify_user' THEN
            v_recipient := COALESCE(v_action->'params'->>'recipient', 'task_assignee');
            v_notification_type := COALESCE(v_action->'params'->>'notification_type', 'automation');
            v_notify_title := COALESCE(v_action->'params'->>'title', 'Automation Notification');
            v_message_template := COALESCE(v_action->'params'->>'message_template', '');

            IF v_task_id IS NOT NULL THEN
              SELECT t.title, p.name, u.full_name
              INTO v_task_title, v_project_name, v_assignee_name
              FROM tasks t
              LEFT JOIN projects p ON p.id = t.project_id
              LEFT JOIN users u ON u.id = t.assigned_to
              WHERE t.id = v_task_id;
            END IF;

            v_resolved_message := v_message_template;
            v_resolved_message := REPLACE(v_resolved_message, '{task_title}', COALESCE(v_task_title, ''));
            v_resolved_message := REPLACE(v_resolved_message, '{project_name}', COALESCE(v_project_name, ''));
            v_resolved_message := REPLACE(v_resolved_message, '{assignee_name}', COALESCE(v_assignee_name, ''));

            CASE v_recipient
              WHEN 'task_assignee' THEN
                IF v_task_id IS NOT NULL THEN
                  SELECT assigned_to INTO v_notify_user_id FROM tasks WHERE id = v_task_id;
                  IF v_notify_user_id IS NOT NULL THEN
                    INSERT INTO notifications (user_id, type, channel, metadata, read)
                    VALUES (v_notify_user_id, v_notification_type, 'in_app',
                      jsonb_build_object('title', v_notify_title, 'message', v_resolved_message, 'project_id', p_project_id),
                      false);
                  END IF;
                END IF;

              WHEN 'specific_user' THEN
                v_notify_user_id := (v_action->'params'->>'user_id')::UUID;
                IF v_notify_user_id IS NOT NULL THEN
                  INSERT INTO notifications (user_id, type, channel, metadata, read)
                  VALUES (v_notify_user_id, v_notification_type, 'in_app',
                    jsonb_build_object('title', v_notify_title, 'message', v_resolved_message, 'project_id', p_project_id),
                    false);
                END IF;

              WHEN 'admins_managers' THEN
                INSERT INTO notifications (user_id, type, channel, metadata, read)
                SELECT u.id, v_notification_type, 'in_app',
                  jsonb_build_object('title', v_notify_title, 'message', v_resolved_message, 'project_id', p_project_id),
                  false
                FROM users u
                WHERE u.role IN ('admin', 'manager');

              WHEN 'project_members' THEN
                INSERT INTO notifications (user_id, type, channel, metadata, read)
                SELECT pm.user_id, v_notification_type, 'in_app',
                  jsonb_build_object('title', v_notify_title, 'message', v_resolved_message, 'project_id', p_project_id),
                  false
                FROM project_members pm
                WHERE pm.project_id = p_project_id
                  AND pm.removed_at IS NULL;

              ELSE
                v_action_result := 'failed';
                v_error_msg := 'notify_user: unknown recipient type: ' || v_recipient;
            END CASE;

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

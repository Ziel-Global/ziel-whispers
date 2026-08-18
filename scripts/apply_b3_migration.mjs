/**
 * B3 Migration Application Script
 * Applies 20270814000000_b3_reassignment_and_history_fix.sql via Supabase Management API
 * Run: node scripts/apply_b3_migration.mjs
 */


const SQL = `
-- ── 1. Update record_task_status_history() to record assigned_to_at_change ────
CREATE OR REPLACE FUNCTION public.record_task_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_changed_by_type TEXT;
  v_assignee_at_change UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status_id IS NOT DISTINCT FROM NEW.status_id THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_changed_by_type := NULLIF(current_setting('app.task_changed_by_type', true), '');
  EXCEPTION WHEN OTHERS THEN
    v_changed_by_type := NULL;
  END;
  IF v_changed_by_type IS NULL OR v_changed_by_type NOT IN ('admin', 'system', 'auto') THEN
    v_changed_by_type := 'system';
  END IF;

  v_assignee_at_change := CASE WHEN TG_OP = 'UPDATE' THEN OLD.assigned_to ELSE NEW.assigned_to END;

  INSERT INTO public.task_status_history
    (task_id, from_status_id, to_status_id, changed_by_type, changed_by, assigned_to_at_change)
  VALUES (
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status_id ELSE NULL END,
    NEW.status_id,
    v_changed_by_type,
    auth.uid(),
    v_assignee_at_change
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_task_status_history ON public.tasks;
CREATE TRIGGER trg_record_task_status_history
  AFTER INSERT OR UPDATE OF status_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.record_task_status_history();

-- ── 2. Update run_automation_rules() with B3 Reassignment Logic ────────────────
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
BEGIN
  v_actual_root_id := COALESCE(p_root_event_id, gen_random_uuid());

  IF p_root_event_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER + 1 INTO v_chain_depth
    FROM automation_rule_runs
    WHERE root_event_id = p_root_event_id;
  ELSE
    v_chain_depth := 1;
  END IF;

  IF v_chain_depth > 5 THEN
    RETURN;
  END IF;

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
                WHERE t.assigned_to = pm.user_id
                  AND ws.category != 'done'
                  AND (ws.retired IS FALSE OR ws.retired IS NULL)
              ) ASC, pm.created_at ASC, pm.user_id ASC
              LIMIT 1;
              IF v_role_holder.user_id IS NOT NULL THEN
                UPDATE tasks SET assigned_to = v_role_holder.user_id WHERE id = v_task_id;
              END IF;
            END IF;

          WHEN 'reassign_to_stage_owner' THEN
            v_target_status_id := (v_action->'params'->>'status_id')::UUID;
            v_fallback_role_id := (v_action->'params'->>'fallback_role_id')::UUID;
            v_lookup_by := COALESCE(v_action->'params'->>'lookup_by', 'to');

            IF v_task_id IS NOT NULL AND v_target_status_id IS NOT NULL THEN
              -- Step 1: Look up previous owner from task_status_history
              IF v_lookup_by = 'from' THEN
                SELECT tsh.assigned_to_at_change INTO v_previous_owner
                FROM public.task_status_history tsh
                WHERE tsh.task_id = v_task_id
                  AND tsh.from_status_id = v_target_status_id
                  AND tsh.assigned_to_at_change IS NOT NULL
                ORDER BY tsh.changed_at DESC
                LIMIT 1;
              ELSE
                SELECT tsh.assigned_to_at_change INTO v_previous_owner
                FROM public.task_status_history tsh
                WHERE tsh.task_id = v_task_id
                  AND tsh.to_status_id = v_target_status_id
                  AND tsh.assigned_to_at_change IS NOT NULL
                ORDER BY tsh.changed_at DESC
                LIMIT 1;
              END IF;

              -- Step 2: B3 Eligibility check on previous owner (must be active project member)
              IF v_previous_owner IS NOT NULL THEN
                SELECT pm.user_id INTO v_previous_owner
                FROM public.project_members pm
                WHERE pm.project_id = p_project_id
                  AND pm.user_id = v_previous_owner
                  AND pm.removed_at IS NULL
                LIMIT 1;
              END IF;

              -- Step 3: Reassign if previous owner is eligible, or fall back to cross-project workload selection
              IF v_previous_owner IS NOT NULL THEN
                UPDATE tasks SET assigned_to = v_previous_owner WHERE id = v_task_id;
              ELSIF v_fallback_role_id IS NOT NULL THEN
                SELECT pm.user_id INTO v_role_holder
                FROM public.project_members pm
                WHERE pm.project_id = p_project_id
                  AND pm.project_role_id = v_fallback_role_id
                  AND pm.removed_at IS NULL
                ORDER BY (
                  SELECT COUNT(*)
                  FROM public.tasks t
                  JOIN public.workflow_statuses ws ON ws.id = t.status_id
                  WHERE t.assigned_to = pm.user_id
                    AND ws.category != 'done'
                    AND (ws.retired IS FALSE OR ws.retired IS NULL)
                ) ASC, pm.created_at ASC, pm.user_id ASC
                LIMIT 1;

                IF v_role_holder.user_id IS NOT NULL THEN
                  UPDATE tasks SET assigned_to = v_role_holder.user_id WHERE id = v_task_id;
                ELSE
                  v_action_result := 'failed';
                  v_error_msg := 'reassign_to_stage_owner: no eligible previous holder at target status and no active member currently holds the fallback role';
                END IF;
              ELSE
                v_action_result := 'failed';
                v_error_msg := 'reassign_to_stage_owner: no eligible previous holder at target status and no fallback role configured';
              END IF;
            ELSE
              v_action_result := 'failed';
              v_error_msg := 'reassign_to_stage_owner: missing target status param or task_id';
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

NOTIFY pgrst, 'reload schema';
`;

async function runSQL(sql, label) {
  console.log(`\n▶ Running: ${label}...`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    console.error(`✗ ${label} FAILED (HTTP ${res.status}):`);
    console.error(typeof data === "object" ? JSON.stringify(data, null, 2) : data);
    return false;
  }

  console.log(`✓ ${label} SUCCESS`);
  return true;
}

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  B3 Migration Application: Reassignment & History");
  console.log("  Project:", PROJECT_REF);
  console.log("═══════════════════════════════════════════════════");

  const ok = await runSQL(SQL, "B3 Migration Update");
  if (!ok) {
    console.error("❌ B3 Migration Failed");
    process.exit(1);
  }

  console.log("\n✅ B3 Migration Applied Successfully!\n");
}

main();

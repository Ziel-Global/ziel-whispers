-- Migration: Auto-fill tenant_id on INSERT
-- Problem: tenant_id is NOT NULL and the RESTRICTIVE policy "tenant_isolation_restrictive" requires
--          tenant_id = current_tenant_id(), but app/edge-function/trigger inserts never send tenant_id,
--          so e.g. clock-in fails with: new row violates row-level security policy.
-- Fix: BEFORE INSERT trigger that fills tenant_id when it is NULL. It never overrides an explicit
--      value, and RLS WITH CHECK still validates the final row.
--
-- Resolution order:
--   1. The caller's tenant (auth.uid() -> users.tenant_id)
--   2. Service-role / cron / trigger fallback: derive from referenced entity on the row
--      (user_id, actor_id, created_by, project_id, task_id, sprint_id, automation_rule_id, goal_id)
--   3. Default workspace fallback ('00000000-0000-0000-0000-000000000001')

CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant UUID;
    v_row JSONB;
    v_ref UUID;
BEGIN
    IF NEW.tenant_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- 1. Authenticated caller
    v_tenant := public.user_tenant_id();

    -- 2. Fallback for service-role / cron / trigger inserts: derive from referenced entity
    IF v_tenant IS NULL THEN
        v_row := to_jsonb(NEW);

        -- Try user references (user_id, actor_id, created_by, author_id, raised_by, sender_id)
        FOREACH v_ref IN ARRAY ARRAY[
            NULLIF(v_row->>'user_id', '')::uuid,
            NULLIF(v_row->>'actor_id', '')::uuid,
            NULLIF(v_row->>'created_by', '')::uuid,
            NULLIF(v_row->>'author_id', '')::uuid,
            NULLIF(v_row->>'raised_by', '')::uuid,
            NULLIF(v_row->>'sender_id', '')::uuid
        ]
        LOOP
            IF v_ref IS NOT NULL THEN
                SELECT tenant_id INTO v_tenant FROM public.users WHERE id = v_ref;
                EXIT WHEN v_tenant IS NOT NULL;
            END IF;
        END LOOP;

        -- Try project_id
        IF v_tenant IS NULL AND NULLIF(v_row->>'project_id', '') IS NOT NULL THEN
            SELECT tenant_id INTO v_tenant FROM public.projects WHERE id = (v_row->>'project_id')::uuid;
        END IF;

        -- Try task_id
        IF v_tenant IS NULL AND NULLIF(v_row->>'task_id', '') IS NOT NULL THEN
            SELECT tenant_id INTO v_tenant FROM public.tasks WHERE id = (v_row->>'task_id')::uuid;
        END IF;

        -- Try sprint_id
        IF v_tenant IS NULL AND NULLIF(v_row->>'sprint_id', '') IS NOT NULL THEN
            SELECT tenant_id INTO v_tenant FROM public.sprints WHERE id = (v_row->>'sprint_id')::uuid;
        END IF;

        -- Try automation_rule_id
        IF v_tenant IS NULL AND NULLIF(v_row->>'automation_rule_id', '') IS NOT NULL THEN
            SELECT tenant_id INTO v_tenant FROM public.automation_rules WHERE id = (v_row->>'automation_rule_id')::uuid;
        END IF;

        -- 3. Default workspace fallback for uncontextualized system rows (e.g. send-email notifications)
        IF v_tenant IS NULL THEN
            v_tenant := '00000000-0000-0000-0000-000000000001'::uuid;
        END IF;
    END IF;

    NEW.tenant_id := v_tenant;
    RETURN NEW;
END;
$$;

-- Attach to every public table that has a NOT NULL tenant_id column
-- (tenant_branding is excluded: its tenant_id is the primary key and must be explicit).
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND c.column_name = 'tenant_id'
          AND c.is_nullable = 'NO'
          AND t.table_type = 'BASE TABLE'
          AND c.table_name NOT IN ('tenant_branding')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_id ON public.%I', r.table_name);
        EXECUTE format(
            'CREATE TRIGGER trg_set_tenant_id BEFORE INSERT ON public.%I
             FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert()',
            r.table_name
        );
    END LOOP;
END $$;

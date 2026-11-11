-- Migration: 20271106010000_phase2_rls_policies_security_layer.sql
-- Description: Phase 2 RLS Security Layer & Foundation Self-Healing
-- Ensures public.tenants and tenant_branding exist, seeds Tenant 1, ensures all tables have tenant_id,
-- creates public.platform_roles and cached auth helper functions (public.current_tenant_id, public.platform_role),
-- and applies RESTRICTIVE tenant isolation policies across all tables.

-- ============================================================================
-- STEP 1: Foundation Schema & Tenants Setup (Idempotent)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_status') THEN
        CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended', 'trial', 'archived');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status public.tenant_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_branding (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    app_name TEXT NOT NULL DEFAULT 'Ziel Whispers',
    logo_url TEXT,
    favicon_url TEXT,
    primary_color TEXT NOT NULL DEFAULT '17 84% 52%',
    secondary_color TEXT NOT NULL DEFAULT '40 8% 96%',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Tenant 1 (Ziel Default Workspace)
DO $$
DECLARE
    v_default_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    INSERT INTO public.tenants (id, name, slug, status)
    VALUES (v_default_tenant_id, 'Ziel Default Workspace', 'ziel-default', 'active')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.tenant_branding (tenant_id, app_name, primary_color, secondary_color)
    VALUES (v_default_tenant_id, 'Ziel Whispers', '17 84% 52%', '40 8% 96%')
    ON CONFLICT (tenant_id) DO NOTHING;
END $$;

-- Add tenant_id and backfill Tenant 1 on all tables
DO $$
DECLARE
    v_default_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
    v_tables TEXT[] := ARRAY[
        'users',
        'attendance',
        'auto_clockout_acks',
        'remote_work_requests',
        'daily_logs',
        'daily_standups',
        'missed_logs',
        'leave_requests',
        'leave_balances',
        'leave_types',
        'projects',
        'project_settings',
        'project_settings_kv',
        'project_roles',
        'project_members',
        'project_phases',
        'sprints',
        'sprint_snapshots',
        'project_health_snapshots',
        'project_status_updates',
        'workflow_templates',
        'workflow_statuses',
        'workflow_transitions',
        'task_types',
        'tasks',
        'task_collaborators',
        'task_dependencies',
        'task_comments',
        'task_blockers',
        'task_status_history',
        'task_schedule_snapshots',
        'automation_rules',
        'automation_rule_runs',
        'clients',
        'client_action_items',
        'client_action_item_messages',
        'client_portal_messages',
        'skills',
        'employee_skills',
        'project_skill_requirements',
        'skill_evaluations',
        'announcements',
        'announcement_reads',
        'notifications',
        'holidays',
        'audit_logs',
        'system_settings',
        'goals',
        'goal_resources'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY v_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE', t);
            EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', t, v_default_tenant_id);
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)', 'idx_' || t || '_tenant_id', t);
        END IF;
    END LOOP;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'login_attempts') THEN
        ALTER TABLE public.login_attempts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_login_attempts_tenant_id ON public.login_attempts (tenant_id);
    END IF;
END $$;

-- Adjust Unique Constraints for Multi-Tenancy
DO $$
DECLARE
    r RECORD;
BEGIN
    -- system_settings
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_settings') THEN
        FOR r IN (
            SELECT conname FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE n.nspname = 'public' AND t.relname = 'system_settings' AND c.contype = 'u'
        ) LOOP
            EXECUTE format('ALTER TABLE public.system_settings DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;
        DROP INDEX IF EXISTS public.system_settings_key_key;
        DROP INDEX IF EXISTS public.idx_system_settings_key;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_tenant_key_unique') THEN
            ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_tenant_key_unique UNIQUE (tenant_id, key);
        END IF;
    END IF;

    -- skills
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'skills') THEN
        FOR r IN (
            SELECT conname FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE n.nspname = 'public' AND t.relname = 'skills' AND c.contype = 'u'
        ) LOOP
            EXECUTE format('ALTER TABLE public.skills DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;
        DROP INDEX IF EXISTS public.skills_name_key;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'skills_tenant_name_unique') THEN
            ALTER TABLE public.skills ADD CONSTRAINT skills_tenant_name_unique UNIQUE (tenant_id, name);
        END IF;
    END IF;

    -- leave_types
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_types') THEN
        FOR r IN (
            SELECT conname FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE n.nspname = 'public' AND t.relname = 'leave_types' AND c.contype = 'u'
        ) LOOP
            EXECUTE format('ALTER TABLE public.leave_types DROP CONSTRAINT IF EXISTS %I', r.conname);
        END LOOP;
        DROP INDEX IF EXISTS public.leave_types_name_key;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_types_tenant_name_unique') THEN
            ALTER TABLE public.leave_types ADD CONSTRAINT leave_types_tenant_name_unique UNIQUE (tenant_id, name);
        END IF;
    END IF;

    -- holidays
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'holidays') THEN
        ALTER TABLE public.holidays DROP CONSTRAINT IF EXISTS holidays_date_region_unique;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'holidays_tenant_date_region_unique') THEN
            ALTER TABLE public.holidays ADD CONSTRAINT holidays_tenant_date_region_unique UNIQUE (tenant_id, date, region);
        END IF;
    END IF;

    -- task_types
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_types') THEN
        DROP INDEX IF EXISTS public.idx_task_types_project_name;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_task_types_tenant_project_name
            ON public.task_types (tenant_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), name);
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Platform Roles Table & Enums
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_role_type') THEN
        CREATE TYPE public.platform_role_type AS ENUM (
            'Master_SSA',
            'Provisioning_SSA',
            'Support_SSA'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.platform_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.platform_role_type NOT NULL,
    granted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Cached Helper Functions (In schema public with SECURITY DEFINER)
-- ============================================================================

-- Current Tenant ID (Only returns if tenant is active)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.tenant_id 
    FROM public.users u
    JOIN public.tenants t ON t.id = u.tenant_id
    WHERE u.id = auth.uid() 
      AND t.status = 'active'
    LIMIT 1;
$$;

-- User's Raw Tenant ID (Returns tenant_id regardless of active/suspended status)
CREATE OR REPLACE FUNCTION public.user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Current User's Platform Role (Returns Master_SSA, Provisioning_SSA, Support_SSA, or NULL)
CREATE OR REPLACE FUNCTION public.platform_role()
RETURNS public.platform_role_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.platform_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Helper: Is User an SSA?
CREATE OR REPLACE FUNCTION public.is_ssa()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.platform_roles WHERE user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_tenant_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.platform_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_ssa() TO authenticated, anon;

-- ============================================================================
-- STEP 4: Dedicated RLS Policies for Tenancy & Platform Tables
-- ============================================================================

-- platform_roles
DROP POLICY IF EXISTS "platform_roles_select_policy" ON public.platform_roles;
CREATE POLICY "platform_roles_select_policy"
ON public.platform_roles
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR public.platform_role() = 'Master_SSA'
);

DROP POLICY IF EXISTS "platform_roles_modify_policy" ON public.platform_roles;
CREATE POLICY "platform_roles_modify_policy"
ON public.platform_roles
FOR ALL
TO authenticated
USING (public.platform_role() = 'Master_SSA')
WITH CHECK (public.platform_role() = 'Master_SSA');

-- tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_read_policy" ON public.tenants;
CREATE POLICY "tenants_read_policy"
ON public.tenants
FOR SELECT
TO authenticated
USING (
    id = public.user_tenant_id()
    OR public.platform_role() IS NOT NULL
);

DROP POLICY IF EXISTS "tenants_write_policy" ON public.tenants;
CREATE POLICY "tenants_write_policy"
ON public.tenants
FOR ALL
TO authenticated
USING (public.platform_role() IN ('Master_SSA', 'Provisioning_SSA'))
WITH CHECK (public.platform_role() IN ('Master_SSA', 'Provisioning_SSA'));

-- tenant_branding
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_branding_read_policy" ON public.tenant_branding;
CREATE POLICY "tenant_branding_read_policy"
ON public.tenant_branding
FOR SELECT
TO authenticated
USING (
    tenant_id = public.user_tenant_id()
    OR public.platform_role() IS NOT NULL
);

DROP POLICY IF EXISTS "tenant_branding_update_policy" ON public.tenant_branding;
CREATE POLICY "tenant_branding_update_policy"
ON public.tenant_branding
FOR UPDATE
TO authenticated
USING (
    (tenant_id = public.current_tenant_id() AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
    OR public.platform_role() = 'Master_SSA'
)
WITH CHECK (
    (tenant_id = public.current_tenant_id() AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
    OR public.platform_role() = 'Master_SSA'
);

DROP POLICY IF EXISTS "tenant_branding_insert_policy" ON public.tenant_branding;
CREATE POLICY "tenant_branding_insert_policy"
ON public.tenant_branding
FOR INSERT
TO authenticated
WITH CHECK (
    public.platform_role() IN ('Master_SSA', 'Provisioning_SSA')
);

-- ============================================================================
-- STEP 5: Apply RESTRICTIVE Tenant Isolation Policies to All Scoped Tables
-- ============================================================================

DO $$
DECLARE
    v_tables TEXT[] := ARRAY[
        'attendance',
        'auto_clockout_acks',
        'remote_work_requests',
        'daily_logs',
        'daily_standups',
        'missed_logs',
        'leave_requests',
        'leave_balances',
        'leave_types',
        'projects',
        'project_settings',
        'project_settings_kv',
        'project_roles',
        'project_members',
        'project_phases',
        'sprints',
        'sprint_snapshots',
        'project_health_snapshots',
        'project_status_updates',
        'workflow_templates',
        'workflow_statuses',
        'workflow_transitions',
        'task_types',
        'tasks',
        'task_collaborators',
        'task_dependencies',
        'task_comments',
        'task_blockers',
        'task_status_history',
        'task_schedule_snapshots',
        'automation_rules',
        'automation_rule_runs',
        'clients',
        'client_action_items',
        'client_action_item_messages',
        'client_portal_messages',
        'skills',
        'employee_skills',
        'project_skill_requirements',
        'skill_evaluations',
        'announcements',
        'announcement_reads',
        'notifications',
        'holidays',
        'audit_logs',
        'system_settings',
        'goals',
        'goal_resources'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY v_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_restrictive" ON public.%I', t);

            EXECUTE format('
                CREATE POLICY "tenant_isolation_restrictive"
                ON public.%I
                AS RESTRICTIVE
                FOR ALL
                TO authenticated
                USING (
                    tenant_id = public.current_tenant_id()
                    OR public.platform_role() IS NOT NULL
                )
                WITH CHECK (
                    tenant_id = public.current_tenant_id()
                    OR public.platform_role() IN (''Master_SSA'', ''Provisioning_SSA'')
                )
            ', t);
        END IF;
    END LOOP;

    -- Special Restrictive Policy on `users` table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "tenant_isolation_restrictive" ON public.users;
        
        CREATE POLICY "tenant_isolation_restrictive"
        ON public.users
        AS RESTRICTIVE
        FOR ALL
        TO authenticated
        USING (
            id = auth.uid()
            OR tenant_id = public.current_tenant_id()
            OR public.platform_role() IS NOT NULL
        )
        WITH CHECK (
            id = auth.uid()
            OR tenant_id = public.current_tenant_id()
            OR public.platform_role() IN ('Master_SSA', 'Provisioning_SSA')
        );
    END IF;
END $$;

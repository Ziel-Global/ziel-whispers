-- Migration: 20271106000000_phase1_multitenant_foundation.sql
-- Description: Phase 1 Multi-Tenant Foundation & Grandfather Migration
-- Creates tenants, tenant_branding, seeds Tenant 1 (Ziel Default Workspace),
-- adds tenant_id to all tenant-scoped tables, backfills historical data, and enforces NOT NULL.

-- 1. Create Tenant Status Enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_status') THEN
        CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended', 'trial', 'archived');
    END IF;
END $$;

-- 2. Create Tenants Master Table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status public.tenant_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create Tenant White-Labeling & Branding Configuration Table
CREATE TABLE IF NOT EXISTS public.tenant_branding (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    app_name TEXT NOT NULL DEFAULT 'Ziel Whispers',
    logo_url TEXT,
    favicon_url TEXT,
    primary_color TEXT NOT NULL DEFAULT '17 84% 52%',
    secondary_color TEXT NOT NULL DEFAULT '40 8% 96%',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on Tenants & Branding early (base definition)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;

-- 4. Seed Tenant 1 (Ziel Default Workspace) & Default Branding
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

-- 5. Helper Function / Loop to Add tenant_id, Backfill Tenant 1, and Set NOT NULL
-- Pre-step: Ensure any historical logs in production don't fail CHECK constraint on UPDATE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'daily_logs_category_check'
          AND conrelid = 'public.daily_logs'::regclass
    ) THEN
        ALTER TABLE public.daily_logs DROP CONSTRAINT daily_logs_category_check;
        ALTER TABLE public.daily_logs ADD CONSTRAINT daily_logs_category_check
        CHECK (category = ANY (ARRAY[
          'development'::text, 
          'meeting'::text, 
          'bug_fix'::text, 
          'code_review'::text, 
          'deployment'::text, 
          'documentation'::text, 
          'testing'::text, 
          'marketing'::text, 
          'seo'::text, 
          'research'::text, 
          'posting'::text, 
          'designing'::text, 
          'other'::text,
          'outbound_calls'::text
        ])) NOT VALID;
    END IF;
END $$;

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
        -- Check if table exists in public schema
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- 1. Add tenant_id column if missing
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE', t);
            
            -- 2. Backfill existing records to Tenant 1
            EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', t, v_default_tenant_id);
            
            -- 3. Enforce NOT NULL constraint
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
            
            -- 4. Create Index on tenant_id for high-performance joins and RLS filtering
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)', 'idx_' || t || '_tenant_id', t);
        END IF;
    END LOOP;

    -- Special handling for login_attempts (nullable tenant_id since logins may happen before tenant identification)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'login_attempts') THEN
        ALTER TABLE public.login_attempts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_login_attempts_tenant_id ON public.login_attempts (tenant_id);
    END IF;
END $$;

-- 6. Adjust Unique Constraints for Multi-Tenancy

-- 6a. System Settings: Scope uniqueness to (tenant_id, key)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'system_settings' AND c.contype = 'u'
    ) LOOP
        EXECUTE format('ALTER TABLE public.system_settings DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;
    
    DROP INDEX IF EXISTS public.system_settings_key_key;
    DROP INDEX IF EXISTS public.idx_system_settings_key;
    
    ALTER TABLE public.system_settings ADD CONSTRAINT system_settings_tenant_key_unique UNIQUE (tenant_id, key);
END $$;

-- 6b. Skills: Scope uniqueness to (tenant_id, name)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'skills' AND c.contype = 'u'
    ) LOOP
        EXECUTE format('ALTER TABLE public.skills DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    DROP INDEX IF EXISTS public.skills_name_key;
    ALTER TABLE public.skills ADD CONSTRAINT skills_tenant_name_unique UNIQUE (tenant_id, name);
END $$;

-- 6c. Leave Types: Scope uniqueness to (tenant_id, name)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' AND t.relname = 'leave_types' AND c.contype = 'u'
    ) LOOP
        EXECUTE format('ALTER TABLE public.leave_types DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    DROP INDEX IF EXISTS public.leave_types_name_key;
    ALTER TABLE public.leave_types ADD CONSTRAINT leave_types_tenant_name_unique UNIQUE (tenant_id, name);
END $$;

-- 6d. Holidays: Scope uniqueness to (tenant_id, date, region)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'holidays') THEN
        ALTER TABLE public.holidays DROP CONSTRAINT IF EXISTS holidays_date_region_unique;
        ALTER TABLE public.holidays ADD CONSTRAINT holidays_tenant_date_region_unique UNIQUE (tenant_id, date, region);
    END IF;
END $$;

-- 6e. Task Types: Update index to include tenant_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_types') THEN
        DROP INDEX IF EXISTS public.idx_task_types_project_name;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_task_types_tenant_project_name
            ON public.task_types (tenant_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), name);
    END IF;
END $$;


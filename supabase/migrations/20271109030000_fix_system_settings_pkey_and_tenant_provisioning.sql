-- Migration: 20271109030000_fix_system_settings_pkey_and_tenant_provisioning.sql
-- Description:
--   1. Fix public.system_settings primary key: drop the legacy single-tenant PRIMARY KEY (key)
--      constraint ("system_settings_pkey") that was missed by earlier migrations (which only
--      dropped contype = 'u' unique constraints), and replace it with PRIMARY KEY (tenant_id, key).
--   2. Clean up orphaned tenant_admin accounts in auth.users / public.users that were created
--      by client-side signUp() before provision_tenant_workspace failed on system_settings_pkey.
--   3. Skip workforce leave_balances trigger for non-workforce tenant_admin accounts.
--   4. Update provision_tenant_workspace() to handle leave_types column naming (days_per_year vs days_allowed)
--      and remove any default-tenant leave_balances rows for the newly provisioned tenant admin.

-- ============================================================================
-- 1. Fix public.system_settings Primary Key -> (tenant_id, key)
-- ============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all existing PRIMARY KEY ('p') and UNIQUE ('u') constraints on public.system_settings
    FOR r IN (
        SELECT conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.relname = 'system_settings'
          AND c.contype IN ('p', 'u')
    ) LOOP
        EXECUTE format('ALTER TABLE public.system_settings DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    DROP INDEX IF EXISTS public.system_settings_pkey;
    DROP INDEX IF EXISTS public.system_settings_key_key;
    DROP INDEX IF EXISTS public.idx_system_settings_key;

    -- Deduplicate any hypothetical duplicate (tenant_id, key) rows before adding composite PK
    DELETE FROM public.system_settings a
    USING public.system_settings b
    WHERE a.ctid < b.ctid
      AND a.tenant_id = b.tenant_id
      AND a.key = b.key;

    -- Add composite primary key on (tenant_id, key)
    ALTER TABLE public.system_settings
        ADD CONSTRAINT system_settings_pkey PRIMARY KEY (tenant_id, key);
END $$;

-- ============================================================================
-- 2. Clean Up Orphaned tenant_admin Users From Previous Failed Provisioning
-- ============================================================================
DO $$
DECLARE
    v_default_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
    v_orphan_ids UUID[];
BEGIN
    SELECT ARRAY_AGG(au.id)
    INTO v_orphan_ids
    FROM auth.users au
    LEFT JOIN public.users pu ON pu.id = au.id
    WHERE au.raw_user_meta_data->>'user_type' = 'tenant_admin'
      AND (pu.id IS NULL OR pu.tenant_id = v_default_tenant_id)
      AND NOT EXISTS (
          SELECT 1 FROM public.platform_roles pr WHERE pr.user_id = au.id
      );

    IF v_orphan_ids IS NOT NULL AND array_length(v_orphan_ids, 1) > 0 THEN
        DELETE FROM public.project_members WHERE user_id = ANY(v_orphan_ids);
        DELETE FROM public.auto_clockout_acks WHERE user_id = ANY(v_orphan_ids);
        DELETE FROM public.audit_logs WHERE actor_id = ANY(v_orphan_ids) OR target_id = ANY(v_orphan_ids);
        DELETE FROM public.attendance WHERE user_id = ANY(v_orphan_ids);
        DELETE FROM public.daily_logs WHERE user_id = ANY(v_orphan_ids);
        DELETE FROM public.daily_standups WHERE user_id = ANY(v_orphan_ids);
        DELETE FROM public.leave_requests WHERE user_id = ANY(v_orphan_ids);
        DELETE FROM public.notifications WHERE user_id = ANY(v_orphan_ids);
        DELETE FROM public.leave_balances WHERE user_id = ANY(v_orphan_ids);
        DELETE FROM public.announcement_reads WHERE user_id = ANY(v_orphan_ids);
        DELETE FROM public.announcements WHERE created_by = ANY(v_orphan_ids);
        DELETE FROM public.missed_logs WHERE user_id = ANY(v_orphan_ids);
        DELETE FROM public.remote_work_requests WHERE user_id = ANY(v_orphan_ids);
        DELETE FROM public.users WHERE id = ANY(v_orphan_ids);
        DELETE FROM auth.identities WHERE user_id = ANY(v_orphan_ids);
        DELETE FROM auth.users WHERE id = ANY(v_orphan_ids);
    END IF;
END $$;

-- ============================================================================
-- 3. Update handle_new_user_leave_balances Trigger Function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_leave_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entitlement integer;
  v_leave_year integer;
  v_tenant_id uuid;
BEGIN
  -- Skip tenant owners / platform-provisioned administrators (not HR workforce members)
  IF NEW.employment_type IS NULL AND NEW.designation = 'Tenant Administrator' THEN
    RETURN NEW;
  END IF;

  v_tenant_id := COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000001'::uuid);

  SELECT COALESCE(value::integer, 12) INTO v_entitlement
  FROM public.system_settings
  WHERE tenant_id = v_tenant_id AND key = 'annual_leave_entitlement';

  IF v_entitlement IS NULL THEN
    v_entitlement := 12;
  END IF;

  v_leave_year := public.get_leave_year();

  INSERT INTO public.leave_balances (tenant_id, user_id, leave_type_id, year, total_days, used_days)
  SELECT v_tenant_id, NEW.id, lt.id, v_leave_year, v_entitlement, 0
  FROM public.leave_types lt
  WHERE lt.tenant_id = v_tenant_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user_leave_balances error for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 4. Update Atomic Tenant Provisioning RPC (provision_tenant_workspace)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.provision_tenant_workspace(
    p_tenant_name TEXT,
    p_tenant_slug TEXT,
    p_admin_user_id UUID,
    p_admin_email TEXT,
    p_admin_full_name TEXT,
    p_primary_color TEXT DEFAULT '17 84% 52%',
    p_secondary_color TEXT DEFAULT '40 8% 96%',
    p_logo_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_clean_slug TEXT;
BEGIN
    -- Verify SSA Permissions
    IF public.platform_role() NOT IN ('Master_SSA', 'Provisioning_SSA') THEN
        RAISE EXCEPTION 'Access Denied: Caller does not possess SSA provisioning authority.';
    END IF;

    -- Validate Inputs
    IF trim(COALESCE(p_tenant_name, '')) = '' THEN
        RAISE EXCEPTION 'Tenant name cannot be empty.';
    END IF;

    v_clean_slug := lower(regexp_replace(trim(COALESCE(p_tenant_slug, '')), '[^a-zA-Z0-9\-]', '-', 'g'));
    IF v_clean_slug = '' THEN
        RAISE EXCEPTION 'Tenant slug cannot be empty.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_clean_slug) THEN
        RAISE EXCEPTION 'Tenant with slug % already exists.', v_clean_slug;
    END IF;

    -- 1. Create Tenant Record
    INSERT INTO public.tenants (name, slug, status)
    VALUES (trim(p_tenant_name), v_clean_slug, 'active')
    RETURNING id INTO v_tenant_id;

    -- 2. Create Default White-Label Branding
    INSERT INTO public.tenant_branding (
        tenant_id,
        app_name,
        logo_url,
        primary_color,
        secondary_color
    ) VALUES (
        v_tenant_id,
        trim(p_tenant_name),
        p_logo_url,
        COALESCE(p_primary_color, '17 84% 52%'),
        COALESCE(p_secondary_color, '40 8% 96%')
    );

    -- 3. Upsert Tenant Admin in public.users and repoint to the new tenant
    INSERT INTO public.users (
        id,
        tenant_id,
        email,
        full_name,
        role,
        department,
        designation,
        employment_type,
        join_date,
        status,
        working_days,
        must_change_password
    ) VALUES (
        p_admin_user_id,
        v_tenant_id,
        trim(lower(p_admin_email)),
        trim(p_admin_full_name),
        'admin',
        'Executive',
        'Tenant Administrator',
        NULL,
        CURRENT_DATE,
        'active',
        5,
        false
    )
    ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        department = EXCLUDED.department,
        designation = EXCLUDED.designation,
        employment_type = NULL,
        status = 'active',
        working_days = EXCLUDED.working_days,
        must_change_password = EXCLUDED.must_change_password;

    -- Remove any leave_balances or missed_logs rows created under the default tenant during initial auth trigger
    DELETE FROM public.leave_balances
    WHERE user_id = p_admin_user_id
      AND tenant_id != v_tenant_id;

    DELETE FROM public.missed_logs
    WHERE user_id = p_admin_user_id
      AND tenant_id != v_tenant_id;

    -- 4. Seed Bare Minimum System Settings (Timezone, Shift Hours, Session Timeout)
    INSERT INTO public.system_settings (tenant_id, key, value) VALUES
        (v_tenant_id, 'app_name', trim(p_tenant_name)),
        (v_tenant_id, 'timezone', 'Asia/Karachi'),
        (v_tenant_id, 'default_shift_start', '09:00'),
        (v_tenant_id, 'default_shift_end', '18:00'),
        (v_tenant_id, 'session_timeout_hours', '12')
    ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;

    -- 5. Seed Bare Minimum Leave Types (Annual & Sick only)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'leave_types' AND column_name = 'days_per_year'
    ) THEN
        INSERT INTO public.leave_types (tenant_id, name, days_per_year, is_paid) VALUES
            (v_tenant_id, 'Annual Leave', 14, true),
            (v_tenant_id, 'Sick Leave', 8, true)
        ON CONFLICT (tenant_id, name) DO NOTHING;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'leave_types' AND column_name = 'days_allowed'
    ) THEN
        EXECUTE 'INSERT INTO public.leave_types (tenant_id, name, days_allowed) VALUES ($1, ''Annual Leave'', 14), ($1, ''Sick Leave'', 8) ON CONFLICT (tenant_id, name) DO NOTHING'
        USING v_tenant_id;
    END IF;

    RETURN v_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_tenant_workspace(
    TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- Migration: 20271106030000_phase4_storage_isolation.sql
-- Description: Phase 4 Storage Isolation for White-Labeling Assets
-- Creates the `tenant-assets` storage bucket and establishes Row Level Security (RLS)
-- policies on storage.objects ensuring tenant-partitioned paths (`tenant-assets/<tenant_id>/...`).

-- 1. Create `tenant-assets` Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-assets', 'tenant-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Read Policy: Public can view tenant branding assets (needed for login page / headers)
DROP POLICY IF EXISTS "Public can view tenant branding assets" ON storage.objects;
CREATE POLICY "Public can view tenant branding assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-assets');

-- 3. Upload Policy: Only Tenant Admin or Platform SSA can upload to their tenant directory
DROP POLICY IF EXISTS "Admins can upload tenant assets" ON storage.objects;
CREATE POLICY "Admins can upload tenant assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (
        (
            (storage.foldername(name))[1] = public.current_tenant_id()::text
            AND EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid() AND role = 'admin'
            )
        )
        OR public.platform_role() IN ('Master_SSA', 'Provisioning_SSA')
    )
);

-- 4. Update Policy: Only Tenant Admin or Master SSA can update/overwrite tenant assets
DROP POLICY IF EXISTS "Admins can update tenant assets" ON storage.objects;
CREATE POLICY "Admins can update tenant assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'tenant-assets'
    AND (
        (
            (storage.foldername(name))[1] = public.current_tenant_id()::text
            AND EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid() AND role = 'admin'
            )
        )
        OR public.platform_role() = 'Master_SSA'
    )
)
WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (
        (
            (storage.foldername(name))[1] = public.current_tenant_id()::text
            AND EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid() AND role = 'admin'
            )
        )
        OR public.platform_role() = 'Master_SSA'
    )
);

-- 5. Delete Policy: Only Tenant Admin or Master SSA can delete tenant assets
DROP POLICY IF EXISTS "Admins can delete tenant assets" ON storage.objects;
CREATE POLICY "Admins can delete tenant assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'tenant-assets'
    AND (
        (
            (storage.foldername(name))[1] = public.current_tenant_id()::text
            AND EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid() AND role = 'admin'
            )
        )
        OR public.platform_role() = 'Master_SSA'
    )
);


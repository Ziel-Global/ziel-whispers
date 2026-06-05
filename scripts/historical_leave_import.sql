-- ============================================================================
-- Historical Leave Data Import Script
-- ============================================================================
-- This script imports historical leave records from a client-provided sheet
-- into the 2025-2026 leave year (June 1, 2025 - May 31, 2026).
--
-- Usage:
--   1. Populate the temp table below with CSV data from the sheet
--   2. Run this script in Supabase SQL Editor
--   3. Verify the results with the SELECT queries at the bottom
-- ============================================================================

-- Step 1: Create a staging table matching the sheet columns
CREATE TEMP TABLE temp_historical_leaves (
  employee_name text,       -- Full name as in users table
  employee_email text,      -- Email for user lookup (preferred)
  leave_type_original text, -- Original leave type from sheet
  start_date date,
  end_date date,
  reason text,              -- Optional notes from sheet
  row_id text               -- Unique row identifier from sheet for dedup
);

-- ============================================================================
-- STEP 2: Populate the staging table
-- ============================================================================
-- REPLACE THIS SECTION with the actual data from the sheet.
-- Example format (populate with your actual data):
--
-- INSERT INTO temp_historical_leaves VALUES
--   ('John Doe', 'john@example.com', 'Bereavement', '2025-07-15', '2025-07-16', 'Family funeral', 'row_001'),
--   ('Jane Smith', 'jane@example.com', 'Aitekaf Leaves', '2025-08-10', '2025-08-12', 'Aitekaf', 'row_002'),
--   ('John Doe', 'john@example.com', 'Wedding Leave', '2025-09-01', '2025-09-03', 'Sister wedding', 'row_003');
--
-- IMPORTANT: Make sure employee_email matches the email in public.users table.
-- If using employee_name instead, adjust the JOIN in Step 5.

-- ============================================================================
-- STEP 3: Remove duplicates (same person, same dates, same original type)
-- ============================================================================
DELETE FROM temp_historical_leaves t1
USING temp_historical_leaves t2
WHERE t1.ctid < t2.ctid
  AND COALESCE(t1.employee_email, '') = COALESCE(t2.employee_email, '')
  AND COALESCE(t1.employee_name, '') = COALESCE(t2.employee_name, '')
  AND t1.start_date = t2.start_date
  AND t1.end_date = t2.end_date
  AND t1.leave_type_original = t2.leave_type_original;

-- ============================================================================
-- STEP 4: Insert into leave_requests
-- ============================================================================
-- Map unknown leave types to Personal Leave
-- Types that exist in system: Sick Leave, Personal Leave, Bereavement,
-- Casual Leave, Hourly Leave, Other
-- Types that should be mapped to Personal Leave: Aitekaf Leaves, Marriage Leave,
-- Medical Emergency, Wedding Leave (and any other unknown types)

DO $$
DECLARE
  v_personal_leave_id uuid;
  v_record record;
  v_days_count integer;
  v_lookup_email text;
  v_user_id uuid;
  v_skip boolean;
  v_imported integer := 0;
  v_skipped integer := 0;
  v_unknown_email integer := 0;
BEGIN
  -- Get the Personal Leave type ID (created by migration)
  SELECT id INTO v_personal_leave_id
  FROM public.leave_types
  WHERE name = 'Personal Leave';

  IF v_personal_leave_id IS NULL THEN
    RAISE EXCEPTION 'Personal Leave type not found. Run the leave year migration first.';
  END IF;

  -- List of leave types that exist in the system
  -- These will be matched by name (case-insensitive)
  CREATE TEMP TABLE known_types AS
  SELECT LOWER(name) as name FROM public.leave_types;

  FOR v_record IN
    SELECT * FROM temp_historical_leaves
    ORDER BY employee_email, start_date
  LOOP
    -- Skip if no user found
    CONTINUE WHEN v_record.employee_email IS NULL AND v_record.employee_name IS NULL;

    -- Look up user by email first, then by name
    v_user_id := NULL;
    IF v_record.employee_email IS NOT NULL THEN
      SELECT id INTO v_user_id FROM public.users
      WHERE email = v_record.employee_email;
    END IF;

    IF v_user_id IS NULL AND v_record.employee_name IS NOT NULL THEN
      SELECT id INTO v_user_id FROM public.users
      WHERE full_name ILIKE v_record.employee_name;
    END IF;

    IF v_user_id IS NULL THEN
      RAISE WARNING 'User not found for email=% name=%; skipping', v_record.employee_email, v_record.employee_name;
      v_unknown_email := v_unknown_email + 1;
      CONTINUE;
    END IF;

    -- Calculate working days count (exclude Fridays/Saturdays for 5-day week)
    -- Using 5-day week as default (Sunday=0, Saturday=6)
    v_days_count := GREATEST(1, (
      SELECT COUNT(*)
      FROM generate_series(v_record.start_date, v_record.end_date, '1 day'::interval) d
      WHERE EXTRACT(ISODOW FROM d) < 6
    ));

    -- Check if this exact record already exists (dedup against existing data)
    v_skip := EXISTS (
      SELECT 1 FROM public.leave_requests
      WHERE user_id = v_user_id
        AND start_date = v_record.start_date
        AND end_date = v_record.end_date
        AND reason ILIKE v_record.leave_type_original || '%'
        AND status = 'approved'
    );

    IF v_skip THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Insert the leave request
    INSERT INTO public.leave_requests (
      user_id,
      leave_type_id,
      start_date,
      end_date,
      days_count,
      reason,
      status,
      created_at,
      reviewed_at
    ) VALUES (
      v_user_id,
      v_personal_leave_id,
      v_record.start_date,
      v_record.end_date,
      v_days_count,
      v_record.leave_type_original || COALESCE(': ' || v_record.reason, ''),
      'approved',
      v_record.start_date,
      v_record.start_date
    );

    v_imported := v_imported + 1;
  END LOOP;

  RAISE NOTICE 'Import complete: % imported, % skipped (duplicates), % skipped (unknown user)', v_imported, v_skipped, v_unknown_email;

  DROP TABLE IF EXISTS known_types;
END;
$$;

-- ============================================================================
-- Step 5: Clean up
-- ============================================================================
DROP TABLE IF EXISTS temp_historical_leaves;

-- ============================================================================
-- Step 6: Verification queries
-- ============================================================================
-- Check import results by user:
-- SELECT
--   u.full_name,
--   COUNT(*) as total_requests,
--   SUM(lr.days_count) as total_days
-- FROM public.leave_requests lr
-- JOIN public.users u ON u.id = lr.user_id
-- WHERE lr.created_at >= '2025-06-01'
--   AND lr.created_at < '2026-06-01'
--   AND lr.reason LIKE 'Bereavement%' OR lr.reason LIKE 'Aitekaf%'
--      OR lr.reason LIKE 'Marriage%' OR lr.reason LIKE 'Medical%'
--      OR lr.reason LIKE 'Wedding%'
-- GROUP BY u.full_name
-- ORDER BY u.full_name;

-- Check total imported records:
-- SELECT COUNT(*) as total_imported FROM public.leave_requests
-- WHERE reason LIKE 'Bereavement%'
--    OR reason LIKE 'Aitekaf%'
--    OR reason LIKE 'Marriage%'
--    OR reason LIKE 'Medical%'
--    OR reason LIKE 'Wedding%';

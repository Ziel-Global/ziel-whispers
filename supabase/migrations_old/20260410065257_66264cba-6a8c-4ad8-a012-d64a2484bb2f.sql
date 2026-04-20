
-- Seed admin user in auth.users and public.users
-- We use Supabase's auth.users via raw insert for the seed
-- Password: Admin@123456

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at, confirmation_token
)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'admin@ziel.com',
  extensions.crypt('Admin@123456', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"System Admin"}',
  'authenticated',
  'authenticated',
  now(),
  now(),
  ''
)
ON CONFLICT (id) DO NOTHING;

-- Also add identity for the user
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'email', 'admin@ziel.com'),
  'email',
  'admin@ziel.com',
  now(),
  now(),
  now()
)
ON CONFLICT DO NOTHING;

-- Insert admin profile in public.users
INSERT INTO public.users (
  id, email, full_name, role, department, designation,
  employment_type, join_date, must_change_password, status
)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'admin@ziel.com',
  'System Admin',
  'admin',
  'Management',
  'System Administrator',
  'full-time',
  CURRENT_DATE,
  false,
  'active'
)
ON CONFLICT (id) DO NOTHING;

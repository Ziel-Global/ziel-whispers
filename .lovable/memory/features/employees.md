---
name: Employee Management
description: Phase 2 features — employee directory, create/edit/deactivate, CSV import, self-profile
type: feature
---

## Pages
- `/employees` — Directory table with search, dept/status/type filters, CSV import dialog
- `/employees/new` — Admin-only create form with Zod validation, calls invite-user edge function
- `/employees/:id` — Admin edit view with deactivate/reactivate, email change warning modal
- `/profile` — Self-view with editable phone/photo/shift/reminder + change password section

## Edge Functions
- `invite-user` — Accepts password param, creates auth user + public.users row + audit_log
- `manage-user` — Actions: deactivate (ban user), reactivate (unban), update_email

## Storage
- `avatars` bucket (public) with per-user folder RLS policies

## Key Decisions
- Admins set initial password; employee must change on first login (must_change_password flag)
- Deactivated users are banned for ~100 years, never deleted
- CSV import generates random temp passwords for each imported user
- Email changes go through manage-user edge function to sync auth + public.users

# Project Memory

## Core
Ziel Logs — Work Log & HR Management System. Dual-tone: dark sidebar #1A1B1E, light content #FBFBFB, accent #D0FF71.
Font: Host Grotesk. Primary buttons: #D0FF71 bg, #000 text, 8px radius. No gradients, no heavy shadows.
Supabase connected (ref: goutpygixoxkgbrfmkey). Admin seed: admin@ziel.com / Admin@123456.
Roles: admin, manager, employee. RBAC via get_my_role() security definer function.
Built in 6 phases. Resend API for email notifications.

## Memories
- [Design tokens](mem://design/tokens) — Full color palette, border radius, font config
- [Auth flow](mem://features/auth) — Login, set-password, reset-password, invite-user edge function
- [Navigation](mem://features/navigation) — Role-based sidebar nav items for admin vs employee
- [Employees](mem://features/employees) — Employee CRUD, CSV import, avatar upload, leave balances
- [Phase 4](mem://features/phase4) — Client CRUD, Project lifecycle, team assignment, project detail tabs
- [Phase 6](mem://features/phase6) — Email notifications, system settings, audit log, impersonation

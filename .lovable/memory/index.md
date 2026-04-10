# Project Memory

## Core
Ziel Logs — Work Log & HR Management System. Dual-tone: dark sidebar #1A1B1E, light content #FBFBFB, accent #D0FF71.
Font: Host Grotesk. Primary buttons: #D0FF71 bg, #000 text, 8px radius. No gradients, no heavy shadows.
Supabase connected (ref: goutpygixoxkgbrfmkey). Admin seed: admin@ziel.com / Admin@123456.
Roles: admin, manager, employee. RBAC via get_my_role() security definer function.
Building in 6 phases. Phases 1–5 complete.

## Memories
- [Design tokens](mem://design/tokens) — Full color palette, border radius, font config
- [Auth flow](mem://features/auth) — Login, set-password, reset-password, invite-user edge function
- [Navigation](mem://features/navigation) — Role-based sidebar nav items for admin vs employee
- [Employee management](mem://features/employees) — Phase 2: directory, create, edit, deactivate, CSV import, self-profile
- [Attendance & Logs & Leave](mem://features/phase3) — Phase 3: clock in/out, attendance admin, daily logs, leave management
- [Projects & Clients](mem://features/phase4) — Phase 4: client CRUD, project lifecycle, team assignment, project stats
- [Dashboards & Reports & Announcements](mem://features/phase5) — Phase 5: admin/employee dashboards, 7 report types, announcements with unread tracking

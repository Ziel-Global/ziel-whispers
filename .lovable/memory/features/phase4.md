---
name: Projects & Clients
description: Phase 4 — Client CRUD, project lifecycle management, team assignment with roles, project stats with Recharts
type: feature
---
## Clients
- /clients — table list with search/status filter, add/edit modal, archive/unarchive
- clients table has notes column (added via migration)
- RLS: admin/manager can CRUD, employees can view clients of their projects

## Projects
- /projects — admin table view with stats, employee card grid of assigned projects
- /projects/new — create form with client dropdown, dates
- /projects/:id — 4 tabs: Overview, Members, Logs, Stats
  - Overview: status change (admin), status note
  - Members: add via sheet with role input, remove sets removed_at
  - Logs: project daily_logs with CSV export
  - Stats: Recharts bar/pie/line charts for hours by member, category, weekly
- Status options: active, on hold, completed, archived
- Completed status shows lock warning
- Employee sidebar: "My Projects" links to /my-projects (same ProjectsPage, filtered)

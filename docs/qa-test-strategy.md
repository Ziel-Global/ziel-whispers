# QA test strategy

## Test layers

1. **Unit tests** cover pure business rules and helpers. They run with `npm run test:unit` and must not require network access or Supabase credentials.
2. **Component tests** cover forms, role-dependent rendering, loading/error/empty states, and user interactions with mocked service boundaries.
3. **Database integration tests** cover migrations, constraints, RPCs, triggers, and row-level security against an isolated local or ephemeral Supabase environment.
4. **Playwright end-to-end tests** cover the most important user journeys in a browser against a seeded non-production environment.

Keep the existing linked-project automation tests separate from CI until they are migrated to an isolated test database. They create and delete project data. Do not run them against production or expose their credentials to untrusted pull-request workflows.

## Module coverage map

| Module | Core scenarios to automate |
| --- | --- |
| Authentication and access | Valid/invalid login, session restoration/expiry, inactive user, forced password change, role-gated routes. |
| Employees and profiles | Invite/create, profile edits, avatar handling, activate/deactivate, account controls, unauthorized actions. |
| Attendance | Clock in/out, multiple sessions, shift and workday rules, lateness/overtime, admin corrections. |
| Daily logs | Draft create/edit/delete, date/hour validation, submit, task/status attribution, edit window, admin review and locking. |
| Leave and remote work | Request validation, balances, approval/rejection, balance updates, notifications, admin-granted leave synchronization. |
| Clients and projects | Client CRUD, project creation, membership/visibility, client portal permissions, archived project behavior. |
| Tasks and workflow | Task CRUD/assignment, allowed and rejected transitions, blockers/dependencies, status history, automation, stale-write handling. |
| Kanban and sprints | Workflow columns and filters, backlog/sprint membership, progress, sprint completion behavior, transition restrictions. |
| Announcements and notifications | Publish, read/dismiss, recipient selection, notification persistence and delivery failure handling. |
| Reports and settings | Report totals/filters, setting validation, setting effects on downstream workflows. |
| Audit and skills | Audit events for consequential actions; skill assignment, evaluation, proficiency, and project requirements. |

## Priority order

Start with authentication/RBAC, daily-log submission and task status transitions, leave approval/balance behavior, and attendance clocking. These workflows cross UI, database policy, and business rules, so defects have broad impact. Add representative happy paths and rejection paths before expanding to lower-risk CRUD and report coverage.

## Pull request acceptance

- Lint, typecheck, unit tests, Playwright smoke tests, and production build pass.
- Database tests run only against isolated test data when that integration environment is available.
- Browser failure output, traces, and reports are retained as CI artifacts.
- Production deployment waits for staging smoke tests and the protected production environment approval.

## CI/CD configuration

The `CI` workflow runs on pull requests and pushes to `main`. It checks lint/type errors, the isolated Vitest suite, a Vite build, and Playwright smoke journeys using a fake Supabase endpoint. The browser tests cover the login form and require authentication on module routes; they stub database reads and require no application secrets.

The `Deploy` workflow runs only after a successful push-triggered CI run on `main`. It deploys to Vercel's Preview environment, runs the same browser smoke suite against that deployment, then waits at the protected GitHub `production` environment before deploying production. Configure these secrets in both GitHub `staging` and `production` environments, or as repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Configure the GitHub `production` environment to require a reviewer. Configure Vercel Preview variables to use a dedicated staging Supabase project and Vercel Production variables to use the production Supabase project. Vercel’s GitHub Actions workflow uses `vercel pull`, `vercel build`, and `vercel deploy --prebuilt`; see [Vercel's GitHub Actions guide](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel).

If this Vercel project is connected directly to GitHub, disable or restrict its automatic production deployments so they cannot bypass the CI, staging smoke, and environment approval gates in this workflow.

Database migration deployment is intentionally not automated here. The repository has a long migration history and the existing automation tests target a fixed linked project. Before applying migrations to staging or production from CI, reconcile migration history against the actual Supabase environments and create an isolated staging database workflow.

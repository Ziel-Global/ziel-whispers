# Implementation Checklist - Schema Replication

Use this checklist to track your progress implementing schema replication.

## Phase 1: Setup & Prerequisites

### Environment Preparation

- [ ] Read [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md)
- [ ] Obtained Supabase URLs for dev and production projects
- [ ] Obtained database passwords for dev and production
- [ ] Obtained anon keys for dev and production
- [ ] Created/Updated `.env` file with dev credentials
- [ ] Created/Updated `.env.prod` file with production credentials
- [ ] Verified `.env` files are in `.gitignore`
- [ ] Created `.env.example` for team documentation

### Install Prerequisites

- [ ] PostgreSQL client tools installed
  - [ ] Windows: Downloaded from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
  - [ ] macOS: `brew install postgresql`
  - [ ] Linux: `apt-get install postgresql-client`
- [ ] Verified: `pg_dump --version` works
- [ ] Verified: `psql --version` works

### Initial Testing

- [ ] Tested dev database connection
  ```bash
  npm run db:schema:test
  ```
- [ ] Tested production database connection
- [ ] No authentication errors
- [ ] Verified both databases are accessible

---

## Phase 2: Choose & Prepare Method

### Method Selection

- [ ] Decided on replication method:
  - [ ] Supabase CLI (Recommended)
  - [ ] PowerShell (Windows only)
  - [ ] Bash script (Unix/macOS)
  - [ ] Manual pg_dump
  - [ ] Programmatic Node.js

### Read Documentation

- [ ] Read [SCHEMA_REPLICATION_GUIDE.md](SCHEMA_REPLICATION_GUIDE.md) for chosen method
- [ ] Understood the safety measures
- [ ] Know what will/won't be copied
- [ ] Reviewed troubleshooting section

### Prepare Tools

- [ ] Downloaded/verified all necessary scripts
- [ ] Made bash script executable: `chmod +x scripts/replicate-schema.sh`
- [ ] Installed any missing npm packages: `npm install`
- [ ] Set PowerShell execution policy (if on Windows)

---

## Phase 3: Pre-Replication Safety

### Backup Current Production

- [ ] Backed up production database schema
  ```bash
  pg_dump --schema-only --dbname="postgresql://postgres:PASS@prod-host/postgres" > backup-schema-prod-$(date +%Y%m%d-%H%M%S).sql
  ```
- [ ] Backed up production data (optional but recommended)
  ```bash
  pg_dump --dbname="postgresql://postgres:PASS@prod-host/postgres" > backup-data-prod-$(date +%Y%m%d-%H%M%S).sql
  ```
- [ ] Saved backup files securely
- [ ] Documented backup locations

### Verify Dev Schema

- [ ] Examined current dev schema
  ```bash
  npm run db:schema:stats
  ```
- [ ] Noted expected table count
- [ ] Noted expected function count
- [ ] Understood RLS policies in dev
- [ ] Verified no corrupted objects

### Pre-Replication Comparison

- [ ] Extracted dev schema to review (optional)
  ```bash
  npm run db:schema:extract
  ```
- [ ] Compared with current prod schema (optional)
  ```bash
  npm run db:schema:compare
  ```

---

## Phase 4: Test Replication (Dry Run)

### Method-Specific Dry Run

**If using Supabase CLI:**
- [ ] Executed: `supabase db pull` (creates migration)
- [ ] Reviewed generated migration file
- [ ] Checked migration syntax is valid

**If using PowerShell:**
- [ ] Executed: `.\scripts\replicate-schema.ps1 -DryRun`
- [ ] Reviewed generated schema file

**If using Bash:**
- [ ] Executed: `./scripts/replicate-schema.sh --dry-run`
- [ ] Reviewed generated schema file

**If using Programmatic:**
- [ ] Executed: `npm run db:schema:replicate:dry`
- [ ] Reviewed output

### Analyze Results

- [ ] No errors in dry-run output
- [ ] Schema file size is reasonable
- [ ] Recognized all your tables in output
- [ ] No unexpected SQL statements

---

## Phase 5: Execute Replication

### Final Confirmation

- [ ] Backup confirmed to exist
- [ ] Production data backed up (if applicable)
- [ ] Notified team members
- [ ] Scheduled during low-traffic period
- [ ] Ready to proceed

### Execute Replication

**If using Supabase CLI:**
- [ ] Linked to production: `supabase link --project-ref prod-id`
- [ ] Executed: `supabase db push`
- [ ] Confirmed when prompted

**If using PowerShell:**
- [ ] Executed: `.\scripts\replicate-schema.ps1 -Confirm`
- [ ] Confirmed when prompted

**If using Bash:**
- [ ] Executed: `./scripts/replicate-schema.sh --yes`
- [ ] Watched for completion

**If using Programmatic:**
- [ ] Executed: `npm run db:schema:replicate`
- [ ] Watched progress

### Monitor Execution

- [ ] Script running without errors
- [ ] No SQL syntax errors
- [ ] No permission denied errors
- [ ] Completed successfully
- [ ] No timeout errors

---

## Phase 6: Post-Replication Verification

### Immediate Verification

- [ ] Application still runs (`npm run dev`)
- [ ] Database queries working
- [ ] No connection errors in console
- [ ] Tables visible in Supabase Dashboard

### Comprehensive Verification

- [ ] Table count matches dev:
  ```bash
  npm run db:schema:compare
  ```
- [ ] All expected tables exist in production
- [ ] RLS policies applied correctly
- [ ] Indexes present on all tables
- [ ] Triggers are active
- [ ] Functions available
- [ ] Foreign key relationships intact
- [ ] Unique constraints in place

### Data Verification

- [ ] No data was accidentally copied
- [ ] Existing production data unchanged (if applicable)
- [ ] Application authentication still works
- [ ] User roles and permissions correct

### Schema Objects Check

Run these queries to verify:

```sql
-- Check table count
SELECT count(*) FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check indexes
SELECT count(*) FROM information_schema.statistics 
WHERE table_schema = 'public';

-- Check RLS policies
SELECT count(*) FROM pg_policies 
WHERE schemaname = 'public';

-- Check functions
SELECT count(*) FROM information_schema.routines 
WHERE routine_schema = 'public';

-- Check triggers
SELECT count(*) FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

---

## Phase 7: Post-Replication Cleanup & Documentation

### Clean Up Files

- [ ] Archived/saved schema dump files
- [ ] Deleted temporary SQL files
- [ ] Removed backup files if no longer needed (or archive long-term)

### Document Results

- [ ] Recorded replication date and time
- [ ] Noted any special issues encountered
- [ ] Documented which method was used
- [ ] Updated team documentation
- [ ] Created incident log entry (if applicable)

### Version Control

**If using Supabase CLI:**
- [ ] Committed migration file: `git add supabase/migrations/`
- [ ] Committed with message: `git commit -m "Migrate schema to production"`
- [ ] Pushed to repo: `git push`

**If using other methods:**
- [ ] Saved schema dump as backup in version control
- [ ] Committed: `git add schema-backup-prod-*.sql`
- [ ] Pushed: `git push`

### Notify Team

- [ ] Informed team of successful replication
- [ ] Shared any lessons learned
- [ ] Updated documentation if needed
- [ ] Marked any affected tickets as resolved

---

## Phase 8: Ongoing Maintenance

### After Development

- [ ] Test schema on staging before production changes
- [ ] Use `supabase db pull` for future changes
- [ ] Keep migrations tracked in git
- [ ] Regular backup schedule established

### For Future Replications

- [ ] Bookmark [SCHEMA_REPLICATION_QUICK_REF.md](SCHEMA_REPLICATION_QUICK_REF.md)
- [ ] Keep .env and .env.prod files updated
- [ ] Test connections regularly
- [ ] Review backup procedures quarterly

### Automation (Optional)

- [ ] Set up CI/CD pipeline for automated migrations
- [ ] Configure GitHub Actions or similar
- [ ] Add pre-deployment schema validation
- [ ] Create slack notifications for schema changes

---

## Troubleshooting Log

Use this section to document any issues encountered:

| Issue | Solution | Date | Resolved |
|-------|----------|------|----------|
| | | | |
| | | | |
| | | | |

---

## Sign-Off

- [ ] Schema replication completed successfully
- [ ] All verifications passed
- [ ] Application functioning normally
- [ ] Team notified
- [ ] Backup procedures confirmed

**Completed By**: ________________  
**Date**: ________________  
**Notes**: ________________________________________________________________

---

## Next Replications

Use this checklist again for future replications. Copy this file and rename it:
```
SCHEMA_REPLICATION_CHECKLIST_REPLICATION_1.md (completed)
SCHEMA_REPLICATION_CHECKLIST_REPLICATION_2.md (current)
SCHEMA_REPLICATION_CHECKLIST_REPLICATION_3.md (next)
```

---

**Quick Links**:
- 🚀 [README](SCHEMA_REPLICATION_README.md)
- 📖 [Full Guide](SCHEMA_REPLICATION_GUIDE.md)
- ⚡ [Quick Reference](SCHEMA_REPLICATION_QUICK_REF.md)
- 🔐 [Environment Setup](ENV_SETUP_GUIDE.md)

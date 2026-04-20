# Schema Replication Guide - Dev to Production

## Overview

This guide provides multiple methods to duplicate your Supabase development database schema to production. The schema includes all database objects (tables, relationships, indexes, RLS policies, triggers, functions, extensions) **without copying any data**.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Understanding Your Environment](#understanding-your-environment)
3. [Method 1: Supabase CLI (Recommended)](#method-1-supabase-cli-recommended)
4. [Method 2: PowerShell Script (Windows)](#method-2-powershell-script-windows)
5. [Method 3: Bash Script (Unix/macOS/Linux)](#method-3-bash-script-unixmacoslinux)
6. [Method 4: Manual pg_dump](#method-4-manual-pgdump)
7. [Troubleshooting](#troubleshooting)
8. [Safety & Backups](#safety--backups)

---

## Prerequisites

### All Methods Require:

1. **PostgreSQL Client Tools**
   - Windows: [PostgreSQL Installer](https://www.postgresql.org/download/windows/)
   - macOS: `brew install postgresql`
   - Ubuntu/Debian: `apt-get install postgresql-client`
   - Verify installation:
     ```bash
     pg_dump --version
     psql --version
     ```

2. **Environment Files**
   - `.env` - Development Supabase credentials
   - `.env.prod` - Production Supabase credentials
   
   Both files should contain:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   # And one of these:
   DATABASE_URL=postgresql://user:pass@host:5432/database
   # OR
   SUPABASE_DB_PASSWORD=your-database-password
   ```

---

## Understanding Your Environment

### Finding Your Supabase Credentials

1. **Go to Supabase Dashboard** → Your Project
2. **Settings** → **Database** → **Connection string**
3. Select **Postgres** tab
4. Copy connection details:
   - **Host**: `your-project-id.db.supabase.co`
   - **Port**: `5432`
   - **Database**: `postgres`
   - **User**: `postgres`
   - **Password**: Your database password (reset if needed under Settings → Database)

### Setting Up .env Files

**Development (.env):**
```env
VITE_SUPABASE_URL=https://dev-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=dev-anon-key-here
SUPABASE_DB_PASSWORD=dev-database-password
```

**Production (.env.prod):**
```env
VITE_SUPABASE_URL=https://prod-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=prod-anon-key-here
SUPABASE_DB_PASSWORD=prod-database-password
```

---

## Method 1: Supabase CLI (Recommended)

### Why Use This Method?

✅ Built specifically for Supabase  
✅ Handles all schema objects automatically  
✅ Creates tracked migrations  
✅ Reversible via version control  
✅ Preserves RLS, triggers, functions, etc.

### Installation

```bash
# Global installation
npm install -g supabase

# Verify
supabase --version
```

### Step-by-Step Instructions

#### Step 1: Prepare Your Supabase Projects

```bash
# Ensure you're in the project root (with supabase/config.toml)
cd d:\Ziel\Ziel\ Log\ System\ziel-whispers
```

#### Step 2: Link to Development Project

```bash
# Get your dev project ID from Supabase dashboard
supabase link --project-ref your-dev-project-id

# When prompted, enter your dev database password
# (found in Supabase Dashboard → Settings → Database)
```

Verify by checking `supabase/config.toml`:
```toml
project_id = "your-dev-project-id"
```

#### Step 3: Pull Schema as Migration

```bash
# This extracts current schema as a new migration file
supabase db pull

# Review the generated migration
cat supabase/migrations/$(ls -t supabase/migrations | head -1)
```

The generated migration will be saved in `supabase/migrations/` with a timestamp.

#### Step 4: Link to Production Project

```bash
# Switch to production project
supabase link --project-ref your-prod-project-id

# When prompted, enter your prod database password
```

#### Step 5: Push to Production

```bash
# Apply all migrations (including the new schema) to production
supabase db push

# When prompted, confirm you want to push to production
```

#### Step 6: Verify

Check that tables were created in production:

```bash
# Optional: Verify via Supabase Dashboard
# Settings → Database → Tables should show all your tables
```

---

## Method 2: PowerShell Script (Windows)

### Quick Start

```powershell
# Navigate to project root
cd "d:\Ziel\Ziel Log System\ziel-whispers"

# Run the script with confirmation
.\scripts\replicate-schema.ps1

# Or with automatic confirmation
.\scripts\replicate-schema.ps1 -Confirm
```

### Features

- ✓ Automatic credential extraction from `.env` files
- ✓ One-click schema replication
- ✓ Color-coded output
- ✓ Schema verification
- ✓ Backup of extracted schema

### Troubleshooting PowerShell

#### Execution Policy Error

```powershell
# Temporary (current session only)
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# Or run as admin and set permanently
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### PostgreSQL Not Found

```powershell
# Add PostgreSQL to PATH in System Environment Variables:
# 1. Windows Key → Environment Variables
# 2. Add: C:\Program Files\PostgreSQL\15\bin (adjust version as needed)
# 3. Restart PowerShell
```

---

## Method 3: Bash Script (Unix/macOS/Linux)

### Quick Start

```bash
# Navigate to project root
cd /path/to/ziel-whispers

# Make script executable
chmod +x scripts/replicate-schema.sh

# Run the script
./scripts/replicate-schema.sh

# Or with automatic confirmation
./scripts/replicate-schema.sh --yes

# Or dry-run (extract only, no application)
./scripts/replicate-schema.sh --dry-run
```

### Features

- ✓ Automatic credential extraction
- ✓ Color-coded output with progress indicators
- ✓ Schema verification
- ✓ Dry-run mode for testing
- ✓ Automatic backup

### Options

```bash
./scripts/replicate-schema.sh [OPTIONS]

Options:
  --yes              Skip confirmation prompt
  --dry-run          Extract schema but don't apply it
  --output FILE      Custom output file path
```

---

## Method 4: Manual pg_dump

### For More Control or Debugging

#### Step 1: Extract Schema from Dev

```bash
# macOS/Linux
pg_dump \
  --schema-only \
  --no-privileges \
  --no-owner \
  --dbname="postgresql://postgres:PASSWORD@dev-project-id.db.supabase.co:5432/postgres" \
  > schema-dev.sql

# Windows PowerShell
pg_dump `
  --schema-only `
  --no-privileges `
  --no-owner `
  --dbname="postgresql://postgres:PASSWORD@dev-project-id.db.supabase.co:5432/postgres" `
  -f schema-dev.sql
```

#### Step 2: Review the Schema (Optional)

```bash
# Check what will be applied
less schema-dev.sql  # macOS/Linux
notepad schema-dev.sql  # Windows
```

Common sections:
- `CREATE EXTENSION` - PostgreSQL extensions (UUID, etc.)
- `CREATE SCHEMA` - Custom schemas
- `CREATE TABLE` - Your tables
- `CREATE INDEX` - Indexes
- `CREATE POLICY` - RLS policies
- `CREATE TRIGGER` - Triggers
- `CREATE FUNCTION` - Custom functions

#### Step 3: Apply to Production

```bash
# macOS/Linux
psql \
  --dbname="postgresql://postgres:PASSWORD@prod-project-id.db.supabase.co:5432/postgres" \
  --file=schema-dev.sql \
  --set ON_ERROR_STOP=on

# Windows PowerShell
psql `
  --dbname="postgresql://postgres:PASSWORD@prod-project-id.db.supabase.co:5432/postgres" `
  --file=schema-dev.sql `
  --set ON_ERROR_STOP=on
```

#### Step 4: Verify

```bash
# Check table count matches
psql --dbname="postgresql://postgres:PASSWORD@prod-project-id.db.supabase.co:5432/postgres" \
  --command="SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema');"
```

---

## Troubleshooting

### Issue: "Connection refused" or "Network error"

**Cause**: Host firewall or Supabase IP whitelist

**Solution**:
1. Verify connection string is correct
2. Check Supabase Dashboard → Settings → Network → IP Whitelist
3. Add your IP: Visit [checkip.amazonaws.com](https://checkip.amazonaws.com/)

### Issue: "password authentication failed"

**Cause**: Incorrect database password

**Solution**:
1. Reset password in Supabase Dashboard → Settings → Database → Reset Password
2. Update `.env` and `.env.prod` files
3. Try again

### Issue: "Database postgres does not exist"

**Cause**: Wrong database name in connection string

**Solution**:
- Supabase always uses `postgres` as the default database
- Verify connection string format

### Issue: "Role postgres does not exist"

**Cause**: Using wrong user

**Solution**:
- Supabase always uses `postgres` as the default user
- Check connection string in Supabase Dashboard

### Issue: "Permission denied" errors in migration

**Cause**: RLS policies or other permission issues

**Solution**:
1. Connect as superuser (postgres)
2. Disable RLS temporarily: `ALTER POLICY ... DISABLE;`
3. Reapply after migration

### Issue: Schema already exists in production

**Solution 1**: Use `supabase db push --force` (migrations method)

**Solution 2**: Drop existing schema (DANGEROUS - ensure backup):
```sql
-- Run this in production as superuser
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Then reapply schema
```

---

## Safety & Backups

### Before Starting

1. **Backup Production**
   ```bash
   pg_dump --dbname="postgresql://user:pass@prod-host/postgres" > backup-prod-$(date +%Y%m%d-%H%M%S).sql
   ```

2. **Backup Development**
   ```bash
   pg_dump --dbname="postgresql://user:pass@dev-host/postgres" > backup-dev-$(date +%Y%m%d-%H%M%S).sql
   ```

### Rollback Procedure

If something goes wrong:

```bash
# Restore from backup
psql --dbname="postgresql://user:pass@prod-host/postgres" < backup-prod-YYYYMMDD-HHMMSS.sql
```

### Data Preservation

All methods use `--schema-only` flag which:
- ✓ Copies all tables, relationships, indexes
- ✓ Copies all RLS policies, triggers, functions
- ✓ **Does NOT copy any data**

Existing production data is:
- ✓ Safe if tables already exist
- ✓ Will be dropped if you replace existing tables
- ✓ Recommend manual backup if you have production data

---

## Verification Checklist

After replication completes:

- [ ] Connection succeeded to both databases
- [ ] Schema extracted successfully
- [ ] Schema applied to production without errors
- [ ] Table count matches between dev and prod
- [ ] Tables are visible in Supabase Dashboard
- [ ] No data was copied (schema-only)
- [ ] RLS policies are in place
- [ ] Triggers are active
- [ ] Indexes exist

---

## Advanced: Excluding Certain Objects

### Exclude Specific Schemas

```bash
pg_dump \
  --schema-only \
  --exclude-schema=extensions \
  --exclude-schema=graphql_public \
  ...
```

### Exclude Specific Tables

```bash
pg_dump \
  --schema-only \
  --exclude-table-data=public.* \
  --exclude-table=migration_lock \
  ...
```

### Exclude RLS Policies

If you need schema without RLS (not recommended):

```bash
# Extract without policies
pg_dump --schema-only --dbname="..." > schema.sql

# Remove policy lines
grep -v "CREATE POLICY\|ALTER ENABLE\|ALTER DISABLE" schema.sql > schema-no-rls.sql
```

---

## Useful Commands Reference

### Test Connection

```bash
# From shell
psql -h your-project-id.db.supabase.co -U postgres -d postgres -c "SELECT version();"
```

### List All Tables

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
```

### Count Objects

```sql
-- Tables
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';

-- Indexes
SELECT count(*) FROM information_schema.statistics WHERE table_schema = 'public';

-- Triggers
SELECT count(*) FROM information_schema.triggers WHERE trigger_schema = 'public';

-- RLS Policies
SELECT count(*) FROM information_schema.role_statement_entries;

-- Functions
SELECT count(*) FROM information_schema.routines WHERE routine_schema = 'public';
```

### Compare Schemas

```bash
# Extract both schemas
pg_dump --schema-only --dbname=dev-url > dev-schema.sql
pg_dump --schema-only --dbname=prod-url > prod-schema.sql

# Compare
diff dev-schema.sql prod-schema.sql
```

---

## Support

If you encounter issues:

1. Check the [Troubleshooting section](#troubleshooting)
2. Review PostgreSQL logs in Supabase Dashboard
3. Check that `.env` files are correctly formatted
4. Verify database credentials are active
5. Ensure PostgreSQL client tools are installed and in PATH

---

**Last Updated**: April 2026  
**Next Review**: As needed when Supabase or PostgreSQL versions change

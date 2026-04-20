# Supabase Schema Replication - Complete Solution

## 📋 What You Have

A complete, production-ready solution for duplicating your Supabase development database schema to production. This includes **all database objects** (tables, relationships, RLS policies, triggers, functions, indexes, extensions) **without copying any data**.

---

## 🗂️ Files Created

### Documentation

| File | Purpose |
|------|---------|
| [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md) | **START HERE** - How to set up `.env` and `.env.prod` files with credentials |
| [SCHEMA_REPLICATION_GUIDE.md](SCHEMA_REPLICATION_GUIDE.md) | Comprehensive guide with 4 different methods + troubleshooting |
| [SCHEMA_REPLICATION_QUICK_REF.md](SCHEMA_REPLICATION_QUICK_REF.md) | Quick reference card for common tasks |

### Scripts & Tools

| File | Purpose | Usage |
|------|---------|-------|
| `scripts/replicate-schema.ps1` | Windows PowerShell script | `.\scripts\replicate-schema.ps1` |
| `scripts/replicate-schema.sh` | Unix/macOS/Linux bash script | `./scripts/replicate-schema.sh` |
| `scripts/replicate-schema.ts` | Node.js TypeScript version | `npx ts-node scripts/replicate-schema.ts` |
| `scripts/replicate-schema-supabase-cli.ts` | Supabase CLI method | Instructions provided |
| `src/lib/database-util.ts` | Programmatic database utility | Importable + CLI commands |

### package.json Updates

New npm scripts added:

```bash
npm run db:schema:test       # Test connections
npm run db:schema:extract    # Extract schema from dev
npm run db:schema:stats      # Show schema statistics
npm run db:schema:compare    # Compare dev vs prod
npm run db:schema:replicate  # Full replication (dev → prod)
npm run db:schema:replicate:dry  # Test without applying
```

---

## 🚀 Quick Start (Choose One Method)

### 1️⃣ **Recommended: Supabase CLI Method**

```bash
# Link to dev
supabase link --project-ref your-dev-project-id

# Pull schema
supabase db pull

# Link to prod
supabase link --project-ref your-prod-project-id

# Push to prod
supabase db push
```

**Why?** Built for Supabase, creates tracked migrations, fully reversible.

See: [SCHEMA_REPLICATION_GUIDE.md → Method 1](SCHEMA_REPLICATION_GUIDE.md#method-1-supabase-cli-recommended)

---

### 2️⃣ **Windows (PowerShell)**

```powershell
# From project root
.\scripts\replicate-schema.ps1
```

See: [SCHEMA_REPLICATION_GUIDE.md → Method 2](SCHEMA_REPLICATION_GUIDE.md#method-2-powershell-script-windows)

---

### 3️⃣ **macOS / Linux (Bash)**

```bash
chmod +x scripts/replicate-schema.sh
./scripts/replicate-schema.sh --yes
```

See: [SCHEMA_REPLICATION_GUIDE.md → Method 3](SCHEMA_REPLICATION_GUIDE.md#method-3-bash-script-unixmacoslinux)

---

### 4️⃣ **Programmatic (Node.js)**

```bash
# Test connections
npm run db:schema:test

# Full replication
npm run db:schema:replicate

# Or dry-run first
npm run db:schema:replicate:dry
```

See: [SCHEMA_REPLICATION_GUIDE.md → Method 4](SCHEMA_REPLICATION_GUIDE.md#method-4-manual-pgdump)

---

## 📝 Before You Start

### 1. Set Up Environment Files

See: [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md)

Your `.env` and `.env.prod` files need:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_DB_PASSWORD=your_database_password
```

### 2. Install Prerequisites

**All methods require PostgreSQL client tools:**

- **Windows**: [Download PostgreSQL](https://www.postgresql.org/download/windows/) → Include "Command Line Tools"
- **macOS**: `brew install postgresql`
- **Linux**: `apt-get install postgresql-client`

Verify:
```bash
pg_dump --version
psql --version
```

### 3. Test Your Setup

```bash
# Test database connections
npm run db:schema:test

# Or manually
psql -h your-project-id.db.supabase.co -U postgres -d postgres -c "SELECT 1;"
```

---

## ✅ What Gets Replicated

### Included ✓
- Tables & columns with data types
- Primary keys & unique constraints
- Foreign keys & relationships
- Indexes (primary, unique, compound)
- Row Level Security (RLS) policies
- Triggers & stored functions
- Extensions (pgcrypto, uuid-ossp, etc.)
- Sequences
- Views
- Custom types/enums

### NOT Included ✗
- **Data rows** (schema-only)
- User authentication data (auth.users)
- Session data
- Logs or audit trails

---

## 🔒 Safety Features

### Built-In

1. **Dry-Run Mode** - Test without applying
   ```bash
   ./scripts/replicate-schema.sh --dry-run
   ```

2. **Automatic Backup** - Saves prod schema before replacing
   ```
   schema-backup-prod-TIMESTAMP.sql
   ```

3. **Schema Verification** - Confirms tables match after replication
   ```bash
   npm run db:schema:compare
   ```

4. **Confirmation Prompt** - Requires approval before applying
   ```
   ⚠️  WARNING: This will REPLACE the production schema!
   Continue? (yes/no):
   ```

### Recommended

1. **Manual Backup** - Before production changes
   ```bash
   pg_dump --dbname="postgresql://postgres:PASS@prod-host/postgres" > backup-prod-$(date +%Y%m%d-%H%M%S).sql
   ```

2. **Version Control** - If using Supabase CLI migrations
   ```bash
   git add supabase/migrations/
   git commit -m "Add schema migration"
   ```

3. **Test First** - Dry-run on staging if available
   ```bash
   ./scripts/replicate-schema.sh --dry-run
   ```

---

## 🛠️ Choosing Your Method

| Method | Best For | Speed | Control | Reversible |
|--------|----------|-------|---------|-----------|
| **Supabase CLI** | Production, tracking changes | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ Via git |
| **PowerShell** | Windows developers | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⚠️ Manual backup |
| **Bash Script** | macOS/Linux developers | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⚠️ Manual backup |
| **Direct pg_dump** | Maximum control, debugging | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Manual backup |
| **Programmatic** | CI/CD automation | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⚠️ Need implementation |

**Recommendation**: Start with **Supabase CLI** for simplicity and tracking. Use scripts for automation.

---

## 📚 Documentation Map

```
Start Here ↓
┌─────────────────────────────────┐
│   ENV_SETUP_GUIDE.md            │
│   (Set up .env files first)     │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────────────────────┐
│   SCHEMA_REPLICATION_GUIDE.md                   │
│   Choose your method:                           │
│   1. Supabase CLI (recommended)                 │
│   2. PowerShell (Windows)                       │
│   3. Bash script (Unix/macOS)                   │
│   4. Manual pg_dump                             │
└─────────────────────────────────────────────────┘
             ↓
     SCHEMA_REPLICATION_QUICK_REF.md
     (Cheat sheet for future runs)
```

---

## 🎯 Common Tasks

### Extract Schema Only (No Apply)

```bash
npm run db:schema:extract
# Output: schema-dump-TIMESTAMP.sql
```

### Compare Dev vs Prod

```bash
npm run db:schema:compare
# Shows table count, index count, function count, etc.
```

### Check Schema Statistics

```bash
npm run db:schema:stats
# Tables, indexes, triggers, functions, RLS policies count
```

### List All Tables

```bash
# Using the utility programmatically
npx ts-node -e "
import { loadDatabaseConfig, buildConnectionString, listTables } from './src/lib/database-util';
const config = loadDatabaseConfig();
const connStr = buildConnectionString(config);
listTables(connStr).then(tables => console.log(tables));
"
```

---

## ❓ Troubleshooting

### Quick Fixes

| Problem | Solution |
|---------|----------|
| "postgres not found" | Install PostgreSQL ([postgresql.org/download](https://www.postgresql.org/download/)) |
| "Connection refused" | Check password & IP whitelist in Supabase Settings → Network |
| "Password authentication failed" | Reset DB password in Supabase → Settings → Database |
| "Schema file not found" | Check file path and permissions |
| "Permission denied" (on .sh file) | Run: `chmod +x scripts/replicate-schema.sh` |

For detailed troubleshooting:
→ [SCHEMA_REPLICATION_GUIDE.md → Troubleshooting](SCHEMA_REPLICATION_GUIDE.md#troubleshooting)

---

## 🔗 Integration

### Use in Your Application

```typescript
// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default supabase;
```

### Use in Scripts

```typescript
import { replicateSchema, loadDatabaseConfig, buildConnectionString } from './src/lib/database-util';

const devConfig = loadDatabaseConfig('.env');
const prodConfig = loadDatabaseConfig('.env.prod');

await replicateSchema(
  buildConnectionString(devConfig),
  buildConnectionString(prodConfig),
  { backup: true, verify: true }
);
```

### CI/CD Integration

```yaml
# GitHub Actions Example
- name: Replicate Schema
  run: npm run db:schema:replicate
  env:
    DATABASE_URL: ${{ secrets.DEV_DATABASE_URL }}
    DATABASE_URL_PROD: ${{ secrets.PROD_DATABASE_URL }}
```

---

## 📞 Support

### Getting Help

1. **Environment Issues** → See [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md)
2. **Replication Steps** → See [SCHEMA_REPLICATION_GUIDE.md](SCHEMA_REPLICATION_GUIDE.md)
3. **Quick Commands** → See [SCHEMA_REPLICATION_QUICK_REF.md](SCHEMA_REPLICATION_QUICK_REF.md)
4. **Specific Error** → Search [SCHEMA_REPLICATION_GUIDE.md → Troubleshooting](SCHEMA_REPLICATION_GUIDE.md#troubleshooting)

### Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Guide](https://supabase.com/docs/guides/cli)
- [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL psql](https://www.postgresql.org/docs/current/app-psql.html)

---

## 📋 Verification Checklist

After replication completes:

- [ ] No errors in output
- [ ] Table count matches between dev and prod
- [ ] RLS policies visible in Supabase Dashboard
- [ ] Indexes exist on all expected columns
- [ ] Triggers are active
- [ ] Functions are available
- [ ] No data was accidentally copied
- [ ] You can query tables in production
- [ ] Application still connects successfully

---

## 🎉 Next Steps

1. **Setup**: Follow [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md)
2. **Choose Method**: Pick from [SCHEMA_REPLICATION_GUIDE.md](SCHEMA_REPLICATION_GUIDE.md)
3. **Run**: Execute the replication
4. **Verify**: Check Supabase Dashboard and compare schemas
5. **Bookmark**: Save [SCHEMA_REPLICATION_QUICK_REF.md](SCHEMA_REPLICATION_QUICK_REF.md) for future use

---

**Version**: 1.0  
**Last Updated**: April 2026  
**Status**: Production Ready ✅

For updates or issues, refer to the comprehensive guides above.

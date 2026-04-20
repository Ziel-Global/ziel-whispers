# Quick Reference - Schema Replication

## TL;DR - Fastest Way

### Using Supabase CLI (Recommended)

```bash
# 1. Link to dev
supabase link --project-ref dev-project-id

# 2. Pull schema
supabase db pull

# 3. Link to prod
supabase link --project-ref prod-project-id

# 4. Push to prod
supabase db push
```

---

## By OS

### Windows

```powershell
# Make sure you have PostgreSQL installed
# Then run:
.\scripts\replicate-schema.ps1

# With auto-confirm:
.\scripts\replicate-schema.ps1 -Confirm
```

### macOS / Linux

```bash
chmod +x scripts/replicate-schema.sh
./scripts/replicate-schema.sh --yes
```

---

## Via npm Scripts

Add to `package.json` scripts section:

```json
{
  "scripts": {
    "db:schema:extract": "pg_dump --schema-only --no-privileges --dbname=$DATABASE_URL > schema.sql",
    "db:schema:apply": "psql --dbname=$DATABASE_URL_PROD < schema.sql",
    "db:schema:pull": "supabase db pull",
    "db:schema:push": "supabase db push"
  }
}
```

Then run:

```bash
npm run db:schema:extract
npm run db:schema:push
```

---

## Manual Commands

### Extract Schema Only (No Data)

```bash
pg_dump \
  --schema-only \
  --no-privileges \
  --no-owner \
  --dbname="postgresql://postgres:YOUR_PASSWORD@dev-project-id.db.supabase.co:5432/postgres" \
  > schema-backup.sql
```

### Apply Schema

```bash
psql \
  --dbname="postgresql://postgres:YOUR_PASSWORD@prod-project-id.db.supabase.co:5432/postgres" \
  --file=schema-backup.sql \
  --set ON_ERROR_STOP=on
```

### Verify Schema Match

```bash
# Count tables in dev
psql --dbname="postgresql://postgres:PASS@dev-project-id.db.supabase.co:5432/postgres" \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema');"

# Count tables in prod
psql --dbname="postgresql://postgres:PASS@prod-project-id.db.supabase.co:5432/postgres" \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema');"
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "postgres not found" | Install PostgreSQL: [postgresql.org/download](https://www.postgresql.org/download/) |
| "Connection refused" | Check database password & IP whitelist in Supabase |
| "Permission denied" | Ensure you're using correct user (usually `postgres`) |
| "psql: command not found" | Add PostgreSQL bin to PATH |
| Schema exists | Drop with: `DROP SCHEMA public CASCADE;` then recreate |

---

## What Gets Copied

✅ **Included:**
- Tables & columns
- Primary keys & constraints
- Foreign keys & relationships
- Indexes
- Row Level Security (RLS) policies
- Triggers & functions
- Extensions (pgcrypto, uuid-ossp, etc.)
- Sequences
- Views
- Stored procedures

❌ **NOT Included:**
- Table data / rows
- User account data (auth.users)
- Session data
- Logs

---

## Environment Setup

### Find Your Credentials

1. Supabase Dashboard → Your Project
2. Settings → Database → Connection String
3. Select "Postgres"
4. Copy details

### Format .env Files

```env
# .env (Development)
VITE_SUPABASE_URL=https://dev-xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_DB_PASSWORD=YourDevPassword

# .env.prod (Production)
VITE_SUPABASE_URL=https://prod-xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_DB_PASSWORD=YourProdPassword
```

---

## Safety Checklist

Before running schema replication:

- [ ] Backup production database
- [ ] Confirm dev URL is correct
- [ ] Confirm prod URL is correct
- [ ] Verify database passwords are current
- [ ] Test connection to both databases
- [ ] No critical data in production (if replacing schema)

---

## Need Help?

See [SCHEMA_REPLICATION_GUIDE.md](SCHEMA_REPLICATION_GUIDE.md) for detailed instructions.

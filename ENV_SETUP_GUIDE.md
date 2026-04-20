# Environment Setup Guide

## Overview

This document explains how to set up `.env` and `.env.prod` files with the correct Supabase credentials needed for schema replication.

## Getting Your Supabase Credentials

### Step 1: Access Supabase Dashboard

1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your organization
3. Click on your **development project**

### Step 2: Find Your Connection String

1. In the left sidebar, go to **Settings** → **Database**
2. You should see a section "Connection string"
3. Select the tab: **Postgres**

You'll see something like:

```
postgresql://[username]:[password]@[host]:[port]/[database]
```

### Step 3: Get Database Password

Your database password is your **database password** (set during project creation).

**If you forgot it:**
1. Go to **Settings** → **Database**
2. Click **Reset Database Password**
3. Follow the prompts to set a new password
4. Copy the new password (you'll only see it once!)

### Step 4: Extract Connection Details

From your connection string:

- **VITE_SUPABASE_URL**: The main project URL (found in Settings → General)
  - Format: `https://[project-id].supabase.co`
- **VITE_SUPABASE_ANON_KEY**: Found in Settings → API
  - Copy from "anon public" key
- **SUPABASE_DB_PASSWORD**: Your database password
  - Found in Settings → Database → Connection info

## Setting Up .env Files

### For Development (.env)

```env
# Supabase API Configuration
VITE_SUPABASE_URL=https://your-dev-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database Connection
SUPABASE_DB_PASSWORD=your_database_password_here

# (Optional) Direct database URL
# DATABASE_URL=postgresql://postgres:password@your-dev-project-id.db.supabase.co:5432/postgres
```

### For Production (.env.prod)

```env
# Supabase API Configuration
VITE_SUPABASE_URL=https://your-prod-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database Connection
SUPABASE_DB_PASSWORD=your_database_password_here

# (Optional) Direct database URL
# DATABASE_URL=postgresql://postgres:password@your-prod-project-id.db.supabase.co:5432/postgres
```

## Example with Real Values

### Development Example

```env
# .env
VITE_SUPABASE_URL=https://goutpygixoxkgbrfmkey.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvdXRweWdpeG94a2diXzEyMzQ1Njc4OTAiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyMDAwMDAwMCwiZXhwIjoxOTI0Mjk5OTk5fQ.abcdefghijklmnopqrstuvwxyz
SUPABASE_DB_PASSWORD=super_secret_dev_password_123
```

### Production Example

```env
# .env.prod
VITE_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG0iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYyMDAwMDAwMCwiZXhwIjoxOTI0Mjk5OTk5fQ.xyzabcdefghijklmnopqrstuvwxyz
SUPABASE_DB_PASSWORD=super_secret_prod_password_456
```

## Finding Your Values Step-by-Step

### VITE_SUPABASE_URL

1. **Supabase Dashboard** → Your Project
2. **Settings** → **General**
3. Look for "Project URL"
4. It looks like: `https://xxx-yyy-zzz.supabase.co`
5. Copy the entire URL

### VITE_SUPABASE_ANON_KEY

1. **Supabase Dashboard** → Your Project
2. **Settings** → **API**
3. Find the section "Project API keys"
4. Look for "anon public"
5. Click the copy icon
6. The key starts with `eyJhbGciOi...`

### SUPABASE_DB_PASSWORD

1. **Supabase Dashboard** → Your Project
2. **Settings** → **Database**
3. Look for "Connection info" section
4. The password is what you set during setup
5. If forgotten, click "Reset Database Password"
6. **Note**: You'll only see it once after reset!

## Verification

### Test Your Environment Files

Create a simple test script:

```bash
# test-env.sh
#!/bin/bash

# Test dev environment
echo "Testing .env..."
source .env

if [[ -z "$VITE_SUPABASE_URL" ]]; then
    echo "❌ VITE_SUPABASE_URL not set"
else
    echo "✓ VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
fi

if [[ -z "$SUPABASE_DB_PASSWORD" ]]; then
    echo "❌ SUPABASE_DB_PASSWORD not set"
else
    echo "✓ SUPABASE_DB_PASSWORD is set (****)"
fi

# Test prod environment
echo ""
echo "Testing .env.prod..."
source .env.prod

if [[ -z "$VITE_SUPABASE_URL" ]]; then
    echo "❌ VITE_SUPABASE_URL not set"
else
    echo "✓ VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
fi

if [[ -z "$SUPABASE_DB_PASSWORD" ]]; then
    echo "❌ SUPABASE_DB_PASSWORD not set"
else
    echo "✓ SUPABASE_DB_PASSWORD is set (****)"
fi
```

### Test Database Connection

```bash
# Using the database utility
npx ts-node src/lib/database-util.ts test

# Or manually
psql -h your-project-id.db.supabase.co -U postgres -d postgres -c "SELECT 1;"
```

## Security Best Practices

### Protecting Your Credentials

1. **Never commit .env files to Git**
   - Already in `.gitignore`? ✓
   - If not, add it immediately

2. **Don't share passwords**
   - Use different passwords for dev and prod
   - Rotate passwords periodically

3. **Use environment variables in CI/CD**
   - Store securely in GitHub Secrets / CI platform
   - Never hardcode in workflows

4. **Audit access**
   - Review Supabase logs regularly
   - Check who has access to Supabase projects

### .gitignore Check

Ensure your `.gitignore` contains:

```
.env
.env.*
.env.local
.env.*.local
!.env.example
```

### Create Example File

Create `.env.example` for documentation:

```env
# .env.example - Copy to .env and fill in values

# Your Supabase project URL
VITE_SUPABASE_URL=https://your-project-id.supabase.co

# Your Supabase anon key (from Settings → API)
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Your database password
SUPABASE_DB_PASSWORD=your_database_password
```

## Alternative: Direct Database URL

Instead of separate variables, you can use a single `DATABASE_URL`:

```env
# .env
DATABASE_URL=postgresql://postgres:your_password@dev-project-id.db.supabase.co:5432/postgres

# .env.prod  
DATABASE_URL=postgresql://postgres:your_password@prod-project-id.db.supabase.co:5432/postgres
```

The scripts will automatically detect and use this format.

## Troubleshooting Environment Issues

### Error: "VITE_SUPABASE_URL not set"

**Solution**: Make sure `.env` file exists in project root and contains the variable.

```bash
# Check if file exists
ls -la .env

# Check if variable is set
grep VITE_SUPABASE_URL .env
```

### Error: "Invalid connection string"

**Solutions**:
1. Check password doesn't have special characters that need escaping
2. Verify the format matches: `postgresql://user:password@host:port/database`
3. URL-encode special characters in password

### Error: "Connection refused"

**Possible causes**:
1. Wrong host or port
2. Firewall blocking connection
3. Supabase IP whitelist
4. Database might be in different region

**Solutions**:
1. Test host is reachable: `ping your-project-id.db.supabase.co`
2. Check Supabase → Settings → Network → IP Whitelist
3. Add your IP address to whitelist

### Error: "Password authentication failed"

**Solutions**:
1. Verify password is correct (copy-paste to avoid typos)
2. Password may contain special characters - check if properly escaped
3. Reset password in Supabase and try again

## Environment Variables in Application

### Using in React/TypeScript

```typescript
// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Using in Node.js/Scripts

```typescript
// src/lib/database-util.ts
import dotenv from "dotenv";

dotenv.config(); // Loads .env
dotenv.config({ path: ".env.prod" }); // Or specific env file

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
```

## Next Steps

Once your `.env` files are set up:

1. ✓ Test connections with `database-util.ts test`
2. ✓ Choose a replication method from [SCHEMA_REPLICATION_GUIDE.md](SCHEMA_REPLICATION_GUIDE.md)
3. ✓ Run your schema replication

---

**Questions?**  
See [SCHEMA_REPLICATION_GUIDE.md](SCHEMA_REPLICATION_GUIDE.md) for detailed instructions or troubleshooting.

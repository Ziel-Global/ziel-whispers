# Schema Replication Script - Windows PowerShell
# This script extracts schema from dev Supabase and applies to production
#
# Prerequisites:
#   - PostgreSQL tools installed (pg_dump, psql)
#   - .env and .env.prod files configured
#   - PowerShell 5.0 or higher
#
# Usage:
#   .\scripts\replicate-schema.ps1
#   # or with confirmation
#   .\scripts\replicate-schema.ps1 -Confirm

param(
    [switch]$Confirm = $false,
    [switch]$DryRun = $false,
    [string]$OutputFile = "$PSScriptRoot\schema-dump-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"
)

# Function to load environment variables
function Load-EnvFile {
    param(
        [string]$Path
    )
    
    if (-not (Test-Path $Path)) {
        throw "Environment file not found: $Path"
    }
    
    $env = @{}
    Get-Content $Path | ForEach-Object {
        if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)$') {
            $key = $matches[1]
            $value = $matches[2].Trim('"').Trim("'")
            $env[$key] = $value
        }
    }
    return $env
}

# Function to extract connection string from environment
function Get-ConnectionString {
    param(
        [hashtable]$Env
    )
    
    # Try DATABASE_URL first
    if ($Env['DATABASE_URL']) {
        return $Env['DATABASE_URL']
    }
    
    # Try Supabase URL pattern
    if ($Env['VITE_SUPABASE_URL'] -and $Env['SUPABASE_DB_PASSWORD']) {
        $url = [System.Uri]$Env['VITE_SUPABASE_URL']
        $projectId = $url.Host.Split('.')[0]
        $password = [System.Web.HttpUtility]::UrlEncode($Env['SUPABASE_DB_PASSWORD'])
        return "postgresql://postgres:$password@$projectId.db.supabase.co:5432/postgres"
    }
    
    # Try individual components
    if ($Env['DB_HOST'] -and $Env['DB_USER'] -and $Env['DB_PASSWORD']) {
        $password = [System.Web.HttpUtility]::UrlEncode($Env['DB_PASSWORD'])
        $database = $Env['DB_NAME'] -or 'postgres'
        $port = $Env['DB_PORT'] -or '5432'
        return "postgresql://$($Env['DB_USER']):$password@$($Env['DB_HOST']):$port/$database"
    }
    
    throw "Could not extract database credentials from environment file"
}

# Function to check if PostgreSQL tools are installed
function Test-PostgreSQLTools {
    try {
        $output = & pg_dump --version 2>&1
        Write-Host "✓ PostgreSQL tools found: $output"
        return $true
    }
    catch {
        return $false
    }
}

# Function to extract schema
function Extract-Schema {
    param(
        [string]$ConnectionString,
        [string]$OutputFile
    )
    
    Write-Host "🔍 Extracting schema from dev database..."
    
    try {
        # Extract schema only, no data, no privileges
        & pg_dump `
            --schema-only `
            --no-privileges `
            --no-owner `
            --dbname=$ConnectionString `
            -f $OutputFile
        
        if ($LASTEXITCODE -eq 0) {
            $size = (Get-Item $OutputFile).Length / 1KB
            Write-Host "✅ Schema extracted successfully ($('{0:N0}' -f $size) KB)"
            return $true
        }
        else {
            Write-Host "❌ pg_dump failed with exit code: $LASTEXITCODE"
            return $false
        }
    }
    catch {
        Write-Host "❌ Error during extraction: $_"
        return $false
    }
}

# Function to apply schema
function Apply-Schema {
    param(
        [string]$ConnectionString,
        [string]$SchemaFile
    )
    
    Write-Host "📤 Applying schema to production database..."
    
    if (-not (Test-Path $SchemaFile)) {
        throw "Schema file not found: $SchemaFile"
    }
    
    try {
        & psql `
            --dbname=$ConnectionString `
            --file=$SchemaFile `
            --set ON_ERROR_STOP=on `
            --output=$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Schema applied successfully!"
            return $true
        }
        else {
            Write-Host "❌ psql failed with exit code: $LASTEXITCODE"
            return $false
        }
    }
    catch {
        Write-Host "❌ Error during application: $_"
        return $false
    }
}

# Function to verify schema consistency
function Verify-Schema {
    param(
        [string]$DevConnectionString,
        [string]$ProdConnectionString
    )
    
    Write-Host "🔎 Verifying schema consistency..."
    
    try {
        # Count tables in dev
        $devQuery = "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'extensions');"
        $devTables = & psql -t -c $devQuery --dbname=$DevConnectionString
        
        # Count tables in prod
        $prodTables = & psql -t -c $devQuery --dbname=$ProdConnectionString
        
        Write-Host "📊 Dev database tables: $($devTables.Trim())"
        Write-Host "📊 Prod database tables: $($prodTables.Trim())"
        
        if ($devTables.Trim() -eq $prodTables.Trim()) {
            Write-Host "✅ Table count matches!"
        }
        else {
            Write-Host "⚠️  Warning: Table counts differ - manual review recommended"
        }
    }
    catch {
        Write-Host "⚠️  Could not verify schema: $_"
    }
}

# Main execution
function Main {
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "   Supabase Schema Replication - Windows" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    
    # Check PostgreSQL tools
    if (-not (Test-PostgreSQLTools)) {
        Write-Host "❌ PostgreSQL tools not found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install PostgreSQL from: https://www.postgresql.org/download/windows/"
        Write-Host "During installation, make sure to add the bin directory to PATH"
        exit 1
    }
    
    # Load environment files
    Write-Host "📂 Loading environment files..."
    try {
        $devEnv = Load-EnvFile (Join-Path $PSScriptRoot '..\..\.env')
        $prodEnv = Load-EnvFile (Join-Path $PSScriptRoot '..\..\.env.prod')
    }
    catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
        exit 1
    }
    
    # Extract connection strings
    Write-Host "🔐 Extracting database credentials..."
    try {
        $devConnStr = Get-ConnectionString $devEnv
        $prodConnStr = Get-ConnectionString $prodEnv
    }
    catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
        exit 1
    }
    
    # Extract project/host info
    $devHost = if ($devConnStr -match '@([^:]+):') { $matches[1] } else { "unknown" }
    $prodHost = if ($prodConnStr -match '@([^:]+):') { $matches[1] } else { "unknown" }
    
    Write-Host "✓ Dev database: $devHost"
    Write-Host "✓ Prod database: $prodHost"
    Write-Host "✓ Schema will be saved to: $OutputFile"
    Write-Host ""
    
    # Confirmation
    Write-Host "⚠️  WARNING: This will REPLACE the production schema!" -ForegroundColor Yellow
    Write-Host "    - Existing tables, functions, and policies will be dropped"
    Write-Host "    - Data will NOT be affected (schema only)" -ForegroundColor Green
    Write-Host ""
    
    if (-not $Confirm) {
        $response = Read-Host "Continue? (yes/no)"
        if ($response -ne 'yes') {
            Write-Host "Cancelled by user"
            exit 0
        }
    }
    
    # Extract schema
    if (-not (Extract-Schema $devConnStr $OutputFile)) {
        Write-Host "Failed to extract schema" -ForegroundColor Red
        exit 1
    }
    
    if ($DryRun) {
        Write-Host ""
        Write-Host "🏁 Dry run completed. Schema saved to: $OutputFile" -ForegroundColor Green
        Write-Host "Review the file before running without -DryRun flag"
        exit 0
    }
    
    # Apply schema
    if (-not (Apply-Schema $prodConnStr $OutputFile)) {
        Write-Host "Failed to apply schema" -ForegroundColor Red
        exit 1
    }
    
    # Verify
    Verify-Schema $devConnStr $prodConnStr
    
    Write-Host ""
    Write-Host "✨ Schema replication completed successfully!" -ForegroundColor Green
    Write-Host "Schema backup: $OutputFile"
}

# Run
Main

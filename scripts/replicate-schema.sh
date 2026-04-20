#!/bin/bash

# Schema Replication Script - Unix/Linux/macOS
# This script extracts schema from dev Supabase and applies to production
#
# Prerequisites:
#   - PostgreSQL tools installed (pg_dump, psql)
#   - .env and .env.prod files configured
#   - Bash 4.0 or higher
#
# Usage:
#   chmod +x scripts/replicate-schema.sh
#   ./scripts/replicate-schema.sh
#   # or with dry-run
#   ./scripts/replicate-schema.sh --dry-run
#   # or with automatic confirmation
#   ./scripts/replicate-schema.sh --yes

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Defaults
DRY_RUN=false
AUTO_CONFIRM=false
OUTPUT_FILE="schema-dump-$(date +%Y%m%d-%H%M%S).sql"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
    --dry-run)
        DRY_RUN=true
        shift
        ;;
    --yes)
        AUTO_CONFIRM=true
        shift
        ;;
    --output)
        OUTPUT_FILE="$2"
        shift 2
        ;;
    *)
        echo "Unknown option: $1"
        exit 1
        ;;
    esac
done

# Function to load environment
load_env_file() {
    local env_file="$1"
    if [[ ! -f "$env_file" ]]; then
        echo -e "${RED}Error: Environment file not found: $env_file${NC}"
        return 1
    fi
    
    # Source the file but capture only the exports we need
    set -a
    source "$env_file"
    set +a
}

# Function to extract connection string
get_connection_string() {
    # Try DATABASE_URL first
    if [[ -n "$DATABASE_URL" ]]; then
        echo "$DATABASE_URL"
        return 0
    fi
    
    # Try Supabase pattern
    if [[ -n "$VITE_SUPABASE_URL" && -n "$SUPABASE_DB_PASSWORD" ]]; then
        local url="$VITE_SUPABASE_URL"
        local project_id=$(echo "$url" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')
        local password=$(printf '%s' "$SUPABASE_DB_PASSWORD" | jq -sRr @uri)
        echo "postgresql://postgres:$password@${project_id}.db.supabase.co:5432/postgres"
        return 0
    fi
    
    # Try individual components
    if [[ -n "$DB_HOST" && -n "$DB_USER" && -n "$DB_PASSWORD" ]]; then
        local password=$(printf '%s' "$DB_PASSWORD" | jq -sRr @uri)
        local database="${DB_NAME:-postgres}"
        local port="${DB_PORT:-5432}"
        echo "postgresql://${DB_USER}:${password}@${DB_HOST}:${port}/${database}"
        return 0
    fi
    
    echo "Error: Could not extract database credentials"
    return 1
}

# Function to check PostgreSQL tools
check_postgres_tools() {
    if ! command -v pg_dump &> /dev/null; then
        echo -e "${RED}Error: pg_dump not found${NC}"
        echo "Install PostgreSQL tools:"
        echo "  - Ubuntu/Debian: sudo apt-get install postgresql-client"
        echo "  - macOS: brew install postgresql"
        echo "  - Others: https://www.postgresql.org/download/"
        return 1
    fi
    
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}Error: psql not found${NC}"
        return 1
    fi
    
    local version=$(pg_dump --version)
    echo -e "${GREEN}✓ PostgreSQL tools found: $version${NC}"
    return 0
}

# Function to extract schema
extract_schema() {
    local conn_str="$1"
    local output_file="$2"
    
    echo -e "${CYAN}🔍 Extracting schema from dev database...${NC}"
    
    if ! pg_dump \
        --schema-only \
        --no-privileges \
        --no-owner \
        --dbname="$conn_str" \
        -f "$output_file"; then
        echo -e "${RED}❌ pg_dump failed${NC}"
        return 1
    fi
    
    local size=$(du -h "$output_file" | cut -f1)
    echo -e "${GREEN}✅ Schema extracted successfully ($size)${NC}"
    return 0
}

# Function to apply schema
apply_schema() {
    local conn_str="$1"
    local schema_file="$2"
    
    echo -e "${CYAN}📤 Applying schema to production database...${NC}"
    
    if [[ ! -f "$schema_file" ]]; then
        echo -e "${RED}Error: Schema file not found: $schema_file${NC}"
        return 1
    fi
    
    if ! psql \
        --dbname="$conn_str" \
        --file="$schema_file" \
        --set ON_ERROR_STOP=on \
        --output=/dev/null; then
        echo -e "${RED}❌ psql failed${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Schema applied successfully!${NC}"
    return 0
}

# Function to verify schema
verify_schema() {
    local dev_conn="$1"
    local prod_conn="$2"
    
    echo -e "${CYAN}🔎 Verifying schema consistency...${NC}"
    
    local query="SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'extensions');"
    
    local dev_tables=$(psql -t -c "$query" --dbname="$dev_conn" 2>/dev/null | tr -d ' ' || echo "error")
    local prod_tables=$(psql -t -c "$query" --dbname="$prod_conn" 2>/dev/null | tr -d ' ' || echo "error")
    
    echo "📊 Dev database tables: $dev_tables"
    echo "📊 Prod database tables: $prod_tables"
    
    if [[ "$dev_tables" == "$prod_tables" ]]; then
        echo -e "${GREEN}✅ Table count matches!${NC}"
    else
        echo -e "${YELLOW}⚠️  Warning: Table counts differ - manual review recommended${NC}"
    fi
}

# Main execution
main() {
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo -e "${CYAN}   Supabase Schema Replication - Unix${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo ""
    
    # Check tools
    check_postgres_tools || exit 1
    echo ""
    
    # Load environment
    echo -e "${CYAN}📂 Loading environment files...${NC}"
    load_env_file "$PROJECT_ROOT/.env" || exit 1
    
    local dev_conn
    dev_conn=$(get_connection_string) || exit 1
    unset DATABASE_URL VITE_SUPABASE_URL SUPABASE_DB_PASSWORD DB_HOST DB_USER DB_PASSWORD DB_NAME DB_PORT
    
    # Load prod environment
    load_env_file "$PROJECT_ROOT/.env.prod" || exit 1
    
    local prod_conn
    prod_conn=$(get_connection_string) || exit 1
    echo ""
    
    # Extract hosts
    local dev_host=$(echo "$dev_conn" | sed -E 's|.*@([^:]+):.*|\1|')
    local prod_host=$(echo "$prod_conn" | sed -E 's|.*@([^:]+):.*|\1|')
    
    echo -e "${GREEN}✓ Dev database: $dev_host${NC}"
    echo -e "${GREEN}✓ Prod database: $prod_host${NC}"
    echo -e "${GREEN}✓ Schema will be saved to: $OUTPUT_FILE${NC}"
    echo ""
    
    # Warning
    echo -e "${YELLOW}⚠️  WARNING: This will REPLACE the production schema!${NC}"
    echo "    - Existing tables, functions, and policies will be dropped"
    echo -e "${GREEN}    - Data will NOT be affected (schema only)${NC}"
    echo ""
    
    # Confirmation
    if [[ "$AUTO_CONFIRM" != "true" ]]; then
        read -p "Continue? (yes/no): " response
        if [[ "$response" != "yes" ]]; then
            echo "Cancelled by user"
            exit 0
        fi
    fi
    echo ""
    
    # Extract schema
    extract_schema "$dev_conn" "$OUTPUT_FILE" || exit 1
    echo ""
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${GREEN}🏁 Dry run completed. Schema saved to: $OUTPUT_FILE${NC}"
        echo "Review the file before running without --dry-run flag"
        exit 0
    fi
    
    # Apply schema
    apply_schema "$prod_conn" "$OUTPUT_FILE" || exit 1
    echo ""
    
    # Verify
    verify_schema "$dev_conn" "$prod_conn"
    echo ""
    
    echo -e "${GREEN}✨ Schema replication completed successfully!${NC}"
    echo -e "${GREEN}Schema backup: $OUTPUT_FILE${NC}"
}

# Run main
main "$@"

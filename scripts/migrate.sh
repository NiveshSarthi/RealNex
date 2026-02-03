#!/bin/bash

# SyndiTech Database Migration Script
# Usage: ./migrate.sh [action] [environment]
# Actions: init, migrate, rollback, status
# Environment: development, staging, production

set -e

# Configuration
ACTION=${1:-status}
ENVIRONMENT=${2:-development}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_FILE="${PROJECT_ROOT}/backend/database/schema.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Load environment variables
load_environment() {
    local env_file=".env.${ENVIRONMENT}"
    if [ -f "$env_file" ]; then
        export $(grep -v '^#' "$env_file" | xargs)
        log_info "Loaded environment from $env_file"
    elif [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
        log_info "Loaded environment from .env"
    else
        log_warning "No environment file found, using system defaults"
    fi
}

# Check database connectivity
check_database() {
    log_info "Checking database connectivity..."

    if docker-compose ps | grep -q "postgres"; then
        log_info "Using Docker PostgreSQL container..."
        if docker-compose exec -T postgres pg_isready -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" >/dev/null 2>&1; then
            log_success "Database is accessible"
            return 0
        fi
    else
        log_info "Using direct PostgreSQL connection..."
        if PGPASSWORD="${DB_PASSWORD}" pg_isready -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" >/dev/null 2>&1; then
            log_success "Database is accessible"
            return 0
        fi
    fi

    log_error "Database is not accessible"
    return 1
}

# Initialize database
init_database() {
    log_info "Initializing database..."

    if [ ! -f "$SCHEMA_FILE" ]; then
        log_error "Schema file not found: $SCHEMA_FILE"
        exit 1
    fi

    # Create database if it doesn't exist
    if docker-compose ps | grep -q "postgres"; then
        log_info "Creating database using Docker..."
        docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE ${DB_NAME:-synditech_dev};" 2>/dev/null || true
        docker-compose exec -T postgres psql -U postgres -c "CREATE USER ${DB_USER:-synditech} WITH PASSWORD '${DB_PASSWORD:-synditech_password}';" 2>/dev/null || true
        docker-compose exec -T postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME:-synditech_dev} TO ${DB_USER:-synditech};" 2>/dev/null || true

        log_info "Running schema initialization..."
        docker-compose exec -T postgres psql -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" -f /docker-entrypoint-initdb.d/01-schema.sql 2>/dev/null || \
        cat "$SCHEMA_FILE" | docker-compose exec -T postgres psql -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}"
    else
        log_info "Creating database using direct connection..."
        PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U postgres -c "CREATE DATABASE ${DB_NAME:-synditech_dev};" 2>/dev/null || true
        PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U postgres -c "CREATE USER ${DB_USER:-synditech} WITH PASSWORD '${DB_PASSWORD:-synditech_password}';" 2>/dev/null || true
        PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME:-synditech_dev} TO ${DB_USER:-synditech};" 2>/dev/null || true

        log_info "Running schema initialization..."
        PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" -f "$SCHEMA_FILE"
    fi

    log_success "Database initialized successfully"
}

# Run migrations
run_migrations() {
    log_info "Running database migrations..."

    # Check for migration files
    local migrations_dir="${PROJECT_ROOT}/backend/database/migrations"
    if [ ! -d "$migrations_dir" ]; then
        log_warning "No migrations directory found, creating one..."
        mkdir -p "$migrations_dir"
        log_info "Created migrations directory: $migrations_dir"
        log_info "Add migration files to this directory to use this feature"
        return 0
    fi

    local migration_files=$(find "$migrations_dir" -name "*.sql" -type f | sort)
    if [ -z "$migration_files" ]; then
        log_info "No migration files found"
        return 0
    fi

    # Create migrations table if it doesn't exist
    local create_migrations_table="
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        description TEXT
    );"

    if docker-compose ps | grep -q "postgres"; then
        echo "$create_migrations_table" | docker-compose exec -T postgres psql -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" >/dev/null 2>&1
    else
        echo "$create_migrations_table" | PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" >/dev/null 2>&1
    fi

    # Run each migration
    echo "$migration_files" | while read -r migration_file; do
        if [ -f "$migration_file" ]; then
            local filename=$(basename "$migration_file")
            local version="${filename%.*}"

            # Check if migration has already been applied
            local check_query="SELECT version FROM schema_migrations WHERE version = '$version';"
            local applied=""

            if docker-compose ps | grep -q "postgres"; then
                applied=$(echo "$check_query" | docker-compose exec -T postgres psql -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" -t -A)
            else
                applied=$(echo "$check_query" | PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" -t -A)
            fi

            if [ -n "$applied" ]; then
                log_info "Migration $version already applied, skipping..."
                continue
            fi

            log_info "Applying migration: $filename"

            # Apply migration
            if docker-compose ps | grep -q "postgres"; then
                cat "$migration_file" | docker-compose exec -T postgres psql -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" >/dev/null 2>&1
                echo "INSERT INTO schema_migrations (version, description) VALUES ('$version', '$filename');" | docker-compose exec -T postgres psql -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" >/dev/null 2>&1
            else
                PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" -f "$migration_file" >/dev/null 2>&1
                echo "INSERT INTO schema_migrations (version, description) VALUES ('$version', '$filename');" | PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" >/dev/null 2>&1
            fi

            log_success "Migration $version applied successfully"
        fi
    done

    log_success "All migrations completed"
}

# Rollback migrations
rollback_migrations() {
    log_info "Rolling back last migration..."

    # Get the last applied migration
    local last_migration_query="SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 1;"
    local last_version=""

    if docker-compose ps | grep -q "postgres"; then
        last_version=$(echo "$last_migration_query" | docker-compose exec -T postgres psql -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" -t -A)
    else
        last_version=$(echo "$last_migration_query" | PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" -t -A)
    fi

    if [ -z "$last_version" ]; then
        log_warning "No migrations to rollback"
        return 0
    fi

    log_info "Rolling back migration: $last_version"

    # Look for rollback file
    local rollback_file="${PROJECT_ROOT}/backend/database/migrations/${last_version}_rollback.sql"
    if [ -f "$rollback_file" ]; then
        log_info "Found rollback file: $rollback_file"

        if docker-compose ps | grep -q "postgres"; then
            cat "$rollback_file" | docker-compose exec -T postgres psql -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" >/dev/null 2>&1
        else
            PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" -f "$rollback_file" >/dev/null 2>&1
        fi
    else
        log_warning "No rollback file found for migration $last_version"
    fi

    # Remove from migrations table
    local delete_query="DELETE FROM schema_migrations WHERE version = '$last_version';"

    if docker-compose ps | grep -q "postgres"; then
        echo "$delete_query" | docker-compose exec -T postgres psql -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" >/dev/null 2>&1
    else
        echo "$delete_query" | PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" >/dev/null 2>&1
    fi

    log_success "Migration $last_version rolled back successfully"
}

# Show migration status
show_status() {
    log_info "Database Migration Status"

    # Check if migrations table exists
    local check_table_query="SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations');"
    local table_exists=""

    if docker-compose ps | grep -q "postgres"; then
        table_exists=$(echo "$check_table_query" | docker-compose exec -T postgres psql -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" -t -A)
    else
        table_exists=$(echo "$check_table_query" | PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" -t -A)
    fi

    if [ "$table_exists" != "t" ]; then
        log_info "No migrations table found - database not initialized with migrations"
        return 0
    fi

    echo ""
    echo "Applied Migrations:"
    local migrations_query="SELECT version, applied_at, description FROM schema_migrations ORDER BY applied_at DESC;"

    if docker-compose ps | grep -q "postgres"; then
        echo "$migrations_query" | docker-compose exec -T postgres psql -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}"
    else
        echo "$migrations_query" | PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}"
    fi

    echo ""
    echo "Pending Migrations:"
    local migrations_dir="${PROJECT_ROOT}/backend/database/migrations"
    if [ -d "$migrations_dir" ]; then
        local pending_files=$(find "$migrations_dir" -name "*.sql" -not -name "*_rollback.sql" -type f | sort)
        echo "$pending_files" | while read -r file; do
            if [ -f "$file" ]; then
                local filename=$(basename "$file")
                local version="${filename%.*}"

                # Check if applied
                local check_query="SELECT version FROM schema_migrations WHERE version = '$version';"
                local applied=""

                if docker-compose ps | grep -q "postgres"; then
                    applied=$(echo "$check_query" | docker-compose exec -T postgres psql -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" -t -A)
                else
                    applied=$(echo "$check_query" | PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-synditech}" -d "${DB_NAME:-synditech_dev}" -t -A)
                fi

                if [ -z "$applied" ]; then
                    echo "  - $filename (pending)"
                fi
            fi
        done
    else
        echo "  No migrations directory found"
    fi
}

# Create new migration file
create_migration() {
    local name=${2:-"new_migration"}
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local migrations_dir="${PROJECT_ROOT}/backend/database/migrations"

    mkdir -p "$migrations_dir"

    local migration_file="${migrations_dir}/${timestamp}_${name}.sql"
    local rollback_file="${migrations_dir}/${timestamp}_${name}_rollback.sql"

    # Create migration file template
    cat > "$migration_file" << 'EOF'
-- Migration: YOUR_MIGRATION_DESCRIPTION
-- Created: TIMESTAMP

BEGIN;

-- Add your migration SQL here

COMMIT;
EOF

    # Create rollback file template
    cat > "$rollback_file" << 'EOF'
-- Rollback for: YOUR_MIGRATION_DESCRIPTION
-- Created: TIMESTAMP

BEGIN;

-- Add your rollback SQL here

COMMIT;
EOF

    log_success "Migration files created:"
    log_info "  Migration: $migration_file"
    log_info "  Rollback: $rollback_file"
    log_info "Edit these files with your migration SQL"
}

# Main script logic
main() {
    log_info "SyndiTech Database Migration Script"
    log_info "Action: $ACTION"
    log_info "Environment: $ENVIRONMENT"

    cd "$PROJECT_ROOT"
    load_environment

    case $ACTION in
        init)
            check_database && init_database
            ;;
        migrate)
            check_database && run_migrations
            ;;
        rollback)
            check_database && rollback_migrations
            ;;
        status)
            check_database && show_status
            ;;
        create)
            create_migration "$@"
            ;;
        *)
            log_error "Invalid action: $ACTION"
            echo "Usage: $0 [action] [environment]"
            echo "Actions: init, migrate, rollback, status, create [name]"
            echo "Environments: development, staging, production"
            exit 1
            ;;
    esac

    log_success "Operation completed successfully"
}

# Run main function
main "$@"
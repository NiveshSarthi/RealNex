#!/bin/bash

# SyndiTech Backup Script
# Usage: ./backup.sh [action] [type]
# Actions: create, list, restore, cleanup
# Types: database, application, full

set -e

# Configuration
ACTION=${1:-create}
TYPE=${2:-full}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${PROJECT_ROOT}/backups"

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

# Ensure backup directory exists
ensure_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Created backup directory: $BACKUP_DIR"
    fi
}

# Create database backup
create_database_backup() {
    log_info "Creating database backup..."

    local backup_file="${BACKUP_DIR}/synditech_db_${TIMESTAMP}.sql"

    # Use Docker to create backup if containers are running
    if docker-compose ps | grep -q "postgres"; then
        log_info "Using Docker container for backup..."
        docker-compose exec -T postgres pg_dump \
            --username synditech \
            --dbname synditech_dev \
            --no-password \
            --format=custom \
            --compress=9 \
            --file=/tmp/backup.sql

        docker-compose cp postgres:/tmp/backup.sql "$backup_file"
        docker-compose exec -T postgres rm /tmp/backup.sql
    else
        log_info "Using direct PostgreSQL connection for backup..."
        PGPASSWORD=$DB_PASSWORD pg_dump \
            --host $DB_HOST \
            --port $DB_PORT \
            --username $DB_USER \
            --dbname $DB_NAME \
            --no-password \
            --format=custom \
            --compress=9 \
            --file="$backup_file"
    fi

    local file_size=$(du -h "$backup_file" | cut -f1)
    log_success "Database backup created: $backup_file (${file_size})"

    echo "$backup_file"
}

# Create application backup
create_application_backup() {
    log_info "Creating application backup..."

    local backup_file="${BACKUP_DIR}/synditech_app_${TIMESTAMP}.tar.gz"

    # Backup uploads, logs, and configuration
    local source_dirs=()
    [ -d "./backend/uploads" ] && source_dirs+=("./backend/uploads")
    [ -d "./backend/logs" ] && source_dirs+=("./backend/logs")
    [ -d "./backend/config" ] && source_dirs+=("./backend/config")

    if [ ${#source_dirs[@]} -eq 0 ]; then
        log_warning "No application directories found to backup"
        # Create empty archive
        tar -czf "$backup_file" --files-from /dev/null
    else
        log_info "Backing up directories: ${source_dirs[*]}"
        tar -czf "$backup_file" "${source_dirs[@]}"
    fi

    local file_size=$(du -h "$backup_file" | cut -f1)
    log_success "Application backup created: $backup_file (${file_size})"

    echo "$backup_file"
}

# Create full backup
create_full_backup() {
    log_info "Creating full system backup..."

    local db_backup=$(create_database_backup)
    local app_backup=$(create_application_backup)

    # Create manifest file
    local manifest_file="${BACKUP_DIR}/manifest_${TIMESTAMP}.json"
    cat > "$manifest_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "type": "full_backup",
  "components": {
    "database": {
      "file": "$(basename "$db_backup")",
      "size": "$(stat -f%z "$db_backup" 2>/dev/null || stat -c%s "$db_backup")"
    },
    "application": {
      "file": "$(basename "$app_backup")",
      "size": "$(stat -f%z "$app_backup" 2>/dev/null || stat -c%s "$app_backup")"
    }
  },
  "environment": "${NODE_ENV:-development}",
  "version": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
}
EOF

    log_success "Full backup manifest created: $manifest_file"
    log_success "Full system backup completed"
}

# List available backups
list_backups() {
    log_info "Available backups:"

    if [ ! -d "$BACKUP_DIR" ]; then
        log_warning "Backup directory does not exist"
        return
    fi

    local count=0
    while IFS= read -r -d '' file; do
        local filename=$(basename "$file")
        local size=$(du -h "$file" | cut -f1)
        local modified=$(stat -c%y "$file" 2>/dev/null | cut -d'.' -f1 || stat -f%Sm -t "%Y-%m-%d %H:%M:%S" "$file")

        if [[ $filename == synditech_db_* ]]; then
            echo "Database: $filename | Size: $size | Modified: $modified"
        elif [[ $filename == synditech_app_* ]]; then
            echo "Application: $filename | Size: $size | Modified: $modified"
        elif [[ $filename == manifest_* ]]; then
            echo "Manifest: $filename | Modified: $modified"
        fi
        ((count++))
    done < <(find "$BACKUP_DIR" -type f \( -name "synditech_*" -o -name "manifest_*" \) -print0 | sort -z)

    if [ $count -eq 0 ]; then
        log_info "No backups found"
    else
        log_info "Total backups: $count"
    fi
}

# Restore from backup
restore_backup() {
    if [ -z "$TYPE" ]; then
        log_error "Please specify backup type: database, application, or full"
        exit 1
    fi

    log_info "Restoring $TYPE backup..."

    case $TYPE in
        database)
            restore_database
            ;;
        application)
            restore_application
            ;;
        full)
            restore_full
            ;;
        *)
            log_error "Invalid backup type: $TYPE"
            exit 1
            ;;
    esac
}

# Restore database
restore_database() {
    log_info "Finding latest database backup..."

    local latest_backup=$(find "$BACKUP_DIR" -name "synditech_db_*.sql" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)

    if [ -z "$latest_backup" ]; then
        log_error "No database backup found"
        exit 1
    fi

    log_info "Restoring from: $latest_backup"

    # Stop application before restore
    log_info "Stopping application services..."
    docker-compose stop backend frontend 2>/dev/null || true

    # Restore database
    if docker-compose ps | grep -q "postgres"; then
        log_info "Using Docker container for restore..."
        docker-compose cp "$latest_backup" postgres:/tmp/backup.sql
        docker-compose exec -T postgres pg_restore \
            --username synditech \
            --dbname synditech_dev \
            --no-password \
            --clean \
            --if-exists \
            /tmp/backup.sql
        docker-compose exec -T postgres rm /tmp/backup.sql
    else
        log_info "Using direct PostgreSQL connection for restore..."
        PGPASSWORD=$DB_PASSWORD pg_restore \
            --host $DB_HOST \
            --port $DB_PORT \
            --username $DB_USER \
            --dbname $DB_NAME \
            --no-password \
            --clean \
            --if-exists \
            "$latest_backup"
    fi

    # Restart application
    log_info "Restarting application services..."
    docker-compose start backend frontend 2>/dev/null || true

    log_success "Database restore completed"
}

# Restore application
restore_application() {
    log_info "Finding latest application backup..."

    local latest_backup=$(find "$BACKUP_DIR" -name "synditech_app_*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)

    if [ -z "$latest_backup" ]; then
        log_error "No application backup found"
        exit 1
    fi

    log_info "Restoring from: $latest_backup"

    # Stop application
    docker-compose stop frontend 2>/dev/null || true

    # Extract backup
    local restore_dir="./restore_temp"
    mkdir -p "$restore_dir"
    tar -xzf "$latest_backup" -C "$restore_dir"

    # Copy files back (implement based on your directory structure)
    if [ -d "$restore_dir/backend/uploads" ]; then
        cp -r "$restore_dir/backend/uploads"/* "./backend/uploads/" 2>/dev/null || true
    fi
    if [ -d "$restore_dir/backend/logs" ]; then
        cp -r "$restore_dir/backend/logs"/* "./backend/logs/" 2>/dev/null || true
    fi

    # Clean up
    rm -rf "$restore_dir"

    # Restart application
    docker-compose start frontend 2>/dev/null || true

    log_success "Application restore completed"
}

# Restore full backup
restore_full() {
    log_info "Restoring full system backup..."

    restore_database
    restore_application

    log_success "Full system restore completed"
}

# Cleanup old backups
cleanup_backups() {
    local retention_days=${BACKUP_RETENTION_DAYS:-30}
    log_info "Cleaning up backups older than $retention_days days..."

    local cutoff_date=$(date -d "$retention_days days ago" +%Y%m%d)
    local deleted_count=0

    while IFS= read -r -d '' file; do
        local file_date=$(basename "$file" | grep -oP '\d{8}' | head -1)
        if [ "$file_date" ] && [ "$file_date" -lt "$cutoff_date" ]; then
            rm -f "$file"
            log_info "Deleted old backup: $(basename "$file")"
            ((deleted_count++))
        fi
    done < <(find "$BACKUP_DIR" -name "synditech_*" -type f -print0)

    if [ $deleted_count -gt 0 ]; then
        log_success "Cleaned up $deleted_count old backups"
    else
        log_info "No old backups to clean up"
    fi
}

# Validate backup
validate_backup() {
    if [ -z "$TYPE" ]; then
        log_error "Please specify backup type to validate"
        exit 1
    fi

    log_info "Validating $TYPE backup..."

    local latest_backup=""
    case $TYPE in
        database)
            latest_backup=$(find "$BACKUP_DIR" -name "synditech_db_*.sql" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
            ;;
        application)
            latest_backup=$(find "$BACKUP_DIR" -name "synditech_app_*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
            ;;
    esac

    if [ -z "$latest_backup" ]; then
        log_error "No $TYPE backup found to validate"
        exit 1
    fi

    log_info "Validating: $latest_backup"

    case $TYPE in
        database)
            # Test if pg_restore can read the file
            if pg_restore --list "$latest_backup" &>/dev/null; then
                log_success "Database backup is valid"
            else
                log_error "Database backup is corrupted"
                exit 1
            fi
            ;;
        application)
            # Test if tar can read the file
            if tar -tzf "$latest_backup" &>/dev/null; then
                log_success "Application backup is valid"
            else
                log_error "Application backup is corrupted"
                exit 1
            fi
            ;;
    esac
}

# Main script logic
main() {
    ensure_backup_dir

    case $ACTION in
        create)
            case $TYPE in
                database)
                    create_database_backup
                    ;;
                application)
                    create_application_backup
                    ;;
                full)
                    create_full_backup
                    ;;
                *)
                    log_error "Invalid backup type: $TYPE"
                    echo "Usage: $0 create [database|application|full]"
                    exit 1
                    ;;
            esac
            ;;
        list)
            list_backups
            ;;
        restore)
            restore_backup
            ;;
        cleanup)
            cleanup_backups
            ;;
        validate)
            validate_backup
            ;;
        *)
            log_error "Invalid action: $ACTION"
            echo "Usage: $0 [action] [type]"
            echo "Actions: create, list, restore, cleanup, validate"
            echo "Types: database, application, full"
            exit 1
            ;;
    esac
}

# Load environment variables
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Run main function
main "$@"
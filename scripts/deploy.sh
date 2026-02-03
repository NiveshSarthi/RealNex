#!/bin/bash

# SyndiTech Deployment Script
# Usage: ./deploy.sh [environment] [action]
# Environments: development, staging, production
# Actions: build, deploy, rollback, status

set -e

# Configuration
ENVIRONMENT=${1:-development}
ACTION=${2:-deploy}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check if .env file exists
    if [ ! -f ".env.${ENVIRONMENT}" ]; then
        log_warning "Environment file .env.${ENVIRONMENT} not found. Using default .env if available."
    fi

    log_success "Prerequisites check passed"
}

# Build Docker images
build_images() {
    log_info "Building Docker images for ${ENVIRONMENT}..."

    # Build backend image
    log_info "Building backend image..."
    docker build -t synditech/backend:${ENVIRONMENT}-${TIMESTAMP} ./backend
    docker tag synditech/backend:${ENVIRONMENT}-${TIMESTAMP} synditech/backend:latest

    # Build frontend image
    log_info "Building frontend image..."
    docker build -t synditech/frontend:${ENVIRONMENT}-${TIMESTAMP} ./frontend
    docker tag synditech/frontend:${ENVIRONMENT}-${TIMESTAMP} synditech/frontend:latest

    log_success "Docker images built successfully"
}

# Deploy application
deploy_application() {
    log_info "Deploying SyndiTech to ${ENVIRONMENT}..."

    # Create backup before deployment
    if [ "$ENVIRONMENT" = "production" ]; then
        log_info "Creating pre-deployment backup..."
        ./scripts/backup.sh create || log_warning "Backup creation failed, continuing with deployment"
    fi

    # Set environment file
    ENV_FILE=".env.${ENVIRONMENT}"
    if [ ! -f "$ENV_FILE" ]; then
        ENV_FILE=".env"
    fi

    # Stop existing containers
    log_info "Stopping existing containers..."
    docker-compose --env-file "$ENV_FILE" -f docker-compose.yml down || true

    # Start new containers
    log_info "Starting new containers..."
    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose --env-file "$ENV_FILE" -f docker-compose.yml --profile production up -d
    else
        docker-compose --env-file "$ENV_FILE" -f docker-compose.yml --profile development up -d
    fi

    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30

    # Check health of services
    check_health

    log_success "SyndiTech deployed successfully to ${ENVIRONMENT}"
}

# Check health of deployed services
check_health() {
    log_info "Checking service health..."

    # Check backend health
    if curl -f http://localhost:3001/api/monitoring/health &> /dev/null; then
        log_success "Backend is healthy"
    else
        log_error "Backend health check failed"
        return 1
    fi

    # Check frontend health (if running)
    if curl -f http://localhost:3000/api/health &> /dev/null 2>/dev/null; then
        log_success "Frontend is healthy"
    else
        log_warning "Frontend health check failed (may not be running in this configuration)"
    fi

    # Check database connectivity
    if docker-compose exec -T postgres pg_isready -U synditech -d synditech_dev &> /dev/null; then
        log_success "Database is healthy"
    else
        log_error "Database health check failed"
        return 1
    fi
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."

    # Stop current containers
    docker-compose down

    # Find previous images
    PREVIOUS_BACKEND=$(docker images synditech/backend --format "{{.Repository}}:{{.Tag}}" | sed -n '2p')
    PREVIOUS_FRONTEND=$(docker images synditech/frontend --format "{{.Repository}}:{{.Tag}}" | sed -n '2p')

    if [ -n "$PREVIOUS_BACKEND" ] && [ -n "$PREVIOUS_FRONTEND" ]; then
        log_info "Found previous images, starting rollback..."

        # Tag previous images as latest
        docker tag "$PREVIOUS_BACKEND" synditech/backend:latest
        docker tag "$PREVIOUS_FRONTEND" synditech/frontend:latest

        # Start containers with previous images
        deploy_application

        log_success "Rollback completed successfully"
    else
        log_error "No previous images found for rollback"
        exit 1
    fi
}

# Show deployment status
show_status() {
    log_info "SyndiTech Deployment Status"

    echo ""
    echo "Container Status:"
    docker-compose ps

    echo ""
    echo "Service Health:"
    echo "Backend: $(curl -s http://localhost:3001/api/monitoring/health | jq -r '.status' 2>/dev/null || echo 'unreachable')"
    echo "Frontend: $(curl -s http://localhost:3000/api/health 2>/dev/null || echo 'unreachable')"
    echo "Database: $(docker-compose exec -T postgres pg_isready -U synditech -d synditech_dev >/dev/null 2>&1 && echo 'healthy' || echo 'unhealthy')"

    echo ""
    echo "Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

    echo ""
    echo "Recent Logs:"
    echo "Backend logs (last 10 lines):"
    docker-compose logs --tail=10 backend 2>/dev/null || echo "No backend logs available"
}

# Clean up old images and containers
cleanup() {
    log_info "Cleaning up old Docker images and containers..."

    # Remove dangling images
    docker image prune -f

    # Remove stopped containers
    docker container prune -f

    # Remove unused volumes
    docker volume prune -f

    log_success "Cleanup completed"
}

# Main script logic
main() {
    log_info "SyndiTech Deployment Script"
    log_info "Environment: ${ENVIRONMENT}"
    log_info "Action: ${ACTION}"

    cd "$PROJECT_ROOT"

    case $ACTION in
        build)
            check_prerequisites
            build_images
            ;;
        deploy)
            check_prerequisites
            build_images
            deploy_application
            ;;
        rollback)
            check_prerequisites
            rollback_deployment
            ;;
        status)
            show_status
            ;;
        cleanup)
            cleanup
            ;;
        health)
            check_health
            ;;
        *)
            log_error "Invalid action: $ACTION"
            echo "Usage: $0 [environment] [action]"
            echo "Environments: development, staging, production"
            echo "Actions: build, deploy, rollback, status, cleanup, health"
            exit 1
            ;;
    esac

    log_success "Operation completed successfully"
}

# Run main function
main "$@"
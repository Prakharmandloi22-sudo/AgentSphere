#!/bin/bash
# ==============================================================================
# AgentSphere Automated PostgreSQL Backup Script (Assessment 14)
# Performs consistent pg_dump with timestamping, gzip compression, and retention
# ==============================================================================

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/agentsphere_db_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=7

mkdir -p "${BACKUP_DIR}"

echo "[AgentSphere Backup] Starting database backup at $(date)..."

# If docker is running
if docker ps | grep -q agentsphere-postgres; then
    docker exec -t agentsphere-postgres pg_dump -U "${POSTGRES_USER:-agentsphere}" "${POSTGRES_DB:-agentsphere_db}" | gzip > "${BACKUP_FILE}"
else
    # Fallback to local pg_dump
    pg_dump "${DATABASE_URL}" | gzip > "${BACKUP_FILE}"
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[AgentSphere Backup] Backup successful: ${BACKUP_FILE} (Size: ${BACKUP_SIZE})"

# Retention clean-up
echo "[AgentSphere Backup] Purging backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "agentsphere_db_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -exec rm {} \;

echo "[AgentSphere Backup] Complete."

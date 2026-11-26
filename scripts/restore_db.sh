#!/bin/bash
# ==============================================================================
# AgentSphere Disaster Recovery & Restoration Script (Assessment 14)
# Restores PostgreSQL database from compressed backup file
# ==============================================================================

set -e

if [ -z "$1" ]; then
    echo "Usage: ./restore_db.sh <path_to_backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file '${BACKUP_FILE}' does not exist!"
    exit 1
fi

echo "[AgentSphere Restore] WARNING: This will overwrite data in the target database."
read -p "Are you sure you want to proceed with restore? (y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "[AgentSphere Restore] Restoring from ${BACKUP_FILE}..."

if docker ps | grep -q agentsphere-postgres; then
    gunzip -c "${BACKUP_FILE}" | docker exec -i agentsphere-postgres psql -U "${POSTGRES_USER:-agentsphere}" -d "${POSTGRES_DB:-agentsphere_db}"
else
    gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}"
fi

echo "[AgentSphere Restore] Database successfully restored."

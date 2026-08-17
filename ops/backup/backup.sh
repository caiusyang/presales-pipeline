#!/bin/sh
set -eu

backup_once() {
  timestamp="$(date '+%Y%m%d-%H%M%S')"
  target="/backups/presales-pipeline-${timestamp}.sql.gz"
  temporary="${target}.tmp"

  export MYSQL_PWD="${MYSQL_PASSWORD}"
  mysqldump \
    --host="${MYSQL_HOST}" \
    --user="${MYSQL_USER}" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --set-gtid-purged=OFF \
    --default-character-set=utf8mb4 \
    "${MYSQL_DATABASE}" | gzip > "${temporary}"

  mv "${temporary}" "${target}"
  touch /backups/.last-success
  find /backups -type f -name 'presales-pipeline-*.sql.gz' \
    -mtime "+${BACKUP_RETENTION_DAYS:-30}" -delete
  echo "backup completed: ${target}"
}

while true; do
  backup_once
  sleep "${BACKUP_INTERVAL_SECONDS:-86400}"
done

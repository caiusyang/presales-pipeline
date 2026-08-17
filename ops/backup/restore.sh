#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "用法: CONFIRM_RESTORE=YES ./ops/backup/restore.sh backups/备份文件.sql.gz"
  exit 2
fi

if [ "${CONFIRM_RESTORE:-}" != "YES" ]; then
  echo "恢复会覆盖同名表中的现有数据。确认后设置 CONFIRM_RESTORE=YES。"
  exit 3
fi

backup_file="$1"
if [ ! -f "${backup_file}" ]; then
  echo "备份文件不存在: ${backup_file}"
  exit 4
fi

gzip -cd "${backup_file}" | docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot presales_pipeline'

echo "恢复完成: ${backup_file}"

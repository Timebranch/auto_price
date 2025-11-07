#!/usr/bin/env bash
set -euo pipefail

# 从备份包（tar.gz 或 .tgz）恢复本地数据：
# - 备份当前本地数据
# - 解压备份包并将其中的 server/data/quotes.db 与 server/uploads 应用到本地
# 用法：
#   ./server/scripts/restore_from_backup.sh /path/to/backup.tgz

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LOCAL_DATA="$REPO_ROOT/server/data/quotes.db"
LOCAL_UPLOADS="$REPO_ROOT/server/uploads"
LOCAL_BACKUPS="$REPO_ROOT/server/backups"

mkdir -p "$LOCAL_BACKUPS"

if [[ $# -lt 1 ]]; then
  echo "[错误] 需要一个备份包路径参数。"
  echo "示例：./server/scripts/restore_from_backup.sh $LOCAL_BACKUPS/local_pre_sync_20250101_120000.tgz"
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[错误] 备份包不存在：$BACKUP_FILE"
  exit 1
fi

timestamp() { date +"%Y%m%d_%H%M%S"; }
TS="$(timestamp)"

echo "[信息] 创建当前本地数据备份：$LOCAL_BACKUPS/local_pre_restore_$TS.tgz"
tar -czf "$LOCAL_BACKUPS/local_pre_restore_$TS.tgz" -C "$REPO_ROOT/server" data/quotes.db uploads || {
  echo "[警告] 备份失败，继续尝试恢复。"
}

TMP_DIR="$(mktemp -d)"
echo "[信息] 解压备份包到临时目录：$TMP_DIR"
tar -xzf "$BACKUP_FILE" -C "$TMP_DIR"

# 兼容不同的打包根路径，查找 data/quotes.db 与 uploads 目录
RESTORE_DATA_PATH="$(find "$TMP_DIR" -type f -path "*/server/data/quotes.db" -print -quit || true)"
RESTORE_UPLOADS_PATH="$(find "$TMP_DIR" -type d -path "*/server/uploads" -print -quit || true)"

if [[ -z "$RESTORE_DATA_PATH" || -z "$RESTORE_UPLOADS_PATH" ]]; then
  echo "[错误] 备份包内未找到预期的 server/data/quotes.db 或 server/uploads。"
  echo "请确保备份包包含这两个路径。"
  rm -rf "$TMP_DIR"
  exit 1
fi

echo "[信息] 恢复数据库：$RESTORE_DATA_PATH -> $LOCAL_DATA"
cp -f "$RESTORE_DATA_PATH" "$LOCAL_DATA"

echo "[信息] 恢复上传目录：$RESTORE_UPLOADS_PATH/ -> $LOCAL_UPLOADS/"
rsync -a --delete "$RESTORE_UPLOADS_PATH/" "$LOCAL_UPLOADS/"

rm -rf "$TMP_DIR"
echo "[完成] 已从备份包恢复本地数据。请重新启动本地服务器并验证。"
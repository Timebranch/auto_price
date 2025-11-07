#!/usr/bin/env bash
set -euo pipefail

# 本地到远程的数据推送脚本（发布用）：
# - 可选：在推送前于远程服务器上生成备份（需 REMOTE_DIR）
# - 将本地 server/data/quotes.db 与 server/uploads 推送到远程
# 使用前建议在远程进入维护或停止服务，避免写入竞争。

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LOCAL_DATA="$REPO_ROOT/server/data/quotes.db"
LOCAL_UPLOADS="$REPO_ROOT/server/uploads"

REMOTE_HOST=${REMOTE_HOST:-}
REMOTE_USER=${REMOTE_USER:-}
REMOTE_DIR=${REMOTE_DIR:-}
REMOTE_DATA_PATH=${REMOTE_DATA_PATH:-}
REMOTE_UPLOADS_PATH=${REMOTE_UPLOADS_PATH:-}
REMOTE_BACKUP_BEFORE_PUSH=${REMOTE_BACKUP_BEFORE_PUSH:-"1"}

if [[ -z "$REMOTE_HOST" || -z "$REMOTE_USER" ]]; then
  echo "[错误] 需要设置 REMOTE_HOST 与 REMOTE_USER 环境变量。"
  echo "示例：REMOTE_HOST=server.example.com REMOTE_USER=deploy ./server/scripts/push_local_data.sh"
  exit 1
fi

if [[ -n "$REMOTE_DIR" ]]; then
  REMOTE_DATA_PATH=${REMOTE_DATA_PATH:-"$REMOTE_DIR/server/data/quotes.db"}
  REMOTE_UPLOADS_PATH=${REMOTE_UPLOADS_PATH:-"$REMOTE_DIR/server/uploads"}
fi

if [[ -z "$REMOTE_DATA_PATH" || -z "$REMOTE_UPLOADS_PATH" ]]; then
  echo "[错误] 未提供远程数据路径。请设置 REMOTE_DIR，或分别设置 REMOTE_DATA_PATH 与 REMOTE_UPLOADS_PATH。"
  exit 1
fi

timestamp() { date +"%Y%m%d_%H%M%S"; }
TS="$(timestamp)"

if [[ "$REMOTE_BACKUP_BEFORE_PUSH" == "1" && -n "$REMOTE_DIR" ]]; then
  echo "[信息] 推送前在远程创建备份：$REMOTE_DIR/server/backups/remote_pre_push_$TS.tgz"
  ssh "$REMOTE_USER@$REMOTE_HOST" "mkdir -p '$REMOTE_DIR/server/backups' && tar -czf '$REMOTE_DIR/server/backups/remote_pre_push_$TS.tgz' -C '$REMOTE_DIR/server' data/quotes.db uploads" || {
    echo "[警告] 远程备份失败，继续尝试推送。"
  }
fi

echo "[信息] 推送本地数据库到远程：$LOCAL_DATA -> $REMOTE_USER@$REMOTE_HOST:$REMOTE_DATA_PATH"
rsync -avz --progress "$LOCAL_DATA" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DATA_PATH"

echo "[信息] 推送本地上传目录到远程：$LOCAL_UPLOADS/ -> $REMOTE_USER@$REMOTE_HOST:$REMOTE_UPLOADS_PATH/"
rsync -avz --delete --progress "$LOCAL_UPLOADS/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_UPLOADS_PATH/"

echo "[完成] 已将本地数据推送到远程。请在远程重启服务并验证。"
#!/usr/bin/env bash
set -euo pipefail

# 远程到本地的数据同步脚本：
# - 从远程服务器拉取数据库文件和上传目录
# - 在同步前自动备份本地现有数据到 server/backups
# 使用前请先停止本地服务器（例如：npm run dev 在 server 目录）以避免数据库文件被占用。

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

LOCAL_DATA="$REPO_ROOT/server/data/quotes.db"
LOCAL_UPLOADS="$REPO_ROOT/server/uploads"
LOCAL_BACKUPS="$REPO_ROOT/server/backups"

mkdir -p "$LOCAL_BACKUPS"

# 必填环境变量：REMOTE_HOST, REMOTE_USER；
# 可选：REMOTE_DIR（远程仓库根目录），或明确指定 REMOTE_DATA_PATH / REMOTE_UPLOADS_PATH。
# 可选：REMOTE_PORT（默认22）、SSH_PASSWORD（如使用密码登录时）

REMOTE_HOST=${REMOTE_HOST:-}
REMOTE_USER=${REMOTE_USER:-}
REMOTE_DIR=${REMOTE_DIR:-}
REMOTE_DATA_PATH=${REMOTE_DATA_PATH:-}
REMOTE_UPLOADS_PATH=${REMOTE_UPLOADS_PATH:-}
REMOTE_PORT=${REMOTE_PORT:-22}
SSH_PASSWORD=${SSH_PASSWORD:-}

if [[ -z "$REMOTE_HOST" || -z "$REMOTE_USER" ]]; then
  echo "[错误] 需要设置 REMOTE_HOST 与 REMOTE_USER 环境变量。"
  echo "示例：REMOTE_HOST=server.example.com REMOTE_USER=deploy ./server/scripts/sync_remote_data.sh"
  exit 1
fi

if [[ -n "$REMOTE_DIR" ]]; then
  # 基于远程目录推导默认路径
  REMOTE_DATA_PATH=${REMOTE_DATA_PATH:-"$REMOTE_DIR/server/data/quotes.db"}
  REMOTE_UPLOADS_PATH=${REMOTE_UPLOADS_PATH:-"$REMOTE_DIR/server/uploads"}
fi

if [[ -z "$REMOTE_DATA_PATH" || -z "$REMOTE_UPLOADS_PATH" ]]; then
  echo "[错误] 未提供远程数据路径。请设置 REMOTE_DIR，或分别设置 REMOTE_DATA_PATH 与 REMOTE_UPLOADS_PATH。"
  exit 1
fi

has_sshpass() {
  command -v sshpass >/dev/null 2>&1 || [[ -x "/opt/homebrew/bin/sshpass" ]]
}

timestamp() { date +"%Y%m%d_%H%M%S"; }
TS="$(timestamp)"

echo "[信息] 创建本地备份：$LOCAL_BACKUPS/local_pre_sync_$TS.tgz"
tar -czf "$LOCAL_BACKUPS/local_pre_sync_$TS.tgz" -C "$REPO_ROOT/server" data/quotes.db uploads || {
  echo "[警告] 备份时出现问题，但继续尝试同步。"
}

echo "[信息] 从远程同步数据库：$REMOTE_USER@$REMOTE_HOST:$REMOTE_DATA_PATH -> $LOCAL_DATA"
if [[ -n "$SSH_PASSWORD" ]] && has_sshpass; then
  SSHPASS_BIN=$(command -v sshpass || echo "/opt/homebrew/bin/sshpass")
  "$SSHPASS_BIN" -p "$SSH_PASSWORD" rsync -avz -e "ssh -p $REMOTE_PORT -o StrictHostKeyChecking=no" --progress "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DATA_PATH" "$LOCAL_DATA"
else
  rsync -avz -e "ssh -p $REMOTE_PORT -o StrictHostKeyChecking=no" --progress "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DATA_PATH" "$LOCAL_DATA"
fi

echo "[信息] 从远程同步上传目录：$REMOTE_USER@$REMOTE_HOST:$REMOTE_UPLOADS_PATH/ -> $LOCAL_UPLOADS/"
if [[ -n "$SSH_PASSWORD" ]] && has_sshpass; then
  SSHPASS_BIN=$(command -v sshpass || echo "/opt/homebrew/bin/sshpass")
  "$SSHPASS_BIN" -p "$SSH_PASSWORD" rsync -avz -e "ssh -p $REMOTE_PORT -o StrictHostKeyChecking=no" --delete --progress "$REMOTE_USER@$REMOTE_HOST:$REMOTE_UPLOADS_PATH/" "$LOCAL_UPLOADS/"
else
  rsync -avz -e "ssh -p $REMOTE_PORT -o StrictHostKeyChecking=no" --delete --progress "$REMOTE_USER@$REMOTE_HOST:$REMOTE_UPLOADS_PATH/" "$LOCAL_UPLOADS/"
fi

echo "[完成] 远程数据已同步到本地。请重新启动本地服务器并验证功能。"
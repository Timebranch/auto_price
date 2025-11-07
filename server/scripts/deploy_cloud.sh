#!/usr/bin/env bash
set -euo pipefail

# 一键部署脚本：将本地构建产物与后端服务部署到远端云服务器（阿里云ECS）
# 依赖：ssh/scp，远端需可通过 SSH 登录；可选依赖：sshpass（如使用密码自动化）
# 使用：
#   bash server/scripts/deploy_cloud.sh -e server/scripts/deploy.env.local
#   或通过环境变量直接传入（见 deploy.env.example）。

ENV_FILE=""
while getopts ":e:" opt; do
  case $opt in
    e) ENV_FILE="$OPTARG" ;;
    *) echo "用法: $0 -e <env_file>" && exit 1 ;;
  esac
done

if [[ -n "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

# 读取变量（如未定义则赋默认值）
REMOTE_HOST=${REMOTE_HOST:-""}
REMOTE_USER=${REMOTE_USER:-"root"}
REMOTE_PORT=${REMOTE_PORT:-"22"}
SSH_PASSWORD=${SSH_PASSWORD:-""}
DOMAIN=${DOMAIN:-""}
API_PORT=${API_PORT:-"3001"}
USE_HTTPS=${USE_HTTPS:-"false"}
SETUP_FIREWALL=${SETUP_FIREWALL:-"true"}
# 默认不覆盖远端数据，保护线上数据
COPY_UPLOADS=${COPY_UPLOADS:-"false"}
COPY_DB=${COPY_DB:-"false"}
# 部署前是否对远端现有数据做备份，并可选择拉回本地
BACKUP_REMOTE=${BACKUP_REMOTE:-"true"}
DOWNLOAD_REMOTE_BACKUP=${DOWNLOAD_REMOTE_BACKUP:-"true"}

if [[ -z "$REMOTE_HOST" ]]; then
  echo "错误：必须设置 REMOTE_HOST" && exit 1
fi

PROJECT_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CLIENT_DIR="$PROJECT_ROOT/client"
SERVER_DIR="$PROJECT_ROOT/server"
TMP_DIR="/tmp/auto_price_deploy_$(date +%s)"
mkdir -p "$TMP_DIR"

function has_sshpass() {
  command -v sshpass >/dev/null 2>&1 || [[ -x "/opt/homebrew/bin/sshpass" ]]
}

function run_remote() {
  local cmd="$1"
  if [[ -n "$SSH_PASSWORD" ]] && has_sshpass; then
    local SSHPASS_BIN
    SSHPASS_BIN=$(command -v sshpass || echo "/opt/homebrew/bin/sshpass")
    "$SSHPASS_BIN" -p "$SSH_PASSWORD" ssh -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "$cmd"
  else
    ssh -p "$REMOTE_PORT" -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "$cmd"
  fi
}

function copy_to_remote() {
  local src="$1" dest="$2"
  if [[ -n "$SSH_PASSWORD" ]] && has_sshpass; then
    local SSHPASS_BIN
    SSHPASS_BIN=$(command -v sshpass || echo "/opt/homebrew/bin/sshpass")
    "$SSHPASS_BIN" -p "$SSH_PASSWORD" scp -P "$REMOTE_PORT" -o StrictHostKeyChecking=no "$src" "$REMOTE_USER@$REMOTE_HOST:$dest"
  else
    scp -P "$REMOTE_PORT" -o StrictHostKeyChecking=no "$src" "$REMOTE_USER@$REMOTE_HOST:$dest"
  fi
}

echo "==> 构建前端（注入 API Base）"
PUBLIC_BASE="http://$REMOTE_HOST"
if [[ -n "$DOMAIN" ]]; then
  PUBLIC_BASE="http://$DOMAIN"
fi

pushd "$CLIENT_DIR" >/dev/null
  npm ci
  # 生产部署仅构建静态资源，跳过类型检查以避免开发态告警阻塞
  VITE_API_BASE_URL="$PUBLIC_BASE" npm run build-only
popd >/dev/null

echo "==> 构建后端"
pushd "$SERVER_DIR" >/dev/null
  npm ci
  npm run build
popd >/dev/null

if [[ "$BACKUP_REMOTE" == "true" ]]; then
  echo "==> 远端数据备份（server/data 与 server/uploads）"
  BACKUP_TS=$(date +%Y%m%d_%H%M%S)
  REMOTE_BACKUP_PATH="~/auto_price_backup_${BACKUP_TS}.tgz"
  run_remote "sudo bash -lc 'mkdir -p /srv/auto_price/server && tar -czf ${REMOTE_BACKUP_PATH} -C /srv/auto_price server/data server/uploads || tar -czf ${REMOTE_BACKUP_PATH} -C /srv/auto_price server/data'" || true
  echo "远端备份包：${REMOTE_BACKUP_PATH}"
  if [[ "$DOWNLOAD_REMOTE_BACKUP" == "true" ]]; then
    echo "==> 下载远端备份到本地 server/backups"
    mkdir -p "$SERVER_DIR/server/backups" || true
    copy_to_remote "${REMOTE_BACKUP_PATH}" "$PROJECT_ROOT/server/backups/" || echo "[警告] 远端备份拉取失败，可手动通过 scp 下载 ${REMOTE_BACKUP_PATH}"
  fi
fi

echo "==> 打包本地产物"
# 前端静态资源
tar -C "$CLIENT_DIR" -czf "$TMP_DIR/client_dist.tar.gz" dist
# 后端编译产物与锁文件
tar -C "$SERVER_DIR" -czf "$TMP_DIR/server_app.tar.gz" dist package.json package-lock.json
# 服务器静态上传资源（logo/签章等）
if [[ "$COPY_UPLOADS" == "true" ]]; then
  tar -C "$SERVER_DIR" -czf "$TMP_DIR/server_uploads.tar.gz" uploads
fi
# 数据库
if [[ "$COPY_DB" == "true" ]]; then
  tar -C "$SERVER_DIR" -czf "$TMP_DIR/server_data.tar.gz" data
fi
# 模板文件（用于生成PDF的HTML模板）
tar -C "$SERVER_DIR" -czf "$TMP_DIR/server_templates.tar.gz" src/templates

echo "==> 远端准备目录"
run_remote "mkdir -p ~/auto_price_deploy"

echo "==> 传输文件到远端"
copy_to_remote "$TMP_DIR/client_dist.tar.gz" "~/auto_price_deploy/"
copy_to_remote "$TMP_DIR/server_app.tar.gz" "~/auto_price_deploy/"
copy_to_remote "$TMP_DIR/server_templates.tar.gz" "~/auto_price_deploy/"
if [[ -f "$TMP_DIR/server_uploads.tar.gz" ]]; then
  copy_to_remote "$TMP_DIR/server_uploads.tar.gz" "~/auto_price_deploy/"
fi
if [[ -f "$TMP_DIR/server_data.tar.gz" ]]; then
  copy_to_remote "$TMP_DIR/server_data.tar.gz" "~/auto_price_deploy/"
fi

echo "==> 安装远端基础环境（Node, Nginx, PM2）"
run_remote "sudo apt update && sudo apt install -y nginx git"
run_remote "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
run_remote "sudo npm i -g pm2"
if [[ "$SETUP_FIREWALL" == "true" ]]; then
  # 阿里云需在控制台安全组放行 80/443/22；这里可选启用UFW（视镜像而定）
  run_remote "sudo ufw allow 22 || true; sudo ufw allow 80 || true; sudo ufw allow 443 || true; sudo ufw --force enable || true"
fi
echo "==> 安装中文字体（用于 Puppeteer 正确渲染中文）"
run_remote "sudo apt update && sudo apt install -y fonts-noto-cjk fonts-wqy-microhei fonts-wqy-zenhei fontconfig || true"
run_remote "sudo fc-cache -f -v || true"
echo "==> 安装 Chromium（用于 Puppeteer 生成PDF）"
run_remote "sudo apt update && (sudo apt install -y chromium-browser || sudo apt install -y chromium || true)"

echo "==> 解压前端与后端"
run_remote "sudo mkdir -p /var/www/auto_price && sudo rm -rf /var/www/auto_price/dist && sudo tar -xzf ~/auto_price_deploy/client_dist.tar.gz -C /var/www/auto_price && sudo chown -R www-data:www-data /var/www/auto_price"
run_remote "sudo mkdir -p /srv/auto_price/server && sudo tar -xzf ~/auto_price_deploy/server_app.tar.gz -C /srv/auto_price/server"
run_remote "sudo mkdir -p /srv/auto_price/server/src && sudo tar -xzf ~/auto_price_deploy/server_templates.tar.gz -C /srv/auto_price/server"
if [[ "$COPY_UPLOADS" == "true" ]]; then
  run_remote "sudo mkdir -p /srv/auto_price/server/uploads && sudo tar -xzf ~/auto_price_deploy/server_uploads.tar.gz -C /srv/auto_price/server && (sudo chown -R www-data:www-data /srv/auto_price/server/uploads || sudo chmod -R a+r /srv/auto_price/server/uploads)"
fi
if [[ "$COPY_DB" == "true" ]]; then
  run_remote "sudo mkdir -p /srv/auto_price/server/data && sudo tar -xzf ~/auto_price_deploy/server_data.tar.gz -C /srv/auto_price/server"
fi

echo "==> 安装后端依赖并启动（跳过 Puppeteer 二进制下载）"
run_remote "cd /srv/auto_price/server && sudo -E env PUPPETEER_SKIP_DOWNLOAD=true npm ci --omit=dev"
run_remote "CHROME_BIN=\$(command -v chromium-browser || command -v chromium || echo '') ; if [ -z \"\${CHROME_BIN}\" ]; then echo '未找到Chromium，可手动安装后再设置 PUPPETEER_EXECUTABLE_PATH'; fi; PORT=$API_PORT PUPPETEER_EXECUTABLE_PATH=\"\${CHROME_BIN}\" pm2 start /srv/auto_price/server/dist/index.js --name auto_price_server || PORT=$API_PORT PUPPETEER_EXECUTABLE_PATH=\"\${CHROME_BIN}\" pm2 restart auto_price_server --update-env ; pm2 save"

echo "==> 配置 Nginx 站点"
NGINX_CONF=$(cat <<EOF
server {
    listen 80;
    server_name _;
    root /var/www/auto_price/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 反代后端 API（通过统一域名的 /api 路径访问）
    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # 静态上传资源直接由 Nginx 提供（提高性能并开启缓存）
    location /uploads/ {
        alias /srv/auto_price/server/uploads/;
        autoindex off;
        expires 7d;
        add_header Cache-Control "public, max-age=604800" always;
        add_header Cross-Origin-Resource-Policy "cross-origin" always;
    }
}
EOF
)

run_remote "echo '$NGINX_CONF' | sudo tee /etc/nginx/sites-available/auto_price >/dev/null"
run_remote "sudo ln -sf /etc/nginx/sites-available/auto_price /etc/nginx/sites-enabled/auto_price && sudo nginx -t && sudo nginx -s reload"

if [[ "$USE_HTTPS" == "true" && -n "$DOMAIN" ]]; then
  echo "==> 申请 HTTPS 证书"
  run_remote "sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN || true"
fi

PUBLIC_URL="$PUBLIC_BASE"
echo "==> 部署完成"
echo "前端：$PUBLIC_URL"
echo "后端 API：$PUBLIC_URL/api"
echo "PM2：pm2 status (在远端)"
echo "Nginx：sudo nginx -t && sudo nginx -s reload (在远端)"
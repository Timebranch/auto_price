# 数据同步与发布操作指南

本项目支持将远程服务器的完整数据同步到本地开发环境进行验证，以及在发布时将本地数据推送到远程服务器。

数据主要包含两部分：
- 数据库文件：`server/data/quotes.db`
- 上传文件：`server/uploads/`

为安全起见，所有同步与恢复脚本都会在操作前备份当前本地数据到 `server/backups/`。

## 一、远程 → 本地：替换本地为远程数据

脚本：`server/scripts/sync_remote_data.sh`

环境变量（必填）：
- `REMOTE_HOST`：远程主机域名/IP
- `REMOTE_USER`：登录远程的用户

环境变量（二选一）：
- 设置 `REMOTE_DIR` 为远程仓库的根目录（脚本将自动推导路径），例如：`/opt/auto_price`
  - 将使用：`$REMOTE_DIR/server/data/quotes.db` 与 `$REMOTE_DIR/server/uploads`
- 或者显式指定：`REMOTE_DATA_PATH` 与 `REMOTE_UPLOADS_PATH`

使用步骤：
1. 在本地停止服务器（避免数据库文件占用）：
   - 例如：在 `server` 目录运行的 `npm run dev` 停止或退出。
2. 执行同步脚本：
   ```bash
   REMOTE_HOST=server.example.com \
   REMOTE_USER=deploy \
   REMOTE_DIR=/opt/auto_price \
   ./server/scripts/sync_remote_data.sh
   ```
   或指定具体路径：
   ```bash
   REMOTE_HOST=server.example.com \
   REMOTE_USER=deploy \
   REMOTE_DATA_PATH=/opt/auto_price/server/data/quotes.db \
   REMOTE_UPLOADS_PATH=/opt/auto_price/server/uploads \
   ./server/scripts/sync_remote_data.sh
   ```
3. 重新启动本地服务并验证功能。

脚本行为：
- 自动备份本地当前数据到 `server/backups/local_pre_sync_YYYYMMDD_HHMMSS.tgz`
- 使用 `rsync` 将远程数据库与上传目录拉取到本地（`uploads` 使用 `--delete` 保持一致）

## 二、从备份包恢复本地数据

脚本：`server/scripts/restore_from_backup.sh`

用法：
```bash
./server/scripts/restore_from_backup.sh /path/to/backup.tgz
```

要求：备份包中包含 `server/data/quotes.db` 与 `server/uploads` 路径。

脚本行为：
- 自动备份当前本地数据到 `server/backups/local_pre_restore_YYYYMMDD_HHMMSS.tgz`
- 解压备份包并将数据库与上传目录恢复至本地（上传目录使用 `rsync --delete`）

## 三、本地 → 远程：发布前数据同步

脚本：`server/scripts/push_local_data.sh`

环境变量（必填）：
- `REMOTE_HOST`，`REMOTE_USER`

环境变量（二选一）：
- `REMOTE_DIR`（脚本自动推导远程路径）
- 或显式 `REMOTE_DATA_PATH` 与 `REMOTE_UPLOADS_PATH`

可选：
- `REMOTE_BACKUP_BEFORE_PUSH=1`（默认开启）：在远程推送前创建备份包到 `server/backups/remote_pre_push_*.tgz`

使用步骤（建议在远程进入维护或停机窗口）：
```bash
REMOTE_HOST=server.example.com \
REMOTE_USER=deploy \
REMOTE_DIR=/opt/auto_price \
./server/scripts/push_local_data.sh
```

脚本行为：
- 在远程（若提供 `REMOTE_DIR`）创建备份包，以防需要回滚
- 使用 `rsync` 将本地数据库与上传目录推送到远程（`uploads` 使用 `--delete`）

## 四、发布与同步注意事项

- 停机/维护：在推送到远程时，确保服务处于维护或已停止，避免写入竞争。
- 备份先行：所有脚本默认会在本地或远程进行备份，便于回滚。
- 模式兼容：如果数据库 schema 有新增字段（例如技术任务的多人字段），服务启动时会进行轻量迁移；使用远程数据后首次启动即可兼容。
- 文件一致性：`uploads` 目录包含各种上传附件与生成文件，必须与数据库同时同步保持一致。

## 五、常见示例

1）拉取远程完整数据到本地：
```bash
REMOTE_HOST=10.0.0.5 \
REMOTE_USER=ubuntu \
REMOTE_DIR=/srv/auto_price \
./server/scripts/sync_remote_data.sh
```

2）用现成备份包恢复本地：
```bash
./server/scripts/restore_from_backup.sh server/backups/delivery_note_snapshot_20251101_143300.tgz
```

3）发布前将本地数据推送到远程：
```bash
REMOTE_HOST=10.0.0.5 \
REMOTE_USER=ubuntu \
REMOTE_DIR=/srv/auto_price \
./server/scripts/push_local_data.sh
```

---

如需为远程服务器添加“只读维护模式”或通过 API 触发备份快照，我也可以继续补充相关功能（例如新增维护标志文件检测或备份路由）。

---

## 六、桌面端打包与发布（含本地数据）

目标：打一个可在 Windows 电脑上安装运行的桌面应用，内置本机后端与当前数据（`server/data/quotes.db` 与 `server/uploads`），保证离线可用。

已配置内容：
- Electron 主进程支持远端开关：`USE_REMOTE_API=true` 时不启动内置后端。
- 打包配置随包复制：`server/dist`、`server/node_modules`、`server/package.json`、`server/data`、`server/uploads`。
- Windows 目标：`nsis` 安装包。

本机（mac）快速打包 mac 应用：
- `npm run build:electron`

通过 GitHub Actions 打 Windows 包：
1. 推送代码到 GitHub 仓库（确保包含本地数据与上传目录）。
2. 在 GitHub 仓库的 Actions 页面运行工作流“Build Windows Installer”（`workflow_dispatch`）。
3. 工作流完成后，从构建产物（Artifacts）下载 `windows-dist`，其中包含 `.exe` 安装包（例如：`dist/光大协同办公-1.0.0-win-x64.exe`）。

工作流说明：`.github/workflows/build-windows.yml`
- 在 `windows-latest` 机器上安装依赖、构建后端 `server/dist` 与前端 `client/dist`。
- 自动重建 Electron 的原生依赖（例如 `sqlite3`）以匹配 Electron 运行时。
- 打包为 NSIS 安装包并上传到 Artifacts。

切换到“远端后端 + 远端数据”（未来发布正式环境时）：
- 构建前端时使用远端地址：
  - 在 Actions 触发时填写 `remote_api_base`（例如 `https://your-server:3001`），工作流会按远端地址构建前端。
- 运行时不启动内置后端：
  - 通过在运行环境设置 `USE_REMOTE_API=true`（或在包内放置 `config/app.config.json`：`{"useRemoteApi": true, "remoteApiBase": "https://your-server:3001"}`）。

常见问题：
- 若首次运行报“未知开发者”或签名问题，Windows 可选择继续安装；mac 需右键“打开”。
- 若远端模式白屏，请检查前端是否按远端地址构建，以及远端服务可达。
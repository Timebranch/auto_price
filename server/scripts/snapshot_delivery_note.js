#!/usr/bin/env node
/**
 * 创建当前发货单模板与相关资源的快照，并删除之前的发货单快照。
 * - 快照目录：server/backups/delivery_note_snapshot_<YYYYMMDD_HHMMSS>/
 * - 包含：delivery_note_template.html + 相关图片/Excel模板
 * - 生成压缩包：delivery_note_snapshot_<YYYYMMDD_HHMMSS>.tgz
 * 用法：node server/scripts/snapshot_delivery_note.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function pad(n) { return String(n).padStart(2, '0'); }
function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function copyIfExists(src, destDir) {
  if (fs.existsSync(src)) {
    const base = path.basename(src);
    fs.copyFileSync(src, path.join(destDir, base));
    return base;
  }
  return null;
}
function safeExec(cmd) { try { execSync(cmd, { stdio: 'inherit' }); } catch (e) { console.warn('命令执行失败：', cmd, e.message); } }

(function main() {
  const baseDir = path.join(__dirname, '..');
  const backupsDir = path.join(baseDir, 'backups');
  const templatesDir = path.join(baseDir, 'src', 'templates');
  const uploadsDir = path.join(baseDir, 'uploads');
  ensureDir(backupsDir);

  const ts = timestamp();
  const snapName = `delivery_note_snapshot_${ts}`;
  const snapDir = path.join(backupsDir, snapName);
  const snapTemplatesDir = path.join(snapDir, 'templates');
  const snapAssetsDir = path.join(snapDir, 'assets');

  if (fs.existsSync(snapDir)) {
    console.error('快照目录已存在，终止：', snapDir);
    process.exit(1);
  }

  ensureDir(snapDir);
  ensureDir(snapTemplatesDir);
  ensureDir(snapAssetsDir);

  // 复制模板
  const templateSrc = path.join(templatesDir, 'delivery_note_template.html');
  if (!fs.existsSync(templateSrc)) {
    console.error('找不到发货单模板文件：', templateSrc);
    process.exit(1);
  }
  fs.copyFileSync(templateSrc, path.join(snapTemplatesDir, 'delivery_note_template.html'));

  // 复制相关资源
  const assetNames = [
    'company_title.png',
    'logo_new.png',
    'logo.jpg',
    'qianzhang.png',
    'mock_full.svg',
    'mock_lower_area.svg',
    '发货单模板.xlsx'
  ];
  const copiedAssets = [];
  for (const name of assetNames) {
    const src = path.join(uploadsDir, name);
    const copied = copyIfExists(src, snapAssetsDir);
    if (copied) copiedAssets.push(copied);
  }

  // 写 README
  const readme = `# 发货单模板快照（${new Date().toISOString()}）\n\n` +
    `- 快照目录：\`${snapDir}\`\n` +
    `- 模板：\`${path.join(snapTemplatesDir, 'delivery_note_template.html')}\`\n` +
    `- 资源：\`${snapAssetsDir}\`（${copiedAssets.length ? copiedAssets.join(', ') : '无'}）\n\n` +
    `## 恢复指引\n` +
    `- 将模板覆盖到 \`${templateSrc}\`。\n` +
    `- 如需同时恢复图片/Excel资源，可将 \`${snapAssetsDir}\` 内文件复制回 \`${uploadsDir}\`。\n\n` +
    `## 保护策略\n` +
    `- 建议为快照目录设置只读及不可变标志（uchg）。\n`;
  fs.writeFileSync(path.join(snapDir, 'README.md'), readme, 'utf-8');

  // 生成压缩包
  const tarPath = path.join(backupsDir, `${snapName}.tgz`);
  safeExec(`tar -czf "${tarPath}" -C "${backupsDir}" "${snapName}"`);

  // 设置保护（尽力而为）
  try { fs.chmodSync(snapDir, 0o555); } catch {}
  safeExec(`chmod -R a-w "${snapDir}"`);
  safeExec(`chflags -R uchg "${snapDir}"`);

  // 删除之前的发货单快照（仅删除 delivery_note_snapshot_*，保留当前）
  const entries = fs.readdirSync(backupsDir, { withFileTypes: true });
  for (const e of entries) {
    const name = e.name;
    if (name.startsWith('delivery_note_snapshot_')) {
      const p = path.join(backupsDir, name);
      if (p === snapDir) continue;
      if (e.isDirectory()) {
        console.log('删除旧快照目录：', p);
        safeExec(`chflags -R nouchg "${p}"`);
        try { fs.chmodSync(p, 0o755); } catch {}
        safeExec(`chmod -R u+w "${p}"`);
        safeExec(`rm -rf "${p}"`);
      }
    }
  }
  // 删除旧的发货单快照压缩包（保留当前）
  for (const e of entries) {
    const name = e.name;
    if (name.startsWith('delivery_note_snapshot_') && name.endsWith('.tgz')) {
      const p = path.join(backupsDir, name);
      if (p === tarPath) continue;
      console.log('删除旧快照压缩包：', p);
      try { fs.unlinkSync(p); } catch {}
    }
  }

  console.log('新快照目录：', snapDir);
  console.log('新快照压缩包：', tarPath);
  console.log('包含资源：', copiedAssets.length ? copiedAssets.join(', ') : '(无)');
})();
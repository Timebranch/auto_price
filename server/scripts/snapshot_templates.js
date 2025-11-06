#!/usr/bin/env node
/**
 * 生成当前“报价单样式”的模板快照，包含模板HTML与相关图片资源，并设置只读保护。
 * 目标：便于随时恢复，且快照版本不被覆写。
 * 用法：node server/scripts/snapshot_templates.js
 */

const fs = require('fs');
const path = require('path');

function pad(n) { return String(n).padStart(2, '0'); }
function timestamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
}

function setReadonlyRecursive(targetDir) {
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  for (const e of entries) {
    const fullPath = path.join(targetDir, e.name);
    try {
      if (e.isDirectory()) {
        // 只读目录：所有人只读且可执行（进入目录）
        fs.chmodSync(fullPath, 0o555);
        setReadonlyRecursive(fullPath);
      } else if (e.isFile()) {
        // 只读文件：所有人只读
        fs.chmodSync(fullPath, 0o444);
      }
    } catch (err) {
      console.warn('设置只读失败：', fullPath, err.message);
    }
  }
  try {
    fs.chmodSync(targetDir, 0o555);
  } catch (err) {
    console.warn('设置目录只读失败：', targetDir, err.message);
  }
}

(function main() {
  const baseDir = path.join(__dirname, '..');
  const srcTemplatesDir = path.join(baseDir, 'src', 'templates');
  const uploadsDir = path.join(baseDir, 'uploads');
  const backupsDir = path.join(baseDir, 'backups');
  ensureDir(backupsDir);

  const snapName = `templates_${timestamp()}`;
  const snapDir = path.join(backupsDir, snapName);
  const snapTemplatesDir = path.join(snapDir, 'templates');
  const snapAssetsDir = path.join(snapDir, 'assets');

  // 防止误覆写：若目录已存在则立即退出
  if (fs.existsSync(snapDir)) {
    console.error('快照目录已存在，终止：', snapDir);
    process.exit(1);
  }

  ensureDir(snapDir);
  ensureDir(snapTemplatesDir);
  ensureDir(snapAssetsDir);

  // 复制所有模板HTML文件
  const templateFiles = fs.readdirSync(srcTemplatesDir).filter(f => f.endsWith('.html'));
  for (const f of templateFiles) {
    const srcPath = path.join(srcTemplatesDir, f);
    const destPath = path.join(snapTemplatesDir, f);
    copyFile(srcPath, destPath);
    // 便利访问：同时将主模板复制到快照根目录
    if (f === 'custom_template.html') {
      copyFile(srcPath, path.join(snapDir, f));
    }
  }

  // 复制相关图片资源（存在则复制）
  const assetCandidates = ['company_title.png', 'logo_new.png', 'logo.jpg', 'qianzhang.png'];
  const copiedAssets = [];
  for (const name of assetCandidates) {
    const srcPath = path.join(uploadsDir, name);
    if (fs.existsSync(srcPath)) {
      const destPath = path.join(snapAssetsDir, name);
      copyFile(srcPath, destPath);
      copiedAssets.push(name);
    }
  }

  // 写 README
  const readme = `# 模板快照说明（${new Date().toISOString()}）\n\n` +
    `- 快照目录：\`${snapDir}\`\n` +
    `- 包含模板：\`${snapTemplatesDir}\`（含所有 .html 文件；主模板同时置于快照根：\`${path.join(snapDir, 'custom_template.html')}\`）\n` +
    `- 包含资源：\`${snapAssetsDir}\`（${copiedAssets.length ? copiedAssets.join(', ') : '无'}）\n\n` +
    `## 恢复指引\n` +
    `- 将 \`${path.join(snapDir, 'custom_template.html')}\` 覆盖到 \`${path.join(srcTemplatesDir, 'custom_template.html')}\`。\n` +
    `- 如需同时恢复图片资源，可将 \`${snapAssetsDir}\` 内文件复制回 \`${uploadsDir}\`。\n\n` +
    `## 保护策略\n` +
    `- 本快照内文件与目录已设置为只读（chmod）。\n` +
    `- 建议同时对快照目录设置不可变标志（uchg），防止任何写入或删除。\n` +
    `- 若需编辑快照，请先解除不可变标志并恢复写权限后再操作。\n`;
  fs.writeFileSync(path.join(snapDir, 'README.md'), readme, 'utf-8');

  // 设置只读（chmod）
  setReadonlyRecursive(snapDir);

  console.log('模板快照已生成：', snapDir);
  console.log('模板文件：', templateFiles.join(', '));
  console.log('图片资源：', copiedAssets.length ? copiedAssets.join(', ') : '(无)');
  console.log('已设置只读（chmod），建议额外执行 chflags 来设置不可变标志。');
})();
#!/usr/bin/env node
/**
 * 仅保留最新的模板快照，并将其设置为不可变（uchg）。
 * 同时解除旧快照的不可变标志并删除它们。
 * 用法：node server/scripts/prune_snapshots.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function isSnapshotDir(name) {
  return /^templates_\d{8}_\d{6}$/.test(name);
}

function safeExec(cmd) {
  try { execSync(cmd, { stdio: 'inherit' }); } catch (e) { console.warn('命令执行失败：', cmd, e.message); }
}

(function main() {
  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    console.error('备份目录不存在：', backupsDir);
    process.exit(1);
  }

  const entries = fs.readdirSync(backupsDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .filter(isSnapshotDir)
    .sort(); // 时间戳命名，字典序即时间序

  if (entries.length === 0) {
    console.log('未找到任何模板快照。');
    return;
  }

  const latest = entries[entries.length - 1];
  const latestDir = path.join(backupsDir, latest);
  console.log('保留最新快照：', latestDir);

  // 对最新快照设置不可变标志（uchg）
  safeExec(`chflags -R uchg "${latestDir}"`);

  // 删除其他旧快照
  for (const name of entries.slice(0, -1)) {
    const dir = path.join(backupsDir, name);
    console.log('删除旧快照：', dir);
    // 解除不可变标志，恢复写权限，然后删除
    safeExec(`chflags -R nouchg "${dir}"`);
    try { fs.chmodSync(dir, 0o755); } catch {}
    safeExec(`chmod -R u+w "${dir}"`);
    safeExec(`rm -rf "${dir}"`);
  }

  console.log('已仅保留最新快照，并设置不可变。');
})();
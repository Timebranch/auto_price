#!/usr/bin/env node
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function main() {
  const dbPath = path.join(__dirname, '../data/quotes.db');
  const uploadsDir = path.join(__dirname, '../uploads');

  if (!fs.existsSync(dbPath)) {
    console.log('数据库文件不存在，无需清理:', dbPath);
    return;
  }

  const db = new sqlite3.Database(dbPath);
  const all = (sql, params=[]) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
  const run = (sql, params=[]) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
  });

  try {
    // 1) 删除已有生成的PDF文件（按记录路径）
    const rows = await all('SELECT generated_pdf_path FROM quote_records WHERE generated_pdf_path IS NOT NULL');
    let removedFiles = 0;
    for (const r of rows) {
      const p = r.generated_pdf_path;
      if (p && fs.existsSync(p)) {
        try { fs.unlinkSync(p); removedFiles++; } catch (e) { /* ignore */ }
      }
    }

    // 2) 清空记录表
    await run('DELETE FROM quote_records');
    await run('VACUUM');

    // 3) 清理 uploads 目录下残留文件（保留目录本身）
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const f of files) {
        const fp = path.join(uploadsDir, f);
        try { if (fs.statSync(fp).isFile()) fs.unlinkSync(fp); } catch (e) { /* ignore */ }
      }
    }

    console.log('清理完成: 删除记录表所有数据, 移除PDF文件数量:', removedFiles);
  } catch (e) {
    console.error('清理报价记录失败:', e);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
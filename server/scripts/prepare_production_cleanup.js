#!/usr/bin/env node
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

(async function main() {
  const root = path.join(__dirname, '..');
  const dbPath = path.join(root, 'data', 'quotes.db');
  const uploadsDir = path.join(root, 'uploads');

  if (!fs.existsSync(dbPath)) {
    console.error('数据库不存在:', dbPath);
    process.exit(1);
  }

  const db = new sqlite3.Database(dbPath);
  const all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
  const get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
  const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (err) { err ? reject(err) : resolve(this); }));

  try {
    console.log('== 生产环境清理开始 ==');

    const admin = await get(`SELECT id, username FROM users WHERE username = ?`, ['admin']);
    if (!admin?.id) {
      console.error('未找到 admin 用户，为避免破坏数据，已终止。');
      process.exit(2);
    }

    // 1) 清空报价记录，并移除关联PDF文件
    const prevQuoteCount = await get(`SELECT COUNT(*) AS c FROM quote_records`);
    const pdfRows = await all(`SELECT generated_pdf_path FROM quote_records WHERE generated_pdf_path IS NOT NULL`);
    let pdfRemoved = 0;
    for (const r of pdfRows) {
      const raw = String(r.generated_pdf_path || '');
      const candidate = path.isAbsolute(raw) ? raw : path.join(uploadsDir, path.basename(raw));
      try { if (fs.existsSync(candidate)) { fs.unlinkSync(candidate); pdfRemoved++; } } catch {}
    }
    await run(`DELETE FROM quote_records`);
    console.log(`已删除报价记录：${prevQuoteCount?.c ?? 0} 条；移除PDF：${pdfRemoved} 个`);

    // 2) 若模板表存在 created_by 列，则迁移模板归属到 admin（避免外键约束问题）
    try {
      const cols = await all(`PRAGMA table_info(quote_templates)`);
      const hasCreatedBy = Array.isArray(cols) && cols.some(c => String(c.name) === 'created_by');
      if (hasCreatedBy) {
        await run(`UPDATE quote_templates SET created_by = ? WHERE created_by != ?`, [admin.id, admin.id]);
      }
    } catch (e) {
      console.warn('检测/迁移模板归属时发生错误（忽略）：', e.message || e);
    }

    // 3) 删除非 admin 用户
    const prevUserCount = await get(`SELECT COUNT(*) AS c FROM users WHERE username != ?`, ['admin']);
    await run(`DELETE FROM users WHERE username != ?`, ['admin']);
    console.log(`已删除非管理员用户：${prevUserCount?.c ?? 0} 个`);

    // 4) 清理 uploads 目录中的临时/生成文件，仅删除 PDF 与 preview_*.html（保留 logo 与签章）
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      let removed = 0;
      for (const f of files) {
        const fp = path.join(uploadsDir, f);
        try {
          if (fs.statSync(fp).isFile()) {
            if (/\.pdf$/i.test(f) || /^preview_.*\.html$/i.test(f)) {
              fs.unlinkSync(fp);
              removed++;
            }
          }
        } catch {}
      }
      console.log(`已清理 uploads 目录中的文件：${removed} 个（保留 logo 与签章图片）`);
    }

    try { await run(`VACUUM`); } catch (e) { console.warn('VACUUM 忽略：', e.message || e); }
    console.log('== 生产环境清理完成 ==');
  } catch (e) {
    console.error('清理过程失败：', e);
    process.exit(1);
  } finally {
    db.close();
  }
})();
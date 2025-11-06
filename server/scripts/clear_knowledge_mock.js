#!/usr/bin/env node
const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const dbPath = path.join(__dirname, '..', 'data', 'quotes.db')
const db = new sqlite3.Database(dbPath)

function run() {
  db.serialize(() => {
    db.get("SELECT COUNT(*) AS cnt FROM knowledge_articles WHERE content LIKE '%系统导入的Mock内容%'", (err, row) => {
      if (err) { console.error('预检查失败:', err); return finish(1) }
      console.log('待删除 Mock 条数:', row?.cnt ?? 0)
      db.run("DELETE FROM knowledge_articles WHERE content LIKE '%系统导入的Mock内容%'", function (err) {
        if (err) { console.error('删除失败:', err); return finish(1) }
        console.log('已删除 Mock 条数:', this.changes ?? 0)
        db.get("SELECT COUNT(*) AS cnt FROM knowledge_articles WHERE content LIKE '%系统导入的Mock内容%'", (err2, row2) => {
          if (err2) { console.error('复查失败:', err2); return finish(1) }
          console.log('剩余 Mock 条数:', row2?.cnt ?? 0)
          finish(0)
        })
      })
    })
  })
}

function finish(code) {
  db.close(() => process.exit(code))
}

run()
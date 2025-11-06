import express from 'express';
import { db } from '../models/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// 允许角色：admin 与 sales（兼容后端旧角色 user 视为 sales）
function allowSalesOrAdmin(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const role = req.user?.role;
  if (role === 'admin' || role === 'sales' || role === 'user' || role === 'finance' || role === 'technician') {
    next();
    return;
  }
  res.status(403).json({ error: '无权限访问知识库' });
}

// 获取知识库列表（全部返回，前端根据角色以不同视图展示）
router.get('/', authenticateToken, allowSalesOrAdmin, (req: AuthRequest, res) => {
  db.all(
    `SELECT id, title, content, author_id, 
            strftime('%Y-%m-%d %H:%M:%S', created_at, 'localtime') AS created_at,
            strftime('%Y-%m-%d %H:%M:%S', updated_at, 'localtime') AS updated_at
     FROM knowledge_articles
     ORDER BY updated_at DESC, created_at DESC`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: '获取知识库失败' });
      }
      res.json(rows);
    }
  );
});

// 销售新增问题与初步答案（admin 也可新建）
router.post('/', authenticateToken, allowSalesOrAdmin, (req: AuthRequest, res) => {
  const { title, content } = req.body as { title?: string; content?: string };
  if (!title || !content || title.trim().length === 0 || content.trim().length === 0) {
    return res.status(400).json({ error: '标题与内容为必填项' });
  }

  const authorId = req.user?.id ?? null;
  db.run(
    `INSERT INTO knowledge_articles (title, content, author_id)
     VALUES (?, ?, ?)`,
    [title.trim(), content.trim(), authorId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '新增知识失败' });
      }
      res.status(201).json({
        message: '新增成功',
        article: { id: this.lastID, title: title.trim(), content: content.trim(), author_id: authorId }
      });
    }
  );
});

// 管理员修改问题标题与内容
router.put('/:id', authenticateToken, (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'finance') {
    return res.status(403).json({ error: '无权限修改知识库' });
  }
  const { id } = req.params;
  const { title, content } = req.body as { title?: string; content?: string };
  if (!title || !content || title.trim().length === 0 || content.trim().length === 0) {
    return res.status(400).json({ error: '标题与内容为必填项' });
  }

  db.run(
    `UPDATE knowledge_articles SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [title.trim(), content.trim(), Number(id)],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '更新知识失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '知识不存在' });
      }
      res.json({ message: '更新成功' });
    }
  );
});

// 管理员删除知识
router.delete('/:id', authenticateToken, (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'finance') {
    return res.status(403).json({ error: '无权限删除知识库' });
  }
  const { id } = req.params;
  db.run(
    `DELETE FROM knowledge_articles WHERE id = ?`,
    [Number(id)],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '删除知识失败' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '知识不存在' });
      }
      res.json({ message: '删除成功' });
    }
  );
});

// 管理员清空Mock数据（仅删除包含系统导入标记的条目）
router.delete('/mock', authenticateToken, (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'finance') {
    return res.status(403).json({ error: '无权限清空Mock数据' });
  }
  db.run(
    `DELETE FROM knowledge_articles WHERE content LIKE '%系统导入的Mock内容%'`,
    function (err) {
      if (err) {
        return res.status(500).json({ error: '清空Mock数据失败' });
      }
      res.json({ message: '已清空Mock数据', deleted: this.changes });
    }
  );
});

export default router;
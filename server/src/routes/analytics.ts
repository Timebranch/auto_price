import express from 'express';
import { db } from '../models/database';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();

// 管理员：按天统计各销售的报价单数量（可选筛选某一销售）
// Query: start=YYYY-MM-DD, end=YYYY-MM-DD, userId=number(optional)
router.get('/sales-daily', authenticateToken, requireAdmin, (req: AuthRequest, res) => {
  const { start, end, userId } = req.query as { start?: string; end?: string; userId?: string };

  // 默认时间范围：最近30天（含今天）
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const defaultEnd = toDateStr(today);
  const d30 = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  const defaultStart = toDateStr(d30);

  const startDate = (start && start.trim()) || defaultStart;
  const endDate = (end && end.trim()) || defaultEnd;

  let sql = `
    SELECT date(qr.created_at) AS day, u.id AS user_id, u.username AS username, COUNT(*) AS count
    FROM quote_records qr
    LEFT JOIN users u ON qr.user_id = u.id
    WHERE date(qr.created_at) BETWEEN ? AND ?
  `;
  const params: any[] = [startDate, endDate];

  if (userId && String(userId).trim().length > 0) {
    sql += ' AND qr.user_id = ?';
    params.push(Number(userId));
  }

  sql += ' GROUP BY day, user_id ORDER BY day ASC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '统计数据查询失败' });
    }
    // 明确禁止缓存，避免 304 造成前端 axios 拒绝响应
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({ start: startDate, end: endDate, userId: userId ? Number(userId) : undefined, data: rows });
  });
});

// 管理员：查询某销售在时间范围内的报价单列表
// Query: start=YYYY-MM-DD, end=YYYY-MM-DD, userId=number(required)
router.get('/user-quotes', authenticateToken, requireAdmin, (req: AuthRequest, res) => {
  const { start, end, userId } = req.query as { start?: string; end?: string; userId?: string };
  if (!userId) {
    return res.status(400).json({ error: '缺少必要参数 userId' });
  }

  // 默认时间范围：最近30天（含今天）
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const defaultEnd = toDateStr(today);
  const d30 = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  const defaultStart = toDateStr(d30);

  const startDate = (start && start.trim()) || defaultStart;
  const endDate = (end && end.trim()) || defaultEnd;

  const sql = `
    SELECT qr.id, qr.title, qr.status, qr.generated_pdf_path, 
           strftime('%Y-%m-%d %H:%M:%S', qr.created_at, 'localtime') AS created_at,
           u.username AS username
    FROM quote_records qr
    LEFT JOIN users u ON qr.user_id = u.id
    WHERE qr.user_id = ? AND date(qr.created_at) BETWEEN ? AND ?
    ORDER BY qr.created_at DESC
  `;

  db.all(sql, [Number(userId), startDate, endDate], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '报价单列表查询失败' });
    }
    // 明确禁止缓存，避免 304 造成前端 axios 拒绝响应
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({ start: startDate, end: endDate, userId: Number(userId), records: rows });
  });
});

export default router;
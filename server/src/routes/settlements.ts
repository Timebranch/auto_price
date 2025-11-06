import express from 'express';
import path from 'path';
import fs from 'fs';
import { db } from '../models/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { PDFGenerator } from '../utils/PDFGenerator';
import { pdfMutex } from '../utils/PdfMutex';

const router = express.Router();

// 结算单列表（仅管理员/财务），支持项目、客户、发货人搜索
router.get('/', authenticateToken, (req: AuthRequest, res: express.Response) => {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'finance') {
    return res.status(403).json({ error: '无权访问结算单列表' });
  }

  const orderName = (req.query.orderName as string) || '';
  const customerName = (req.query.customerName as string) || '';
  const shipperName = (req.query.shipperName as string) || '';

  const sql = `
    SELECT 
      id,
      delivery_id,
      order_name,
      customer_name,
      delivery_date,
      address,
      shipper_name,
      strftime('%Y-%m-%d %H:%M:%S', created_at, 'localtime') AS created_at,
      strftime('%Y-%m-%d %H:%M:%S', updated_at, 'localtime') AS updated_at
    FROM settlements
    WHERE order_name LIKE ? AND customer_name LIKE ? AND IFNULL(shipper_name, '') LIKE ?
    ORDER BY created_at DESC, updated_at DESC
  `;
  const params = [
    `%${orderName.trim()}%`,
    `%${customerName.trim()}%`,
    `%${shipperName.trim()}%`
  ];

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '获取结算单列表失败' });
    }
    res.json(rows || []);
  });
});

// 结算单详情（仅管理员/财务）
router.get('/:id', authenticateToken, (req: AuthRequest, res: express.Response) => {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'finance') {
    return res.status(403).json({ error: '无权查看结算单详情' });
  }

  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: '无效的结算单ID' });
  }

  db.get('SELECT * FROM settlements WHERE id = ?', [id], (err, row: any) => {
    if (err) {
      return res.status(500).json({ error: '查询结算单失败' });
    }
    if (!row) {
      return res.status(404).json({ error: '结算单不存在' });
    }

    let items: any[] = [];
    try { items = JSON.parse(row.items || '[]'); } catch { items = []; }

    const data = {
      id: row.id,
      delivery_id: row.delivery_id,
      order_name: row.order_name,
      customer_name: row.customer_name,
      delivery_date: row.delivery_date,
      address: row.address || '',
      shipper_name: row.shipper_name || '',
      total_price: Number(row.total_price || 0),
      items
    };
    res.json(data);
  });
});

// 创建/覆盖结算单（仅管理员/财务）
router.post('/upsert', authenticateToken, (req: AuthRequest, res: express.Response) => {
  const role = req.user?.role;
  const userId = req.user?.id;
  if (role !== 'admin' && role !== 'finance') {
    return res.status(403).json({ error: '无权生成结算单' });
  }

  const {
    delivery_id,
    order_name,
    customer_name,
    delivery_date,
    address,
    shipper_name,
    items,
    total_price
  } = req.body || {};

  if (!delivery_id || !order_name || !customer_name || !delivery_date || !Array.isArray(items)) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const itemsJson = JSON.stringify(items);

  const sql = `
    INSERT INTO settlements (delivery_id, order_name, customer_name, delivery_date, address, shipper_name, created_by, items, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(delivery_id) DO UPDATE SET
      order_name = excluded.order_name,
      customer_name = excluded.customer_name,
      delivery_date = excluded.delivery_date,
      address = excluded.address,
      shipper_name = excluded.shipper_name,
      items = excluded.items,
      total_price = excluded.total_price,
      updated_at = CURRENT_TIMESTAMP
  `;
  const params = [
    delivery_id,
    order_name,
    customer_name,
    delivery_date,
    address || null,
    shipper_name || null,
    userId,
    itemsJson,
    Number(total_price || 0)
  ];

  db.run(sql, params, function (err) {
    if (err) {
      return res.status(500).json({ error: '生成/覆盖结算单失败' });
    }
    // 返回当前记录（可能是插入也可能是更新，尝试通过 delivery_id 查询）
    db.get('SELECT id FROM settlements WHERE delivery_id = ?', [delivery_id], (getErr, row: any) => {
      if (getErr) {
        return res.status(500).json({ error: '结算单生成成功，但查询ID失败' });
      }
      res.json({ id: row?.id, message: '结算单已生成并覆盖旧记录（如存在）' });
    });
  });
});

// 下载结算单PDF（仅管理员/财务）
router.get('/:id/download', authenticateToken, (req: AuthRequest, res: express.Response) => {
  const role = req.user?.role;
  if (role !== 'admin' && role !== 'finance') {
    return res.status(403).json({ error: '无权下载结算单' });
  }

  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: '无效的结算单ID' });
  }

  db.get('SELECT * FROM settlements WHERE id = ?', [id], async (err, row: any) => {
    if (err) {
      return res.status(500).json({ error: '查询结算单失败' });
    }
    if (!row) {
      return res.status(404).json({ error: '结算单不存在' });
    }

    let release: (() => void) | null = null;
    try {
      release = await pdfMutex.acquire();

      // 读取模板（兼容 src 与 dist）
      const templateCandidates = [
        path.join(__dirname, '../templates/settlement_template.html'),
        path.join(__dirname, '../../templates/settlement_template.html')
      ];
      let templateHtml = '';
      for (const p of templateCandidates) {
        try { if (fs.existsSync(p)) { templateHtml = fs.readFileSync(p, 'utf-8'); break; } } catch {}
      }
      if (!templateHtml) {
        return res.status(500).json({ error: '未找到结算单模板文件' });
      }

      // 解析items并填充至至少12行
      let items: any[] = [];
      try { items = JSON.parse(row.items || '[]'); } catch { items = []; }
      const minRows = 12;
      const normalizeMoney = (v: unknown) => {
        const n = parseFloat(String(v ?? ''));
        return Number.isFinite(n) ? n.toFixed(2) : '0.00';
      };
      const normalizeQty = (v: unknown) => {
        const n = parseFloat(String(v ?? ''));
        return Number.isFinite(n) ? n.toFixed(2) : '';
      };
      const baseItems = Array.isArray(items) ? items.slice() : [];
      const padded = (baseItems.length < minRows)
        ? [...baseItems, ...Array.from({ length: minRows - baseItems.length }, () => ({
            product_name: '', material: '', spec: '', quantity: '', unit: '', unit_price: '', price: '', remark: ''
          }))]
        : baseItems;
      const settlement_items_padded = padded.map((it: any, idx: number) => ({
        index: idx + 1,
        product_name: String(it.product_name || ''),
        material: String(it.material || ''),
        spec: String(it.spec || ''),
        quantity: normalizeQty(it.quantity),
        unit: String(it.unit || ''),
        unit_price: normalizeMoney(it.unit_price),
        price: normalizeMoney(it.price),
        remark: String(it.remark || '')
      }));

      // /uploads 静态目录与公司logo
      const uploadsDirCandidates = [
        path.join(__dirname, '../uploads'),
        path.join(__dirname, '../../uploads'),
        path.join(process.cwd(), 'uploads')
      ];
      const uploadsDir = uploadsDirCandidates.find(p => { try { return fs.existsSync(p); } catch { return false; } }) || path.join(process.cwd(), 'uploads');
      const hostUrl = `${req.protocol}://${req.get('host')}`;
      const logoNewPath = path.join(uploadsDir, 'logo_new.png');
      const logoJpgPath = path.join(uploadsDir, 'logo.jpg');
      const companyLogoUrl = fs.existsSync(logoNewPath)
        ? `${hostUrl}/uploads/logo_new.png`
        : (fs.existsSync(logoJpgPath) ? `${hostUrl}/uploads/logo.jpg` : undefined);

      const data: any = {
        companyName: process.env.COMPANY_NAME || '天津光大钢铁有限公司',
        companyLogoUrl,
        order_name: row.order_name,
        customer_name: row.customer_name,
        delivery_date: row.delivery_date,
        address: row.address || '',
        shipper_name: row.shipper_name || '',
        settlement_items_padded,
        preferManualTotals: true,
        grandTotalRaw: parseFloat(String(row.total_price || 0)) || 0
      };

      const generator = new PDFGenerator();
      const filename = `结算单_${String(row.customer_name || '客户').replace(/\s+/g, '_')}.pdf`;
      const pdfAbsPath = await generator.generatePDF(templateHtml, data, filename);
      return res.download(pdfAbsPath, path.basename(pdfAbsPath));
    } catch (genErr) {
      console.error('生成结算单PDF失败:', genErr);
      return res.status(500).json({ error: '生成结算单PDF失败' });
    } finally {
      if (release) release();
    }
  });
});

export default router;
import express from 'express';
import path from 'path';
import fs from 'fs';
import { db } from '../models/database';
import { PDFGenerator } from '../utils/PDFGenerator'
import { pdfMutex } from '../utils/PdfMutex'
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// 列表：管理员与财务看全部，销售仅看自己创建的；支持订单名称与客户名称搜索
router.get('/', authenticateToken, (req: AuthRequest, res: express.Response) => {
  const role = req.user?.role;
  const userId = req.user?.id;

  const orderName = (req.query.orderName as string) || '';
  const customerName = (req.query.customerName as string) || '';

  const orderNameLike = `%${orderName.trim()}%`;
  const customerNameLike = `%${customerName.trim()}%`;

  const selectCols = `
    id,
    order_name,
    customer_name,
    strftime('%Y-%m-%d %H:%M:%S', delivery_time, 'localtime') AS delivery_time,
    created_by,
    file_path,
    status,
    strftime('%Y-%m-%d %H:%M:%S', created_at, 'localtime') AS created_at,
    strftime('%Y-%m-%d %H:%M:%S', updated_at, 'localtime') AS updated_at
  `;

  let sql = `SELECT ${selectCols} FROM delivery_notes WHERE order_name LIKE ? AND customer_name LIKE ?`;
  const params: any[] = [orderNameLike, customerNameLike];

  // 权限过滤
  if (role !== 'admin' && role !== 'finance') {
    sql += ' AND created_by = ?';
    params.push(userId);
  }

  sql += ' ORDER BY delivery_time DESC, created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '获取发货单列表失败' });
    }
    res.json(rows);
  });
});

// 详情：管理员与财务可查看任意；销售仅能查看自己创建的
router.get('/:id', authenticateToken, (req: AuthRequest, res: express.Response) => {
  const id = Number(req.params.id)
  const role = req.user?.role
  const userId = req.user?.id

  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: '无效的发货单ID' })
  }

  db.get('SELECT * FROM delivery_notes WHERE id = ?', [id], (err, row: any) => {
    if (err) {
      return res.status(500).json({ error: '查询发货单失败' })
    }
    if (!row) {
      return res.status(404).json({ error: '发货单不存在' })
    }

    // 权限校验
    if (role !== 'admin' && role !== 'finance' && row.created_by !== userId) {
      return res.status(403).json({ error: '无权查看该发货单' })
    }

    db.all(
      'SELECT product_name, material, spec, length, quantity, unit, unit_weight, total_weight, remark, sort_order FROM delivery_items WHERE delivery_id = ? ORDER BY sort_order ASC, id ASC',
      [id],
      (itemsErr, itemsRows) => {
        if (itemsErr) {
          return res.status(500).json({ error: '查询发货单明细失败' })
        }
        const deliveryDate = String(row.delivery_time || '').slice(0, 10)
        const data = {
          id: row.id,
          order_name: row.order_name,
          customer_name: row.customer_name,
          delivery_time: row.delivery_time,
          delivery_date: deliveryDate,
          shipper_name: row.shipper_name || '',
          shipper_phone: row.shipper_phone || '',
          address: row.address || '',
          note: row.note || '',
          created_by: row.created_by,
          status: row.status,
          items: (itemsRows || []).map((it: any, idx: number) => ({
            index: idx + 1,
            product_name: it.product_name || '',
            material: it.material || '',
            spec: it.spec || '',
            length: it.length || '',
            quantity: it.quantity ?? '',
            unit: it.unit || '',
            unit_weight: it.unit_weight || '',
            total_weight: it.total_weight || '',
            remark: it.remark || ''
          }))
        }
        res.json(data)
      }
    )
  })
})

// 下载：管理员与财务可下载任意；销售仅能下载自己创建的
router.get('/:id/download', authenticateToken, (req: AuthRequest, res: express.Response) => {
  const id = req.params.id;
  const role = req.user?.role;
  const userId = req.user?.id;

  db.get('SELECT * FROM delivery_notes WHERE id = ?', [id], (err, row: any) => {
    if (err) {
      return res.status(500).json({ error: '查询发货单失败' });
    }
    if (!row) {
      return res.status(404).json({ error: '发货单不存在' });
    }

    // 权限校验
    if (role !== 'admin' && role !== 'finance' && row.created_by !== userId) {
      return res.status(403).json({ error: '无权下载该发货单' });
    }

    const filePath = row.file_path as string | undefined;
    // 辅助函数：根据相对/绝对路径解析真实文件路径
    const resolveAbsolutePath = (fp: string) => (
      path.isAbsolute(fp)
        ? fp
        : path.join(__dirname, '../../', fp.replace(/^\/?/, ''))
    );

    // 若已有文件路径且文件存在，直接下载
    if (filePath) {
      const absolutePath = resolveAbsolutePath(filePath);
      if (fs.existsSync(absolutePath)) {
        return res.download(absolutePath, path.basename(absolutePath));
      }
    }

    // 否则：按模板即时生成PDF，保存并回填 file_path 后再下载
    const releaseOrNullPromise = pdfMutex.acquire();
    releaseOrNullPromise.then(async (release) => {
      try {
        // 读取发货单明细
        const items: any[] = await new Promise((resolveItems, rejectItems) => {
          db.all(
            'SELECT product_name, material, spec, length, quantity, unit, unit_weight, total_weight, remark, sort_order FROM delivery_items WHERE delivery_id = ? ORDER BY sort_order ASC, id ASC',
            [id],
            (itemsErr, rows) => {
              if (itemsErr) return rejectItems(itemsErr);
              resolveItems(rows || []);
            }
          );
        });

        // 选择模板路径（兼容 src 与 dist）
        const templateCandidates = [
          path.join(__dirname, '../templates/delivery_note_template.html'),
          path.join(__dirname, '../../templates/delivery_note_template.html')
        ];
        let templateHtml = '';
        for (const p of templateCandidates) {
          try {
            if (fs.existsSync(p)) { templateHtml = fs.readFileSync(p, 'utf-8'); break; }
          } catch { /* ignore */ }
        }
        if (!templateHtml) {
          return res.status(500).json({ error: '未找到发货单模板文件' });
        }

        // 注入公司logo与签章的公共URL（走 /uploads 静态目录）
        const uploadsDirCandidates = [
          path.join(__dirname, '../uploads'),
          path.join(__dirname, '../../uploads'),
          path.join(process.cwd(), 'uploads')
        ];
        const uploadsDir = uploadsDirCandidates.find(p => { try { return fs.existsSync(p); } catch { return false; } }) || path.join(process.cwd(), 'uploads');
        const hostUrl = `${req.protocol}://${req.get('host')}`;
        const logoNewPath = path.join(uploadsDir, 'logo_new.png');
        const logoJpgPath = path.join(uploadsDir, 'logo.jpg');
        const stampPath = path.join(uploadsDir, 'qianzhang.png');
        const companyLogoUrl = fs.existsSync(logoNewPath)
          ? `${hostUrl}/uploads/logo_new.png`
          : (fs.existsSync(logoJpgPath) ? `${hostUrl}/uploads/logo.jpg` : undefined);
        const stampImageUrl = fs.existsSync(stampPath) ? `${hostUrl}/uploads/qianzhang.png` : undefined;

        // 构造模板数据
        const deliveryDate = String(row.delivery_time || '').slice(0, 10);
        const data = {
          companyName: process.env.COMPANY_NAME || '天津光大钢铁有限公司',
          companyLogoUrl,
          stampImageUrl,
          order_name: row.order_name,
          customer_name: row.customer_name,
          receiver_name: row.receiver_name || '',
          receiver_phone: row.receiver_phone || '',
          address: row.address || '',
          delivery_number: String(row.id),
          delivery_date: deliveryDate,
          shipper_name: row.shipper_name || '',
          shipper_phone: row.shipper_phone || '',
          license_plate: row.license_plate || '',
          driver_name: row.driver_name || '',
          driver_phone: row.driver_phone || '',
          // 模板使用的明细键：delivery_items（含序号）
          delivery_items: items.map((it: any, idx: number) => ({
            index: idx + 1,
            product_name: it.product_name || '',
            material: it.material || '',
            spec: it.spec || '',
            length: it.length || '',
            quantity: it.quantity ?? '',
            unit: it.unit || '',
            unit_weight: it.unit_weight || '',
            total_weight: it.total_weight || '',
            remark: it.remark || ''
          }))
        };

        // 统一至少12行（不足补空行，超过不截断）供模板优先渲染
        try {
          const minRows = 12;
          const baseItems = Array.isArray((data as any).delivery_items)
            ? ((data as any).delivery_items as any[]).slice()
            : [];
          if (baseItems.length < minRows) {
            const placeholders = Array.from({ length: minRows - baseItems.length }, () => ({
              index: 0,
              product_name: '',
              material: '',
              spec: '',
              length: '',
              quantity: '',
              unit: '',
              unit_weight: '',
              total_weight: '',
              remark: ''
            }));
            (data as any).delivery_items_padded = [...baseItems, ...placeholders].map((item: any, idx: number) => ({
              ...item,
              index: idx + 1
            }));
          } else {
            (data as any).delivery_items_padded = baseItems.map((item: any, idx: number) => ({
              ...item,
              index: idx + 1
            }));
          }
        } catch {
          // 若补齐失败，不影响生成流程，模板将回退使用 delivery_items
        }

        const generator = new PDFGenerator();
        const pdfAbsPath = await generator.generatePDF(templateHtml, data, undefined);

        // 统一保存相对路径：/uploads/<filename>
        const relativePublicPath = `/uploads/${path.basename(pdfAbsPath)}`;
        await new Promise((resolveUpdate, rejectUpdate) => {
          db.run(
            'UPDATE delivery_notes SET file_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [relativePublicPath, id],
            function (updateErr) {
              if (updateErr) return rejectUpdate(updateErr);
              resolveUpdate(true);
            }
          );
        });

        return res.download(pdfAbsPath, path.basename(pdfAbsPath));
      } catch (genErr) {
        console.error('生成发货单PDF失败:', genErr);
        return res.status(500).json({ error: '生成发货单PDF失败' });
      } finally {
        if (release) release();
      }
    }).catch((_e) => {
      // 互斥锁获取失败（极少发生）：返回通用错误
      return res.status(500).json({ error: '下载服务繁忙，请稍后重试' });
    });
  });
});

// 创建发货单（草稿或生成），校验必填并写入明细
router.post('/', authenticateToken, (req: AuthRequest, res: express.Response) => {
  const userId = req.user?.id;
  const role = req.user?.role;
  if (!userId) {
    return res.status(401).json({ error: '未认证用户' });
  }

  const {
    order_name,
    customer_name,
    delivery_date, // YYYY-MM-DD（来自日期组件）
    delivery_time, // 可选：完整日期时间
    items,
    license_plate,
    driver_name,
    driver_phone,
    receiver_name,
    receiver_phone,
    shipper_name,
    shipper_phone,
    address,
    note,
    status, // 'draft' | 'generated'
  } = req.body || {};

  // 顶层必填校验
  const errs: string[] = [];
  if (!order_name) errs.push('项目名称必填');
  if (!customer_name) errs.push('客户名称必填');
  const dt = (delivery_time || (delivery_date ? `${delivery_date} 00:00:00` : '')) as string;
  if (!dt) errs.push('发货日期必填');
  if (!license_plate) errs.push('车牌号必填');
  if (!driver_name) errs.push('送货司机必填');
  if (!driver_phone) errs.push('司机电话必填');
  if (!receiver_name) errs.push('现场接货人必填');
  if (!receiver_phone) errs.push('接货人电话必填');
  if (!shipper_name) errs.push('发货人必填');
  if (!shipper_phone) errs.push('发货人电话必填');
  if (!address) errs.push('送货地址必填');

  const itemsArr = Array.isArray(items) ? items : [];
  if (itemsArr.length < 1) errs.push('至少需要一组商品条目');
  itemsArr.forEach((it: any, idx: number) => {
    if (!it?.product_name) errs.push(`第${idx + 1}行商品名称必填`);
    if (!it?.spec) errs.push(`第${idx + 1}行规格必填`);
    // 长度非必填
    if (it?.quantity == null || it?.quantity === '') errs.push(`第${idx + 1}行数量必填`);
    if (!it?.unit) errs.push(`第${idx + 1}行单位必填`);
  });

  if (errs.length > 0) {
    return res.status(400).json({ error: '参数校验失败', details: errs });
  }

  // 插入主表
  const insertSql = `
    INSERT INTO delivery_notes (
      order_name, customer_name, delivery_time, created_by, file_path,
      status, license_plate, driver_name, driver_phone,
      receiver_name, receiver_phone, shipper_name, shipper_phone,
      address, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
  const statusVal = status === 'pending_review' ? 'pending_review' : 'draft';
  db.run(
    insertSql,
    [
      order_name,
      customer_name,
      dt,
      userId,
      statusVal,
      license_plate,
      driver_name,
      driver_phone,
      receiver_name,
      receiver_phone,
      shipper_name,
      shipper_phone,
      address,
      note || null,
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '创建发货单失败' });
      }
      const deliveryId = this.lastID;
      // 插入明细
      const insertItemSql = `
        INSERT INTO delivery_items (
          delivery_id, product_name, material, spec, length, quantity, unit, unit_weight, total_weight, remark, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.serialize(() => {
        let anyErr: any = null;
        itemsArr.forEach((it: any, idx: number) => {
          db.run(
            insertItemSql,
            [
              deliveryId,
              it.product_name,
              it.material || null,
              it.spec,
              it.length || null,
              Number(it.quantity),
              it.unit,
              it.unit_weight || null,
              it.total_weight || null,
              it.remark || null,
              idx
            ],
            (e) => { if (e) anyErr = e; }
          );
        });
        if (anyErr) {
          return res.status(500).json({ error: '创建发货单明细失败' });
        }
        res.json({ id: deliveryId, status: statusVal });
      });
    }
  );
});

// 审核更新状态：仅财务可操作
router.patch('/:id/status', authenticateToken, (req: AuthRequest, res: express.Response) => {
  const role = req.user?.role
  const id = Number(req.params.id)
  const nextStatus = (req.body?.status as string) || ''
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ error: '无效的发货单ID' })
  }
  if (role !== 'finance') {
    return res.status(403).json({ error: '无权限审核发货单' })
  }
  const allowed = ['draft','pending_review','approved','rejected']
  if (!allowed.includes(nextStatus)) {
    return res.status(400).json({ error: '非法状态值' })
  }
  db.run(
    `UPDATE delivery_notes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [nextStatus, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '更新状态失败' })
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '发货单不存在' })
      }
      res.json({ id, status: nextStatus })
    }
  )
})
export default router;
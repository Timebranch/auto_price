import express from 'express';
import { QuoteController } from '../controllers/QuoteController';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = express.Router();
const quoteController = new QuoteController();

// 获取所有报价模板
router.get('/templates', authenticateToken, quoteController.getTemplates);

// 获取指定模板
router.get('/templates/:id', authenticateToken, quoteController.getTemplate);

// 创建新的报价记录
router.post('/records', authenticateToken, quoteController.createQuoteRecord);

// 获取所有报价记录
router.get('/records', authenticateToken, quoteController.getQuoteRecords);

// 获取指定报价记录
router.get('/records/:id', authenticateToken, quoteController.getQuoteRecord);

// 更新报价记录
router.put('/records/:id', authenticateToken, quoteController.updateQuoteRecord);

// 删除报价记录
router.delete('/records/:id', authenticateToken, quoteController.deleteQuoteRecord);

// 生成PDF
router.post('/records/:id/generate-pdf', authenticateToken, quoteController.generatePDF);

// 下载PDF
router.get('/records/:id/download', authenticateToken, quoteController.downloadPDF);

// 配置上传目录 server/uploads（与静态目录一致）
const uploadsDir = path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// 配置multer存储：限制为图片类型，大小不超过5MB
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext).replace(/[^\w\u4e00-\u9fa5-]+/g, '_')
    const ts = Date.now()
    cb(null, `${base}_${ts}${ext}`)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('仅支持图片文件'))
    }
    cb(null, true)
  }
})

// 上传签章图片：表单字段名为 stamp
router.post('/upload-stamp', authenticateToken, upload.single('stamp'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未接收到文件' })
    }
    const publicUrl = `/uploads/${req.file.filename}`
    const absoluteUrl = `${req.protocol}://${req.get('host')}${publicUrl}`
    res.json({ url: absoluteUrl, path: publicUrl })
  } catch (err) {
    console.error('上传签章图片失败:', err)
    res.status(500).json({ error: '上传失败' })
  }
})

// 新增：上传报价项目图片（表单字段名 itemsImage）
router.post('/upload-items-image', authenticateToken, upload.single('itemsImage'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未接收到文件' })
    }
    const publicUrl = `/uploads/${req.file.filename}`
    const absoluteUrl = `${req.protocol}://${req.get('host')}${publicUrl}`
    res.json({ url: absoluteUrl, path: publicUrl })
  } catch (err) {
    console.error('上传报价项目图片失败:', err)
    res.status(500).json({ error: '上传失败' })
  }
})

export default router;
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const QuoteController_1 = require("../controllers/QuoteController");
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = express_1.default.Router();
const quoteController = new QuoteController_1.QuoteController();
// 获取所有报价模板
router.get('/templates', auth_1.authenticateToken, quoteController.getTemplates);
// 获取指定模板
router.get('/templates/:id', auth_1.authenticateToken, quoteController.getTemplate);
// 创建新的报价记录
router.post('/records', auth_1.authenticateToken, quoteController.createQuoteRecord);
// 获取所有报价记录
router.get('/records', auth_1.authenticateToken, quoteController.getQuoteRecords);
// 获取指定报价记录
router.get('/records/:id', auth_1.authenticateToken, quoteController.getQuoteRecord);
// 更新报价记录
router.put('/records/:id', auth_1.authenticateToken, quoteController.updateQuoteRecord);
// 删除报价记录
router.delete('/records/:id', auth_1.authenticateToken, quoteController.deleteQuoteRecord);
// 生成PDF
router.post('/records/:id/generate-pdf', auth_1.authenticateToken, quoteController.generatePDF);
// 下载PDF
router.get('/records/:id/download', auth_1.authenticateToken, quoteController.downloadPDF);
// 配置上传目录 server/uploads（与静态目录一致）
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// 配置multer存储：限制为图片类型，大小不超过5MB
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const base = path_1.default.basename(file.originalname, ext).replace(/[^\w\u4e00-\u9fa5-]+/g, '_');
        const ts = Date.now();
        cb(null, `${base}_${ts}${ext}`);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('仅支持图片文件'));
        }
        cb(null, true);
    }
});
// 上传签章图片：表单字段名为 stamp
router.post('/upload-stamp', auth_1.authenticateToken, upload.single('stamp'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '未接收到文件' });
        }
        const publicUrl = `/uploads/${req.file.filename}`;
        const absoluteUrl = `${req.protocol}://${req.get('host')}${publicUrl}`;
        res.json({ url: absoluteUrl, path: publicUrl });
    }
    catch (err) {
        console.error('上传签章图片失败:', err);
        res.status(500).json({ error: '上传失败' });
    }
});
// 新增：上传报价项目图片（表单字段名 itemsImage）
router.post('/upload-items-image', auth_1.authenticateToken, upload.single('itemsImage'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '未接收到文件' });
        }
        const publicUrl = `/uploads/${req.file.filename}`;
        const absoluteUrl = `${req.protocol}://${req.get('host')}${publicUrl}`;
        res.json({ url: absoluteUrl, path: publicUrl });
    }
    catch (err) {
        console.error('上传报价项目图片失败:', err);
        res.status(500).json({ error: '上传失败' });
    }
});
exports.default = router;
//# sourceMappingURL=quotes.js.map
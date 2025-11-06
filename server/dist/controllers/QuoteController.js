"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuoteController = void 0;
const database_1 = require("../models/database");
const PDFGenerator_1 = require("../utils/PDFGenerator");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const PdfMutex_1 = require("../utils/PdfMutex");
class QuoteController {
    // 获取所有报价模板
    async getTemplates(req, res) {
        try {
            database_1.db.all('SELECT * FROM quote_templates ORDER BY created_at DESC', (err, rows) => {
                if (err) {
                    console.error('获取模板失败:', err);
                    return res.status(500).json({ error: '获取模板失败' });
                }
                res.json(rows);
            });
        }
        catch (error) {
            console.error('获取模板失败:', error);
            res.status(500).json({ error: '服务器内部错误' });
        }
    }
    // 获取指定模板
    async getTemplate(req, res) {
        try {
            const { id } = req.params;
            database_1.db.get('SELECT * FROM quote_templates WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('获取模板失败:', err);
                    return res.status(500).json({ error: '获取模板失败' });
                }
                if (!row) {
                    return res.status(404).json({ error: '模板不存在' });
                }
                res.json(row);
            });
        }
        catch (error) {
            console.error('获取模板失败:', error);
            res.status(500).json({ error: '服务器内部错误' });
        }
    }
    // 创建新的报价记录
    async createQuoteRecord(req, res) {
        try {
            const { template_id, title, form_data } = req.body;
            if (!template_id || !title || !form_data) {
                return res.status(400).json({ error: '缺少必要参数' });
            }
            // 关联当前登录用户
            const authReq = req;
            const userId = authReq.user?.id;
            if (!userId) {
                return res.status(401).json({ error: '未认证' });
            }
            const sql = `
        INSERT INTO quote_records (template_id, user_id, title, form_data, status)
        VALUES (?, ?, ?, ?, 'draft')
      `;
            // 自动填充销售代表为当前用户名（若未提供）
            const formDataObj = typeof form_data === 'string' ? JSON.parse(form_data) : form_data;
            if (!formDataObj?.salesRep && authReq.user?.username) {
                formDataObj.salesRep = authReq.user.username;
            }
            // 自动填充销售代表电话为当前用户电话（若未提供）
            if (!formDataObj?.salesRepPhone && authReq.user?.phone) {
                formDataObj.salesRepPhone = authReq.user.phone;
            }
            // 兜底公司名（用于签章上方显示）：若未提供或为空，使用环境变量或默认值
            if (!formDataObj?.companyName || String(formDataObj.companyName).trim().length === 0) {
                formDataObj.companyName = process.env.COMPANY_NAME || '天津光大钢铁有限公司';
            }
            database_1.db.run(sql, [template_id, userId, title, JSON.stringify(formDataObj)], function (err) {
                if (err) {
                    console.error('创建报价记录失败:', err);
                    return res.status(500).json({ error: '创建报价记录失败' });
                }
                // 返回新创建的记录
                database_1.db.get('SELECT * FROM quote_records WHERE id = ?', [this.lastID], (err, row) => {
                    if (err) {
                        console.error('获取新创建的记录失败:', err);
                        return res.status(500).json({ error: '获取新创建的记录失败' });
                    }
                    res.status(201).json(row);
                });
            });
        }
        catch (error) {
            console.error('创建报价记录失败:', error);
            res.status(500).json({ error: '服务器内部错误' });
        }
    }
    // 获取所有报价记录
    async getQuoteRecords(req, res) {
        try {
            const authReq = req;
            const user = authReq.user;
            let sql = `
        SELECT 
          qr.*, 
          qt.name as template_name,
          u.username as sales_username,
          u.full_name as sales_full_name,
          u.phone as sales_phone,
          strftime('%Y-%m-%d %H:%M:%S', qr.created_at, 'localtime') AS created_at_local
        FROM quote_records qr
        LEFT JOIN quote_templates qt ON qr.template_id = qt.id
        LEFT JOIN users u ON qr.user_id = u.id
      `;
            const params = [];
            // 权限：管理员查看全部，普通用户查看自己的
            if (user?.role !== 'admin' && user?.role !== 'finance') {
                sql += ' WHERE qr.user_id = ?';
                params.push(user.id);
            }
            sql += ' ORDER BY qr.created_at DESC';
            database_1.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('获取报价记录失败:', err);
                    return res.status(500).json({ error: '获取报价记录失败' });
                }
                res.json(rows);
            });
        }
        catch (error) {
            console.error('获取报价记录失败:', error);
            res.status(500).json({ error: '服务器内部错误' });
        }
    }
    // 获取指定报价记录
    async getQuoteRecord(req, res) {
        try {
            const { id } = req.params;
            const authReq = req;
            const user = authReq.user;
            const sql = `
        SELECT qr.*, qt.name as template_name, qt.template_html, qt.fields
        FROM quote_records qr
        LEFT JOIN quote_templates qt ON qr.template_id = qt.id
        WHERE qr.id = ?
      `;
            database_1.db.get(sql, [id], (err, row) => {
                if (err) {
                    console.error('获取报价记录失败:', err);
                    return res.status(500).json({ error: '获取报价记录失败' });
                }
                if (!row) {
                    return res.status(404).json({ error: '报价记录不存在' });
                }
                // 权限：非管理员只能查看自己的记录
                if (user?.role !== 'admin' && user?.role !== 'finance' && row.user_id !== user?.id) {
                    return res.status(403).json({ error: '无权访问此报价记录' });
                }
                res.json(row);
            });
        }
        catch (error) {
            console.error('获取报价记录失败:', error);
            res.status(500).json({ error: '服务器内部错误' });
        }
    }
    // 更新报价记录
    async updateQuoteRecord(req, res) {
        try {
            const { id } = req.params;
            const { title, form_data, status } = req.body;
            const sql = `
        UPDATE quote_records 
        SET title = ?, form_data = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
            database_1.db.run(sql, [title, JSON.stringify(form_data), status, id], function (err) {
                if (err) {
                    console.error('更新报价记录失败:', err);
                    return res.status(500).json({ error: '更新报价记录失败' });
                }
                if (this.changes === 0) {
                    return res.status(404).json({ error: '报价记录不存在' });
                }
                // 返回更新后的记录
                database_1.db.get('SELECT * FROM quote_records WHERE id = ?', [id], (err, row) => {
                    if (err) {
                        console.error('获取更新后的记录失败:', err);
                        return res.status(500).json({ error: '获取更新后的记录失败' });
                    }
                    res.json(row);
                });
            });
        }
        catch (error) {
            console.error('更新报价记录失败:', error);
            res.status(500).json({ error: '服务器内部错误' });
        }
    }
    // 删除报价记录
    async deleteQuoteRecord(req, res) {
        try {
            const { id } = req.params;
            // 先获取记录信息，用于删除相关文件
            database_1.db.get('SELECT * FROM quote_records WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('获取报价记录失败:', err);
                    return res.status(500).json({ error: '获取报价记录失败' });
                }
                if (!row) {
                    return res.status(404).json({ error: '报价记录不存在' });
                }
                // 删除数据库记录
                database_1.db.run('DELETE FROM quote_records WHERE id = ?', [id], function (err) {
                    if (err) {
                        console.error('删除报价记录失败:', err);
                        return res.status(500).json({ error: '删除报价记录失败' });
                    }
                    // 删除相关的PDF文件（兼容绝对路径与相对路径 /uploads/filename）
                    try {
                        const absCandidates = [];
                        if (row.generated_pdf_path) {
                            let targetPath = null;
                            const raw = String(row.generated_pdf_path);
                            if (path_1.default.isAbsolute(raw)) {
                                absCandidates.push(raw);
                            }
                            else {
                                // 相对路径或以 /uploads 开头，转换候选绝对路径
                                const basename = path_1.default.basename(raw);
                                absCandidates.push(path_1.default.join(__dirname, '../uploads', basename), path_1.default.join(__dirname, '../../uploads', basename), path_1.default.join(process.cwd(), 'uploads', basename));
                            }
                            for (const p of absCandidates) {
                                try {
                                    if (fs_1.default.existsSync(p)) {
                                        targetPath = p;
                                        break;
                                    }
                                }
                                catch { /* ignore */ }
                            }
                            if (targetPath) {
                                try {
                                    fs_1.default.unlinkSync(targetPath);
                                }
                                catch (fileErr) {
                                    console.error('删除PDF文件失败:', fileErr);
                                }
                            }
                        }
                    }
                    catch (resolveErr) {
                        console.warn('删除PDF定位文件失败（已忽略）：', resolveErr);
                    }
                    res.json({ message: '删除成功' });
                });
            });
        }
        catch (error) {
            console.error('删除报价记录失败:', error);
            res.status(500).json({ error: '服务器内部错误' });
        }
    }
    // 生成PDF
    async generatePDF(req, res) {
        try {
            const { id } = req.params;
            // 获取报价记录和模板信息
            const sql = `
        SELECT qr.*, qt.template_html
        FROM quote_records qr
        LEFT JOIN quote_templates qt ON qr.template_id = qt.id
        WHERE qr.id = ?
      `;
            database_1.db.get(sql, [id], async (err, row) => {
                if (err) {
                    console.error('获取报价记录失败:', err);
                    return res.status(500).json({ error: '获取报价记录失败' });
                }
                if (!row) {
                    return res.status(404).json({ error: '报价记录不存在' });
                }
                let release = null;
                try {
                    release = await PdfMutex_1.pdfMutex.acquire();
                    const pdfGenerator = new PDFGenerator_1.PDFGenerator();
                    const formData = JSON.parse(row.form_data);
                    // 兜底公司名：若未提供或为空，使用环境变量或默认值，确保签章上方公司名可见
                    try {
                        const defaultCompanyName = process.env.COMPANY_NAME || '天津光大钢铁有限公司';
                        if (!formData?.companyName || String(formData.companyName).trim().length === 0) {
                            formData.companyName = defaultCompanyName;
                        }
                    }
                    catch { }
                    // 注入公司标题图片与公司logo的绝对URL，供模板使用
                    try {
                        // 兼容 src 与 dist 两种运行路径，确保找到 server/uploads
                        const uploadsDirCandidates = [
                            path_1.default.join(__dirname, '../uploads'), // dist/index.ts 场景（__dirname 指向 dist）
                            path_1.default.join(__dirname, '../../uploads'), // src/controllers 场景（__dirname 指向 src/controllers）
                            path_1.default.join(process.cwd(), 'uploads') // 兜底：当前工作目录下的 uploads
                        ];
                        const uploadsDir = uploadsDirCandidates.find(p => {
                            try {
                                return fs_1.default.existsSync(p);
                            }
                            catch {
                                return false;
                            }
                        }) || path_1.default.join(process.cwd(), 'uploads');
                        const hostUrl = `${req.protocol}://${req.get('host')}`;
                        // 标题图片（优先 company_title.png，其次 logo.jpg）
                        const titlePngPath = path_1.default.join(uploadsDir, 'company_title.png');
                        const fallbackLogoPath = path_1.default.join(uploadsDir, 'logo.jpg');
                        let publicPath = null;
                        if (fs_1.default.existsSync(titlePngPath)) {
                            publicPath = '/uploads/company_title.png';
                        }
                        else if (fs_1.default.existsSync(fallbackLogoPath)) {
                            publicPath = '/uploads/logo.jpg';
                        }
                        if (publicPath) {
                            const v = Date.now();
                            formData.companyTitleImageUrl = `${hostUrl}${publicPath}?v=${v}`;
                        }
                        // 公司logo（优先使用 logo_new.png，其次 logo.jpg）
                        const logoNewPath = path_1.default.join(uploadsDir, 'logo_new.png');
                        const logoJpgPath = path_1.default.join(uploadsDir, 'logo.jpg');
                        {
                            const v = Date.now();
                            if (fs_1.default.existsSync(logoNewPath)) {
                                formData.companyLogoUrl = `${hostUrl}/uploads/logo_new.png?v=${v}`;
                            }
                            else if (fs_1.default.existsSync(logoJpgPath)) {
                                formData.companyLogoUrl = `${hostUrl}/uploads/logo.jpg?v=${v}`;
                            }
                        }
                        // 签章图片：优先内嵌 base64，避免打印引擎对外链图片的裁剪或加载问题
                        try {
                            const v = Date.now();
                            const currentStamp = formData.stampImageUrl;
                            const isDefaultPath = (url) => /\/uploads\/qianzhang\.png/.test(url || '');
                            const stampPngPath = path_1.default.join(uploadsDir, 'qianzhang.png');
                            const canInlineDefault = fs_1.default.existsSync(stampPngPath) && (!currentStamp || isDefaultPath(currentStamp));
                            if (canInlineDefault) {
                                const buf = fs_1.default.readFileSync(stampPngPath);
                                formData.stampImageUrl = `data:image/png;base64,${buf.toString('base64')}`;
                            }
                            else {
                                // 若无法内嵌，仍注入带时间戳的URL以避免缓存
                                const hostUrl2 = `${req.protocol}://${req.get('host')}`;
                                const defaultStamp = `${hostUrl2}/uploads/qianzhang.png?v=${v}`;
                                if (!currentStamp || typeof currentStamp !== 'string') {
                                    formData.stampImageUrl = defaultStamp;
                                }
                                else if (isDefaultPath(currentStamp) && !/[?&]v=/.test(currentStamp)) {
                                    formData.stampImageUrl = currentStamp + (currentStamp.includes('?') ? '&' : '?') + `v=${v}`;
                                }
                            }
                        }
                        catch (stampErr) {
                            console.warn('内嵌签章失败，使用URL策略：', stampErr);
                        }
                        // 报价项目图片：规范URL为绝对地址并追加缓存戳；启用手动总计模式
                        try {
                            const v = Date.now();
                            const rawUrl = formData.itemsImageUrl;
                            if (rawUrl && typeof rawUrl === 'string') {
                                const isData = rawUrl.startsWith('data:');
                                const isAbsolute = /^https?:\/\//i.test(rawUrl);
                                const isUploads = rawUrl.startsWith('/uploads/') || rawUrl.startsWith('uploads/');
                                let finalUrl = rawUrl;
                                if (!isData) {
                                    if (isUploads) {
                                        const basename = rawUrl.startsWith('/uploads/') ? rawUrl : `/${rawUrl}`;
                                        finalUrl = `${hostUrl}${basename}${/[?&]v=/.test(basename) ? '' : (basename.includes('?') ? '&' : '?') + 'v=' + v}`;
                                    }
                                    else if (isAbsolute) {
                                        finalUrl = /[?&]v=/.test(rawUrl) ? rawUrl : `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}v=${v}`;
                                    }
                                }
                                formData.itemsImageUrl = finalUrl;
                                formData.preferManualTotals = true;
                            }
                        }
                        catch (itemsImgErr) {
                            console.warn('处理报价项目图片URL失败：', itemsImgErr);
                        }
                    }
                    catch (e) {
                        console.warn('注入公司标题图片URL失败：', e);
                    }
                    // 优先读取最新的文件模板，如果不存在或为空则回退到数据库中的模板HTML
                    let templateHtml = row.template_html;
                    try {
                        // 兼容 src 与 dist 运行环境，构造候选路径
                        const candidatePaths = [
                            // src/controllers -> ../templates
                            path_1.default.join(__dirname, '../templates/custom_template.html'),
                            // dist/controllers -> ../../src/templates
                            path_1.default.join(__dirname, '../../src/templates/custom_template.html'),
                            // 工作目录（server）兜底
                            path_1.default.join(process.cwd(), 'src/templates/custom_template.html')
                        ];
                        let selectedPath = null;
                        for (const p of candidatePaths) {
                            try {
                                if (fs_1.default.existsSync(p)) {
                                    selectedPath = p;
                                    break;
                                }
                            }
                            catch { /* ignore */ }
                        }
                        if (selectedPath) {
                            const fileContent = fs_1.default.readFileSync(selectedPath, 'utf-8');
                            if (fileContent && fileContent.trim().length > 0) {
                                templateHtml = fileContent;
                                console.log('[QuoteController] 使用文件模板:', selectedPath, '长度:', fileContent.length);
                            }
                            else {
                                console.warn('[QuoteController] 模板文件存在但内容为空，路径:', selectedPath, '改用数据库模板');
                            }
                        }
                        else {
                            console.warn('[QuoteController] 未找到文件模板，候选路径:', candidatePaths);
                        }
                    }
                    catch (e) {
                        console.warn('[QuoteController] 读取自定义模板文件失败，改用数据库模板:', e);
                    }
                    // 文件名规则：客户公司名称_报价单创建时间（使用记录 created_at）
                    const createdAtRaw = String(row.created_at || '').trim();
                    let createdStr = '';
                    try {
                        if (createdAtRaw) {
                            // 仅保留日期部分 YYYY-MM-DD
                            const parts = createdAtRaw.split(' ');
                            const datePart = parts[0] || createdAtRaw;
                            createdStr = datePart;
                        }
                        else {
                            const d = new Date();
                            const yyyy = d.getFullYear();
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const dd = String(d.getDate()).padStart(2, '0');
                            createdStr = `${yyyy}-${mm}-${dd}`;
                        }
                    }
                    catch { /* ignore */ }
                    const companyRaw = String(formData.customerName || formData.companyName || row.title || '报价单').trim();
                    const companySafe = companyRaw
                        .replace(/[^\u4e00-\u9fa5A-Za-z0-9_\-()（）\s]/g, '')
                        .replace(/\s+/g, '_') || '报价单';
                    const rand4 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
                    const finalFilename = `${companySafe}_${createdStr}_${rand4}.pdf`;
                    const pdfAbsPath = await pdfGenerator.generatePDF(templateHtml, formData, finalFilename);
                    // 更新记录中的PDF路径
                    // 保存相对路径以避免环境变更导致绝对路径失效
                    const relativePublicPath = `/uploads/${path_1.default.basename(pdfAbsPath)}`;
                    database_1.db.run('UPDATE quote_records SET generated_pdf_path = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [relativePublicPath, 'completed', id], (updateErr) => {
                        if (updateErr) {
                            console.error('更新PDF路径失败:', updateErr);
                            return res.status(500).json({ error: '更新PDF路径失败' });
                        }
                        res.json({
                            message: 'PDF生成成功',
                            pdf_path: relativePublicPath,
                            download_url: `/api/quotes/records/${id}/download`
                        });
                    });
                }
                catch (pdfErr) {
                    console.error('生成PDF失败:', pdfErr);
                    res.status(500).json({ error: '生成PDF失败' });
                }
                finally {
                    if (release)
                        release();
                }
            });
        }
        catch (error) {
            console.error('生成PDF失败:', error);
            res.status(500).json({ error: '服务器内部错误' });
        }
    }
    // 下载PDF
    async downloadPDF(req, res) {
        try {
            const { id } = req.params;
            database_1.db.get('SELECT * FROM quote_records WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('获取报价记录失败:', err);
                    return res.status(500).json({ error: '获取报价记录失败' });
                }
                if (!row) {
                    return res.status(404).json({ error: '报价记录不存在' });
                }
                if (!row.generated_pdf_path) {
                    return res.status(404).json({ error: 'PDF文件不存在' });
                }
                // 解析绝对路径或通过 /uploads/filename 解析候选绝对路径
                const raw = String(row.generated_pdf_path);
                const absCandidates = [];
                if (path_1.default.isAbsolute(raw)) {
                    absCandidates.push(raw);
                    // 回退：若绝对路径不存在，尝试根据 basename 在 uploads 下寻找
                    const basename = path_1.default.basename(raw);
                    absCandidates.push(path_1.default.join(__dirname, '../uploads', basename), path_1.default.join(__dirname, '../../uploads', basename), path_1.default.join(process.cwd(), 'uploads', basename));
                }
                else {
                    const basename = path_1.default.basename(raw);
                    absCandidates.push(path_1.default.join(__dirname, '../uploads', basename), path_1.default.join(__dirname, '../../uploads', basename), path_1.default.join(process.cwd(), 'uploads', basename));
                }
                let targetPath = null;
                for (const p of absCandidates) {
                    try {
                        if (fs_1.default.existsSync(p)) {
                            targetPath = p;
                            break;
                        }
                    }
                    catch { /* ignore */ }
                }
                if (!targetPath) {
                    return res.status(404).json({ error: 'PDF文件不存在' });
                }
                // 为避免任何传输层问题，直接重定向到已挂载的静态资源路径 /uploads/<filename>
                const fileName = path_1.default.basename(targetPath);
                const publicPath = `/uploads/${fileName}`;
                res.redirect(publicPath);
            });
        }
        catch (error) {
            console.error('下载PDF失败:', error);
            res.status(500).json({ error: '服务器内部错误' });
        }
    }
}
exports.QuoteController = QuoteController;
//# sourceMappingURL=QuoteController.js.map
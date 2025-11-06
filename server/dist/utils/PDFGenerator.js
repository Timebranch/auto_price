"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDFGenerator = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const handlebars_1 = __importDefault(require("handlebars"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class PDFGenerator {
    constructor() {
        this.uploadsDir = path_1.default.join(__dirname, '../../uploads');
        // 确保上传目录存在
        if (!fs_1.default.existsSync(this.uploadsDir)) {
            fs_1.default.mkdirSync(this.uploadsDir, { recursive: true });
        }
    }
    async generatePDF(templateHtml, data, filename) {
        let browser;
        try {
            // 注册常用模板辅助函数
            handlebars_1.default.registerHelper('eq', function (a, b) { return a === b; });
            handlebars_1.default.registerHelper('ternary', function (cond, t, f) { return cond ? t : f; });
            // 编译Handlebars模板
            const template = handlebars_1.default.compile(templateHtml);
            // 渲染HTML前：确保表格最少行数以占满页面
            if (!data || typeof data !== 'object') {
                data = {};
            }
            const isSteelMode = Boolean(data.steelStructureMode);
            // 普通项目逻辑（非钢结构模式）
            if (!Array.isArray(data.items)) {
                data.items = [];
            }
            const minRows = 10; // 默认至少 10 行，保证底部结构贴近页面底部
            // 条件分页标记：根据原始行数决定是否在摘要前强制分页（可通过 summaryBreakThreshold 覆盖，默认 14 行）
            const originalItemsCount = Array.isArray(data.items) ? data.items.length : 0;
            const summaryBreakThresholdRaw = data.summaryBreakThreshold ?? '10';
            const summaryBreakThreshold = parseInt(String(summaryBreakThresholdRaw), 10);
            data.forceBreakBeforeSummary = Number.isFinite(summaryBreakThreshold)
                ? (originalItemsCount > summaryBreakThreshold)
                : (originalItemsCount > 14);
            // 钢结构模式：填充并格式化 steelItems，跳过普通 items 的占位与汇总
            if (isSteelMode) {
                if (!Array.isArray(data.steelItems)) {
                    data.steelItems = [];
                }
                const steelMinRows = 5;
                if (data.steelItems.length < steelMinRows) {
                    const placeholders = Array.from({ length: steelMinRows - data.steelItems.length }, () => ({
                        processItem: '',
                        processUnit: '',
                        unitPrice: '',
                        totalPrice: '',
                        remark: ''
                    }));
                    data.steelItems = [...data.steelItems, ...placeholders];
                }
                data.steelItems = data.steelItems.map((item, index) => {
                    const unitPriceNumRaw = parseFloat(String(item.unitPrice));
                    const totalPriceNumRaw = parseFloat(String(item.totalPrice));
                    const unitPriceFormatted = Number.isFinite(unitPriceNumRaw) ? unitPriceNumRaw.toFixed(2) : String(item.unitPrice || '');
                    const totalPriceFormatted = Number.isFinite(totalPriceNumRaw) ? totalPriceNumRaw.toFixed(2) : String(item.totalPrice || '');
                    return {
                        ...item,
                        index: index + 1,
                        unitPrice: unitPriceFormatted,
                        totalPrice: totalPriceFormatted
                    };
                });
            }
            else {
                // 非钢结构模式：补充占位行
                if (data.items.length < minRows) {
                    const placeholders = Array.from({ length: minRows - data.items.length }, () => ({
                        itemName: '',
                        specification: '',
                        material: '',
                        unit: '',
                        quantity: 0,
                        unitPrice: 0,
                        remark: ''
                    }));
                    data.items = [...data.items, ...placeholders];
                }
            }
            // 补充计算：序号、金额、商品合计/税额/总计（支持手动总计模式）—仅在非钢结构模式下对普通 items 生效
            if (!isSteelMode && Array.isArray(data.items)) {
                let itemsTotal = 0;
                data.items = data.items.map((item, index) => {
                    const quantityRaw = item.quantity ?? item.groupQuantity;
                    const quantityNum = parseFloat(String(quantityRaw)) || 0;
                    const unitPriceNum = parseFloat(String(item.unitPrice)) || 0;
                    const totalPriceNum = quantityNum * unitPriceNum;
                    itemsTotal += totalPriceNum;
                    return {
                        ...item,
                        index: index + 1,
                        quantity: Number.isFinite(quantityNum) ? quantityNum.toFixed(2) : '0.00',
                        unitPrice: Number.isFinite(unitPriceNum) ? unitPriceNum.toFixed(2) : '0.00',
                        totalPrice: Number.isFinite(totalPriceNum) ? totalPriceNum.toFixed(2) : '0.00'
                    };
                });
                // 税率、税额与总计计算（支持 preferManualTotals）
                const taxRatePercent = parseFloat(String(data.taxRatePercent ?? '0')) || 0;
                const preferManualTotals = Boolean(data.preferManualTotals);
                let netTotalNum;
                let taxAmountNum;
                let grandTotalNum;
                if (preferManualTotals) {
                    const grandRaw = parseFloat(String(data.grandTotalRaw ?? data.grandTotal ?? '0')) || 0;
                    if (taxRatePercent > 0) {
                        netTotalNum = grandRaw / (1 + taxRatePercent / 100);
                        taxAmountNum = grandRaw - netTotalNum;
                        grandTotalNum = grandRaw;
                    }
                    else {
                        netTotalNum = grandRaw;
                        taxAmountNum = 0;
                        grandTotalNum = grandRaw;
                    }
                }
                else {
                    netTotalNum = itemsTotal;
                    taxAmountNum = 0;
                    grandTotalNum = itemsTotal;
                    if (taxRatePercent > 0) {
                        netTotalNum = itemsTotal / (1 + taxRatePercent / 100);
                        taxAmountNum = itemsTotal - netTotalNum;
                        grandTotalNum = itemsTotal;
                    }
                }
                data.totalAmount = Number.isFinite(netTotalNum) ? netTotalNum.toFixed(2) : '0.00';
                data.taxRatePercentDisplay = `${taxRatePercent}%`;
                data.taxAmount = Number.isFinite(taxAmountNum) ? taxAmountNum.toFixed(2) : '0.00';
                data.grandTotal = Number.isFinite(grandTotalNum) ? grandTotalNum.toFixed(2) : '0.00';
                data.grandTotalUppercase = this.numberToChineseUppercase(grandTotalNum);
                data.totalAmountUppercase = data.grandTotalUppercase;
            }
            // 合成有效期字符串以适配模板 {{validityPeriod}}
            if (!data.validityPeriod) {
                const vs = data.validityStartDate;
                const ve = data.validityEndDate;
                if (vs && ve) {
                    data.validityPeriod = `${vs} 至 ${ve}`;
                }
            }
            const compiled = template(data);
            let html = compiled;
            const overrideStyles = '<style>@page { size: A4; } html, body { background: #fff !important; -webkit-print-color-adjust: exact; }</style>';
            html = html.includes('</head>') ? html.replace('</head>', `${overrideStyles}</head>`) : `${overrideStyles}${html}`;
            // 恢复原样：不进行任何比例缩放或包装
            // 启动Puppeteer（在 macOS 上对 headless 和可执行路径做兼容处理）
            const launchOptions = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--font-render-hinting=none'
                ]
            };
            // 优先使用环境变量提供的可执行路径（在 Linux 服务器上由部署脚本注入）
            if (process.env.PUPPETEER_EXECUTABLE_PATH && process.env.PUPPETEER_EXECUTABLE_PATH.trim().length > 0) {
                launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH.trim();
            }
            try {
                browser = await puppeteer_1.default.launch(launchOptions);
            }
            catch (e) {
                console.warn('默认 Chromium 启动失败，尝试使用系统 Chrome/Chromium 可执行路径...', e);
                // 在 macOS 上尝试使用系统 Chrome
                const macChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
                // 在 Linux 上尝试常见的 chromium 可执行路径
                const linuxChromiumCandidates = ['/usr/bin/chromium-browser', '/usr/bin/chromium'];
                const linuxChromium = linuxChromiumCandidates.find(p => {
                    try {
                        return fs_1.default.existsSync(p);
                    }
                    catch {
                        return false;
                    }
                });
                const fallbackPath = process.platform === 'darwin' ? macChromePath : (linuxChromium || undefined);
                if (!fallbackPath)
                    throw e;
                browser = await puppeteer_1.default.launch({
                    ...launchOptions,
                    executablePath: fallbackPath
                });
            }
            const page = await browser.newPage();
            // 设置页面内容
            await page.setContent(html, {
                waitUntil: 'networkidle2'
            });
            // 等待模板脚本准备完成（例如图片切片）
            try {
                await page.waitForFunction('window.__readyForPrint === true', { timeout: 5000 });
            }
            catch (_) {
                // 超时则直接生成PDF
            }
            // 生成PDF
            const nowDate = new Date();
            const yyyy = nowDate.getFullYear();
            const mm = String(nowDate.getMonth() + 1).padStart(2, '0');
            const dd = String(nowDate.getDate()).padStart(2, '0');
            const dateStr = `${yyyy}-${mm}-${dd}`;
            const companyRaw = String(data.customerName || data.companyName || '报价单').trim();
            const companySafe = companyRaw.replace(/[^\u4e00-\u9fa5A-Za-z0-9_\-()（）\s]/g, '').replace(/\s+/g, '_') || '报价单';
            const finalFilename = filename && filename.length ? filename : `${companySafe}_${dateStr}.pdf`;
            const pdfPath = path_1.default.join(this.uploadsDir, finalFilename);
            // 允许通过 data.pdfMargins 覆盖默认页边距（默认保持 0mm，避免影响其他文档）
            const pdfMarginsRaw = (data && data.pdfMargins) || null;
            const pdfMargins = (pdfMarginsRaw && typeof pdfMarginsRaw === 'object') ? {
                top: String(pdfMarginsRaw.top ?? '0mm'),
                right: String(pdfMarginsRaw.right ?? '0mm'),
                bottom: String(pdfMarginsRaw.bottom ?? '0mm'),
                left: String(pdfMarginsRaw.left ?? '0mm')
            } : {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm'
            };
            await page.pdf({
                path: pdfPath,
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: true,
                margin: pdfMargins
            });
            return pdfPath;
        }
        catch (error) {
            console.error('PDF生成失败:', error);
            throw new Error('PDF生成失败');
        }
        finally {
            if (browser) {
                await browser.close();
            }
        }
    }
    // 数字金额转中文大写（人民币）
    numberToChineseUppercase(n) {
        const fraction = ['角', '分'];
        const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
        const unit = [['元', '万', '亿'], ['', '拾', '佰', '仟']];
        let head = n < 0 ? '负' : '';
        n = Math.abs(n);
        let s = '';
        for (let i = 0; i < fraction.length; i++) {
            s += (digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '');
        }
        s = s || '整';
        let integer = Math.floor(n);
        for (let i = 0; i < unit[0].length && integer > 0; i++) {
            let p = '';
            for (let j = 0; j < unit[1].length && integer > 0; j++) {
                p = digit[integer % 10] + unit[1][j] + p;
                integer = Math.floor(integer / 10);
            }
            s = p.replace(/(零.)+/g, '零').replace(/零+$/, '') + unit[0][i] + s;
        }
        return head + s
            .replace(/(零元)/, '元')
            .replace(/(零.)+/g, '零')
            .replace(/^元$/, '零元');
    }
}
exports.PDFGenerator = PDFGenerator;
//# sourceMappingURL=PDFGenerator.js.map
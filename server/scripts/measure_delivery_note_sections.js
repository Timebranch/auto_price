#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const handlebars = require('handlebars');

function padItemsToMinRows(items) {
  const minRows = 14; // 统一至少14行（不足补空行，不截断）
  const baseItems = Array.isArray(items) ? items : [];
  const padded = baseItems.slice();
  for (let i = padded.length; i < minRows; i++) {
    padded.push({
      index: i + 1,
      product_name: '',
      material: '',
      spec: '',
      length: '',
      quantity: '',
      unit: '',
      unit_weight: '',
      total_weight: '',
      remark: ''
    });
  }
  return padded.map((item, idx) => ({ ...item, index: idx + 1 }));
}

(async () => {
  try {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';
    const templatePath = path.join(__dirname, '../src/templates/delivery_note_template.html');
    if (!fs.existsSync(templatePath)) throw new Error(`模板文件不存在：${templatePath}`);
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const fmtDate = `${yyyy}-${mm}-${dd}`;

    const data = {
      companyName: '天津光大钢铁有限公司',
      companyLogoUrl: `${BASE_URL}/uploads/logo_new.png?v=${Date.now()}`,
      stampImageUrl: `${BASE_URL}/uploads/qianzhang.png?v=${Date.now()}`,
      // 顶部与客户信息
      order_name: '滨海新区安置房项目三期',
      customer_name: '天津某建设发展有限公司',
      receiver_name: '张三',
      receiver_phone: '138-1234-5678',
      address: '天津市滨海新区某工业园区12-3厂房（北门卸货）',

      // 发货详情
      delivery_number: `FH-${yyyy}${mm}${dd}-001`,
      delivery_date: fmtDate,
      shipper_name: '李四',
      shipper_phone: '139-8765-4321',
      license_plate: '津A·12345',
      driver_name: '王五',
      driver_phone: '138-0000-1111',

      // 商品明细（示例）
      delivery_items: [
        { index: 1, product_name: '热轧钢板', spec: 'Q235B/6mm', length: '6m', quantity: '12.50', unit: '吨', remark: '含税出厂' },
        { index: 2, product_name: '角钢', spec: '∠50×50×5', length: '6m', quantity: '300', unit: '支', remark: '打包发货' },
        { index: 3, product_name: '槽钢', spec: '槽钢10#', length: '6m', quantity: '120', unit: '支', remark: '' },
        { index: 4, product_name: 'H型钢', spec: 'H200×200×8×12', length: '12m', quantity: '20', unit: '支', remark: '优先卸货' },
        { index: 5, product_name: '方管', spec: '100×100×3.0', length: '6m', quantity: '100', unit: '支', remark: '随车吊配合' }
      ],

      // 备注
      remarks: '注意安全，货到请第一时间联系现场接货人并当场核对数量。'
    };

    // 统一至少14行（不足补空行，不截断）
    data.delivery_items_padded = padItemsToMinRows(data.delivery_items);

    // 编译模板并注入打印覆盖样式
    const template = handlebars.compile(templateHtml);
    let html = template(data);
    const overrideStyles = '<style>@page { size: A4; } html, body { background: #fff !important; -webkit-print-color-adjust: exact; }</style>';
    html = html.includes('</head>') ? html.replace('</head>', `${overrideStyles}</head>`) : `${overrideStyles}${html}`;

    // 启动 Puppeteer，兼容本地环境
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
    if (process.env.PUPPETEER_EXECUTABLE_PATH && process.env.PUPPETEER_EXECUTABLE_PATH.trim().length > 0) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH.trim();
    }

    let browser;
    try {
      browser = await puppeteer.launch(launchOptions);
    } catch (e) {
      console.warn('默认 Chromium 启动失败，尝试使用系统 Chrome/Chromium 可执行路径...', e);
      const macChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      const linuxChromiumCandidates = ['/usr/bin/chromium-browser', '/usr/bin/chromium'];
      const linuxChromium = linuxChromiumCandidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
      const fallbackPath = process.platform === 'darwin' ? macChromePath : (linuxChromium || undefined);
      if (!fallbackPath) throw e;
      browser = await puppeteer.launch({ ...launchOptions, executablePath: fallbackPath });
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle2' });

    const results = await page.evaluate(() => {
      const pxToMm = (px) => px * 0.2645833333; // 96dpi 基准换算
      function measure(selector, contentSelectors) {
        const container = document.querySelector(selector);
        if (!container) return { found: false };
        const rect = container.getBoundingClientRect();
        const styles = getComputedStyle(container);
        const paddingTop = parseFloat(styles.paddingTop) || 0;
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;
        const marginTop = parseFloat(styles.marginTop) || 0;
        const marginBottom = parseFloat(styles.marginBottom) || 0;
        const paddingLeft = parseFloat(styles.paddingLeft) || 0;
        const paddingRight = parseFloat(styles.paddingRight) || 0;
        const marginLeft = parseFloat(styles.marginLeft) || 0;
        const marginRight = parseFloat(styles.marginRight) || 0;

        const elems = contentSelectors
          .map(sel => document.querySelector(sel))
          .filter(Boolean);
        let contentTop = Infinity;
        let contentBottom = -Infinity;
        if (elems.length === 0) {
          const children = Array.from(container.children);
          if (children.length === 0) {
            return {
              found: true,
              containerHeightPx: rect.height,
              containerHeightMm: pxToMm(rect.height),
              contentHeightPx: 0,
              contentHeightMm: 0,
              paddingTopPx: paddingTop,
              paddingBottomPx: paddingBottom,
              paddingLeftPx: paddingLeft,
              paddingRightPx: paddingRight,
              marginTopPx: marginTop,
              marginBottomPx: marginBottom,
              marginLeftPx: marginLeft,
              marginRightPx: marginRight,
            };
          }
          for (const ch of children) {
            const r = ch.getBoundingClientRect();
            contentTop = Math.min(contentTop, r.top);
            contentBottom = Math.max(contentBottom, r.bottom);
          }
        } else {
          for (const el of elems) {
            const r = el.getBoundingClientRect();
            contentTop = Math.min(contentTop, r.top);
            contentBottom = Math.max(contentBottom, r.bottom);
          }
        }
        const contentHeight = (contentBottom > contentTop) ? (contentBottom - contentTop) : container.scrollHeight;
        return {
          found: true,
          containerHeightPx: rect.height,
          containerHeightMm: pxToMm(rect.height),
          contentHeightPx: contentHeight,
          contentHeightMm: pxToMm(contentHeight),
          paddingTopPx: paddingTop,
          paddingBottomPx: paddingBottom,
          paddingLeftPx: paddingLeft,
          paddingRightPx: paddingRight,
          marginTopPx: marginTop,
          marginBottomPx: marginBottom,
          marginLeftPx: marginLeft,
          marginRightPx: marginRight,
        };
      }

      const remarks = measure('.footer .remarks-section', [
        '.footer .remarks-section h3',
        '.footer .remarks-section .remarks-validity',
        '.footer .remarks-section .remarks-list',
        '.footer .remarks-section .remarks-content'
      ]);
      const signature = measure('.footer .signature-section', [
        '.footer .signature-section .company-name',
        '.footer .signature-section .signature-stack',
        '.footer .signature-section .signature-layer',
        '.footer .signature-section .signature-date'
      ]);
      const footerGrid = measure('.footer .footer-grid', [
        '.footer .remarks-section',
        '.footer .signature-section'
      ]);
      const footer = measure('.footer', ['.footer .footer-grid']);
      return { remarks, signature, footerGrid, footer };
    });

    console.log('测量结果:', JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('测量失败:', err);
    process.exit(1);
  }
})();
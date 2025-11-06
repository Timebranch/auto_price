#!/usr/bin/env node
/**
 * 为报价记录生成模板渲染后的HTML预览，便于定位PDF空白问题。
 * 用法：node server/scripts/debugHtml.js <recordId>
 */

const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  const recordId = process.argv[2];
  if (!recordId) {
    console.error('请提供报价记录ID，例如：node server/scripts/debugHtml.js 110');
    process.exit(1);
  }

  const baseURL = process.env.BASE_URL || 'http://localhost:3001';
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  try {
    // 登录
    const loginJson = await fetchJson(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const token = loginJson?.token;
    if (!token) throw new Error('登录未返回token');

    // 获取记录（包含 form_data 与模板名）
    const recordJson = await fetchJson(`${baseURL}/api/quotes/records/${recordId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // 读取文件模板（服务端生成会优先读取该文件）
    const templateFilePath = path.join(__dirname, '../src/templates/custom_template.html');
    if (!fs.existsSync(templateFilePath)) {
      throw new Error(`模板文件不存在：${templateFilePath}`);
    }
    const templateHtml = fs.readFileSync(templateFilePath, 'utf-8');
    console.log('模板路径：', templateFilePath);
    console.log('模板长度：', templateHtml.length);
    console.log('模板前100字符：', templateHtml.slice(0, 100).replace(/\n/g, ' '));

    // 注册与服务端一致的辅助函数
    handlebars.registerHelper('eq', function(a, b) { return a === b; });
    handlebars.registerHelper('ternary', function(cond, t, f) { return cond ? t : f; });

    const formData = JSON.parse(recordJson.form_data || '{}');

    // 兜底公司名（与服务端逻辑一致），确保签章上方公司名可见
    try {
      const defaultCompanyName = process.env.COMPANY_NAME || '天津光大钢铁有限公司';
      if (!formData?.companyName || String(formData.companyName).trim().length === 0) {
        formData.companyName = defaultCompanyName;
      }
    } catch {}

    // 注入图片URL（与服务端处理一致）
    const uploadsDir = path.join(__dirname, '../uploads');
    const hostUrl = baseURL;
    const titlePngPath = path.join(uploadsDir, 'company_title.png');
    const fallbackLogoPath = path.join(uploadsDir, 'logo.jpg');
    {
      const v = Date.now();
      if (fs.existsSync(titlePngPath)) {
        formData.companyTitleImageUrl = `${hostUrl}/uploads/company_title.png?v=${v}`;
      } else if (fs.existsSync(fallbackLogoPath)) {
        formData.companyTitleImageUrl = `${hostUrl}/uploads/logo.jpg?v=${v}`;
      }
    }
    const logoNewPath = path.join(uploadsDir, 'logo_new.png');
    const logoJpgPath = path.join(uploadsDir, 'logo.jpg');
    {
      const v = Date.now();
      if (fs.existsSync(logoNewPath)) {
        formData.companyLogoUrl = `${hostUrl}/uploads/logo_new.png?v=${v}`;
      } else if (fs.existsSync(logoJpgPath)) {
        formData.companyLogoUrl = `${hostUrl}/uploads/logo.jpg?v=${v}`;
      }
    }

    // 默认注入签章URL（若未提供或为默认路径则追加时间戳），确保预览不受缓存影响
    try {
      const v = Date.now();
      const currentStamp = formData.stampImageUrl;
      const defaultStamp = `${hostUrl}/uploads/qianzhang.png?v=${v}`;
      const isDefaultPath = (url) => /\/uploads\/qianzhang\.png/.test(url || '');
      if (!currentStamp || typeof currentStamp !== 'string' || isDefaultPath(currentStamp)) {
        if (currentStamp && isDefaultPath(currentStamp) && !/[?&]v=/.test(currentStamp)) {
          formData.stampImageUrl = currentStamp + (currentStamp.includes('?') ? '&' : '?') + `v=${v}`;
        } else {
          formData.stampImageUrl = defaultStamp;
        }
      }
    } catch {}

    // 表格最少行与条件分页标记
    const minRows = 10;
    if (!Array.isArray(formData.items)) formData.items = [];
    const originalItemsCount = Array.isArray(formData.items) ? formData.items.length : 0;
    const summaryBreakThresholdRaw = formData.summaryBreakThreshold ?? '14';
    const summaryBreakThreshold = parseInt(String(summaryBreakThresholdRaw), 10);
    formData.forceBreakBeforeSummary = Number.isFinite(summaryBreakThreshold)
      ? (originalItemsCount > summaryBreakThreshold)
      : (originalItemsCount > 14);
    if (formData.items.length < minRows) {
      const padCount = minRows - formData.items.length;
      for (let i = 0; i < padCount; i++) {
        formData.items.push({ index: formData.items.length + 1, itemName: '', specification: '', material: '', quantity: '', unit: '', unitPrice: '', totalPrice: '', remark: '' });
      }
    }

    // 有效期拼接
    const vs = (formData.validityStartDate || formData.validityStart || '').trim();
    const ve = (formData.validityEndDate || formData.validityEnd || '').trim();
    if (vs && ve) formData.validityPeriod = `${vs} 至 ${ve}`;

    const template = handlebars.compile(templateHtml);
    let compiled = template(formData);
    console.log('编译后长度：', (compiled || '').length);
    const overrideStyles = '<style>@page { size: A4; } html, body { background: #fff !important; -webkit-print-color-adjust: exact; }</style>';
    compiled = compiled.includes('</head>') ? compiled.replace('</head>', `${overrideStyles}</head>`) : `${overrideStyles}${compiled}`;

    const outPath = path.join(__dirname, '../uploads', `preview_${recordId}.html`);
    fs.writeFileSync(outPath, compiled, 'utf-8');
    console.log('HTML预览已生成：', outPath);
    console.log('可在浏览器打开：', `${baseURL}/uploads/preview_${recordId}.html`);
  } catch (err) {
    console.error('生成HTML预览失败：', err?.message || err);
    process.exit(1);
  }
}

main();
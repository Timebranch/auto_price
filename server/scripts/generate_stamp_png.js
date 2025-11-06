#!/usr/bin/env node
/**
 * 生成包含公司名称文字的签章PNG图片到 server/uploads/qianzhang.png
 * 可选参数：公司名称文字（默认：天津光大钢铁有限公司 销售专用章）
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

async function main() {
  const text = process.argv[2] || '天津光大钢铁有限公司 销售专用章';
  const companyName = text.replace(/销售专用章/g, '').trim() || text;
  const sealLabel = /销售专用章/.test(text) ? '销售专用章' : '销售专用章';
  const outDir = path.join(__dirname, '../uploads');
  const outPath = path.join(outDir, 'qianzhang.png');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; background: transparent; }
      .wrap { width: 200px; height: 200px; }
      svg { width: 200px; height: 200px; display: block; }
      text { font-family: 'PingFang SC', 'Microsoft YaHei', 'SimSun', sans-serif; font-weight: 700; text-rendering: optimizeLegibility; }
    </style>
  </head>
  <body>
    <div class="wrap" id="stamp">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
          <!-- 使用path定义圆形路径，textPath可靠引用path元素；调小半径让文字在圆内 -->
          <path id="ringOuterPath" d="M 100 22 A 78 78 0 1 1 99.999 22" />
          <path id="ringInnerPath" d="M 100 36 A 64 64 0 1 1 99.999 36" />
        </defs>
        <!-- 外圈 -->
        <circle cx="100" cy="100" r="90" fill="none" stroke="#cc3d3d" stroke-width="6" />
        <!-- 五角星 -->
        <polygon points="100,60 112,95 150,95 118,115 130,150 100,130 70,150 82,115 50,95 88,95" fill="#cc3d3d" />
        <!-- 环形公司名称（更大字号，顶端居中） -->
        <text font-size="16" fill="#cc3d3d" letter-spacing="0.8px" text-anchor="middle">
          <textPath xlink:href="#ringOuterPath" href="#ringOuterPath" startOffset="0%">${companyName}</textPath>
        </text>
        <!-- 环形“销售专用章”（较小字号，底部居中） -->
        <text font-size="12" fill="#cc3d3d" text-anchor="middle">
          <textPath xlink:href="#ringInnerPath" href="#ringInnerPath" startOffset="50%">${sealLabel}</textPath>
        </text>
      </svg>
    </div>
  </body></html>`;

  // 启动 Puppeteer（尝试默认Chromium，失败则回退系统Chrome）
  const launchOptions = { headless: true, args: ['--no-sandbox', '--disable-gpu'] };
  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
  } catch (e) {
    const macChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    browser = await puppeteer.launch({ ...launchOptions, executablePath: macChromePath });
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 200, height: 200, deviceScaleFactor: 3 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const el = await page.$('#stamp');
    if (!el) throw new Error('未找到签章元素');
    await el.screenshot({ path: outPath, omitBackground: true });
    console.log('签章图片已生成：', outPath);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('生成签章失败：', e); process.exit(1); });
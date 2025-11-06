#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PDFGenerator } = require('./dist/utils/PDFGenerator');

(async () => {
  try {
    const tplPath = path.join(__dirname, 'src', 'templates', 'custom_template.html');
    const templateHtml = fs.readFileSync(tplPath, 'utf-8');
    const gen = new PDFGenerator();

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const fmtDate = `${yyyy}-${mm}-${dd}`;
    const BASE_URL = 'http://localhost:3011';

    // 通用基础字段
    const base = {
      customerName: '天津光大钢铁有限公司',
      companyName: '天津光大钢铁有限公司',
      companyLogoUrl: BASE_URL + '/uploads/logo_new.png?v=' + Date.now(),
      quoteDate: fmtDate,
      validityStartDate: fmtDate,
      validityEndDate: fmtDate,
      taxRatePercent: '13',
      salesRep: '销售一部',
      salesRepPhone: '138-0000-0000',
      companyAddress: '天津市 北辰区 小淀镇（示例）',
      stampImageUrl: BASE_URL + '/uploads/qianzhang.png?v=' + Date.now()
    };

    // 1) 普通版本
    const normalData = {
      ...base,
      quoteNumber: 'NORMAL-' + Date.now(),
      items: [
        { itemName: '热轧钢板', specification: 'Q235B', material: '钢', unit: '吨', quantity: 12.5, unitPrice: 4200, remark: '含税' },
        { itemName: '冷轧钢板', specification: 'SPCC', material: '钢', unit: '吨', quantity: 8, unitPrice: 4600, remark: '含税' },
        { itemName: '镀锌管', specification: 'DN50', material: '钢', unit: '米', quantity: 300, unitPrice: 18.5, remark: '' }
      ],
      remarksList: [
        '报价含税，运费另计（如无特殊说明）。',
        '本报价有效期：7天（以页面所示为准）。',
        '最终成交价格以双方签订的销售合同为准。'
      ]
    };

    // 2) 图片上传版本
    const imageData = {
      ...normalData,
      quoteNumber: 'IMAGE-' + Date.now(),
      itemsImageUrl: BASE_URL + '/uploads/8d773ac758ef691b93ba4482ae84c31c_1761018186803.png?v=' + Date.now(),
      imageOnlyMode: true,
      forceBreakBeforeSummary: true
    };

    // 3) 钢结构版本
    const steelItems = [
      { processItem: '焊接立柱', processUnit: '根', unitPrice: 180.00, totalPrice: 1800.00, remark: '含材料' },
      { processItem: '打磨喷漆', processUnit: '㎡', unitPrice: 25.50, totalPrice: 510.00, remark: '' },
      { processItem: '安装维护', processUnit: '项', unitPrice: 800.00, totalPrice: 1600.00, remark: '含辅材' }
    ];
    const steelGrand = steelItems.reduce((sum, i) => sum + (parseFloat(String(i.totalPrice)) || 0), 0);

    const steelData = {
      ...base,
      quoteNumber: 'STEEL-' + Date.now(),
      steelStructureMode: true,
      steelItems,
      preferManualTotals: true,
      grandTotalRaw: steelGrand,
      remarksList: [
        '钢结构工序项目为示例，最终以合同为准。',
        '报价含税，运费另计（如无特殊说明）。',
        '有效期7天，工程量变更需重新核价。'
      ]
    };

    const p1 = await gen.generatePDF(templateHtml, normalData, 'preview_normal.pdf');
    console.log('[PDF] 普通版本生成成功:', p1);

    const p2 = await gen.generatePDF(templateHtml, imageData, 'preview_with_image.pdf');
    console.log('[PDF] 图片上传版本生成成功:', p2);

    const p3 = await gen.generatePDF(templateHtml, steelData, 'preview_steel.pdf');
    console.log('[PDF] 钢结构版本生成成功:', p3);
  } catch (e) {
    console.error('生成 PDF 失败:', e);
    process.exit(1);
  }
})();
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    const { PDFGenerator } = require('../dist/utils/PDFGenerator.js');
    const generator = new PDFGenerator();

    const templatePath = path.join(__dirname, '../src/templates/custom_template.html');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    const data = {
      companyName: '天津光大钢铁有限公司',
      quoteDate: new Date().toISOString().slice(0, 10),
      remarks: '示例：不含运费校验',
      // 关键：选择“不含运费”，应显示为“不含运费”
      freightIncluded: '否',
      // 提供最小必需字段以生成页面结构
      items: [],
      taxRatePercent: '0',
      steelStructureMode: false
    };

    const filename = 'freight_no_preview.pdf';
    const savedPath = await generator.generatePDF(templateHtml, data, filename);
    console.log('生成完成:', savedPath);
  } catch (err) {
    console.error('生成示例PDF失败:', err);
    process.exit(1);
  }
})();
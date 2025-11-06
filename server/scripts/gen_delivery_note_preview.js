#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    const { PDFGenerator } = require('../dist/utils/PDFGenerator.js');
    const generator = new PDFGenerator();

    const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';
    const templatePath = path.join(__dirname, '../src/templates/delivery_note_template.html');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`模板文件不存在：${templatePath}`);
    }
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

    // 生成 20 条 mock 明细数据
    const products = ['螺纹钢','线材','钢板','方管','圆钢','H型钢','角钢','槽钢','镀锌管','不锈钢板'];
    const materials = ['HRB400E','Q235B','Q355B','304','Q195'];
    const specs = ['Φ12','Φ16','Φ20','100×100×3.0','H200×200×8×12','∠50×50×5','槽钢10#','Q235B/6mm'];
    const lengths = ['6m','9m','12m'];
    const units = ['支','件','吨'];
    data.delivery_items = Array.from({ length: 20 }, (_, i) => ({
      index: i + 1,
      product_name: products[i % products.length],
      material: materials[i % materials.length],
      spec: specs[i % specs.length],
      length: lengths[i % lengths.length],
      quantity: String(10 + i),
      unit: units[i % units.length],
      unit_weight: '',
      total_weight: '',
      remark: i % 7 === 0 ? '优先卸货' : ''
    }));

    // 固定12行（不足补空行，超过截断）
  const minRows = 12;
  const baseItems = Array.isArray(data.delivery_items) ? data.delivery_items.slice(0, minRows) : [];
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
  data.delivery_items_padded = padded.map((item, idx) => ({ ...item, index: idx + 1 }));

    const filename = 'preview_delivery_note.pdf';
    const savedPath = await generator.generatePDF(templateHtml, data, filename);
    console.log('发货单生成完成:', savedPath);

    const basename = String(savedPath).split('/').pop();
    const previewUrl = `${BASE_URL}/uploads/${basename}`;
    console.log('PREVIEW_URL:', previewUrl);
  } catch (err) {
    console.error('生成发货单预览失败:', err);
    process.exit(1);
  }
})();
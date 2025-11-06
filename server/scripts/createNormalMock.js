#!/usr/bin/env node
(async () => {
  try {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';
    const API = BASE_URL.replace(/\/$/, '') + '/api';
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

    const fmtDate = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    // 登录获取 token
    const loginRes = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
    });
    const loginJson = await loginRes.json();
    if (!loginRes.ok) throw new Error(`登录失败: ${loginRes.status} ${loginRes.statusText} ${JSON.stringify(loginJson)}`);
    const token = loginJson.token;
    const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    // 获取模板
    const tplRes = await fetch(API + '/quotes/templates', { headers: { Authorization: `Bearer ${token}` } });
    const tplJson = await tplRes.json();
    if (!tplRes.ok) throw new Error(`获取模板失败: ${tplRes.status} ${tplRes.statusText}`);
    const tplId = Array.isArray(tplJson) && tplJson.length ? tplJson[0].id : 1;

    // 创建报价记录（普通模式，items 表格）
    const today = new Date();
    const body = {
      template_id: tplId,
      title: '普通模式PDF验证',
      form_data: {
        customerName: '天津光大钢铁有限公司',
        contactPerson: '李四',
        phone: '13800000000',
        customerAddress: '天津市河东区XX路XX号',
        companyName: '天津光大钢铁有限公司',
        quoteNumber: 'NORMAL-' + Date.now(),
        quoteDate: fmtDate(today),
        validityStartDate: fmtDate(today),
        validityEndDate: fmtDate(new Date(Date.now() + 7 * 86400000)),
        items: [
          { itemName: 'H型钢', specification: '200×200×8×12', material: 'Q355B', quantity: 12, unit: '吨', unitPrice: 4980, totalPrice: 59760, remark: '-' },
          { itemName: '槽钢', specification: '20#', material: 'Q235B', quantity: 20, unit: '吨', unitPrice: 4320, totalPrice: 86400, remark: '-' },
          { itemName: '角钢', specification: 'L50×5', material: 'Q235', quantity: 8, unit: '吨', unitPrice: 4600, totalPrice: 36800, remark: '-' }
        ],
        taxRatePercent: 13,
        freightIncluded: '否',
        remarks: '本报价含税不含运费，有效期7天。',
        remarksList: [
          '本报价有效期为：' + fmtDate(today) + ' 至 ' + fmtDate(new Date(Date.now() + 7 * 86400000)),
          '最终成交价格以双方签订的正式销售合同为准。'
        ],
        stampImageUrl: BASE_URL + '/uploads/qianzhang.png?v=' + Date.now()
      }
    };

    const recRes = await fetch(API + '/quotes/records', { method: 'POST', headers: authHeaders, body: JSON.stringify(body) });
    const recJson = await recRes.json();
    if (!recRes.ok) throw new Error(`创建记录失败: ${recRes.status} ${recRes.statusText} ${JSON.stringify(recJson)}`);

    const genRes = await fetch(API + `/quotes/records/${recJson.id}/generate-pdf`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const genJson = await genRes.json();
    if (!genRes.ok) throw new Error(`生成PDF失败: ${genRes.status} ${genRes.statusText} ${JSON.stringify(genJson)}`);

    console.log('PDF生成成功, 路径:', genJson.pdf_path);
    const basename = String(genJson.pdf_path || '').split('/').pop();
    const previewUrl = `${BASE_URL}/uploads/${basename}`;
    console.log('PREVIEW_URL_NORMAL:', previewUrl);
  } catch (e) {
    console.error('普通模式生成失败:', e);
    process.exit(1);
  }
})();
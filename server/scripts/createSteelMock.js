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

    // 创建报价记录（钢结构模式）
    const today = new Date();
    const body = {
      template_id: tplId,
      title: '钢结构模式PDF验证',
      form_data: {
        customerName: '天津光大钢铁有限公司',
        contactPerson: '王五',
        phone: '13800000001',
        customerAddress: '天津市滨海新区YY路ZZ号',
        companyName: '天津光大钢铁有限公司',
        quoteNumber: 'STEEL-' + Date.now(),
        quoteDate: fmtDate(today),
        validityStartDate: fmtDate(today),
        validityEndDate: fmtDate(new Date(Date.now() + 7 * 86400000)),
        steelStructureMode: true,
        steelItems: [
          { processItem: '切割下料', processUnit: '米', unitPrice: 15.5, totalPrice: 1550, remark: '-' },
          { processItem: '打孔焊接', processUnit: '个', unitPrice: 8.0, totalPrice: '面议', remark: '-' },
          { processItem: '喷漆防锈', processUnit: '平方米', unitPrice: 22.3, totalPrice: 2230, remark: '两遍底漆一遍面漆' }
        ],
        remarksList: [
          '钢结构加工报价为含税价格，不含运费。',
          '有效期：' + fmtDate(today) + ' 至 ' + fmtDate(new Date(Date.now() + 7 * 86400000))
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
    console.log('PREVIEW_URL_STEEL:', previewUrl);
  } catch (e) {
    console.error('钢结构模式生成失败:', e);
    process.exit(1);
  }
})();
#!/usr/bin/env node
(async () => {
  try {
    const baseApi = 'http://localhost:3002/api';

    const username = 'tester_';
    const password = 'test123';
    const unique = Date.now();

    async function registerUser(u) {
      const res = await fetch(baseApi + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: u,
          password,
          fullName: 'PDF测试用户',
          email: `${u}@example.com`,
          phone: '139' + String(Date.now()).slice(-8)
        })
      });
      const json = await res.json();
      return { ok: res.ok, json };
    }

    async function loginUser(u) {
      const res = await fetch(baseApi + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password })
      });
      const json = await res.json();
      return { ok: res.ok, json };
    }

    // 优先尝试用固定用户名登录；若不存在，则注册唯一用户名
    let token = '';
    let primaryUser = username;
    let login = await loginUser(primaryUser);
    if (!login.ok) {
      // 注册唯一用户
      const regTry = await registerUser(username + unique);
      if (!regTry.ok) {
        console.error('注册失败:', regTry.json);
        process.exit(1);
      }
      console.log('注册成功:', regTry.json.user?.username);
      token = regTry.json.token;
      primaryUser = regTry.json.user?.username;
    } else {
      console.log('登录成功:', login.json.user?.username);
      token = login.json.token;
    }

    const authHeaders = { 'Authorization': 'Bearer ' + token };

    const tplRes = await fetch(baseApi + '/quotes/templates', { headers: authHeaders });
    const tplJson = await tplRes.json();
    if (!tplRes.ok) {
      console.error('获取模板失败:', tplJson);
      process.exit(1);
    }
    const tplId = Array.isArray(tplJson) && tplJson.length ? tplJson[0].id : 1;
    console.log('模板数量:', Array.isArray(tplJson) ? tplJson.length : 0, '使用模板ID:', tplId);

    const today = new Date();
    const fmtDate = (d) => d.toISOString().slice(0, 10);

    const recordBody = {
      template_id: tplId,
      title: '自动测试报价单',
      form_data: {
        customerName: '天津光大钢铁有限公司',
        projectName: '样例项目',
        quoteNumber: 'TEST-' + Date.now(),
        quoteDate: fmtDate(today),
        stampImageUrl: 'http://localhost:3002/uploads/qianzhang.png?v=' + Date.now(),
        validityStartDate: fmtDate(today),
        validityEndDate: fmtDate(new Date(Date.now() + 7 * 86400000)),
        items: [
          { itemName: '螺纹钢', specification: 'HRB400E 12mm', material: 'Q235', quantity: 10, unit: '吨', unitPrice: 5200, remark: '-' },
          { itemName: '工字钢', specification: '25#', material: 'Q235', quantity: 5, unit: '吨', unitPrice: 4800, remark: '-' },
          { itemName: '角钢', specification: 'L50×5', material: 'Q235', quantity: 8, unit: '吨', unitPrice: 4600, remark: '-' },
          { itemName: '槽钢', specification: '20#', material: 'Q235', quantity: 6, unit: '吨', unitPrice: 4700, remark: '-' },
          { itemName: '线材', specification: 'HPB300 φ8mm', material: 'HPB300', quantity: 12, unit: '吨', unitPrice: 5100, remark: '-' },
          { itemName: '钢板', specification: 'Q235 6mm', material: 'Q235', quantity: 7, unit: '吨', unitPrice: 5000, remark: '-' },
          { itemName: '冷轧板', specification: 'SPCC 1.2mm', material: 'SPCC', quantity: 9, unit: '吨', unitPrice: 5300, remark: '-' },
          { itemName: '镀锌板', specification: 'SGCC 0.8mm', material: 'SGCC', quantity: 11, unit: '吨', unitPrice: 5400, remark: '-' },
          { itemName: '圆钢', specification: '45# φ20mm', material: '45#', quantity: 4, unit: '吨', unitPrice: 5500, remark: '-' },
          { itemName: '不锈钢板', specification: '304 2.0mm', material: '304', quantity: 3, unit: '吨', unitPrice: 12000, remark: '-' }
        ],
        taxRatePercent: 13,
        remarks: '本报价含税，运费另计',
        remarksList: [
          '本报价有效期为： 2025-10-13 至 2025-10-30',
          '以上价格为含税含运费价格（限天津地区）。',
          '最终成交价格以双方签订的正式销售合同为准。',
          '如对本报价有任何疑问，请随时联系我们。电话: 138-XXXX-XXXX (微信同号)',
          '其他备注：布局与命名测试'
        ],
        contactPerson: '张三',
        phone: '13800000000',
        companyName: '天津光大钢铁有限公司',
        email: 'sales@example.com'
      }
    };

    const recRes = await fetch(baseApi + '/quotes/records', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(recordBody)
    });
    const recJson = await recRes.json();
    if (!recRes.ok) {
      console.error('创建记录失败:', recJson);
      process.exit(1);
    }
    console.log('创建记录ID:', recJson.id);

    const genRes = await fetch(baseApi + `/quotes/records/${recJson.id}/generate-pdf`, {
      method: 'POST',
      headers: authHeaders
    });
    const genJson = await genRes.json();
    if (!genRes.ok) {
      console.error('生成PDF失败:', genJson);
      process.exit(1);
    }

    console.log('PDF生成成功, 路径:', genJson.pdf_path);
    const pathBasename = genJson.pdf_path.split('/').pop();
    const previewUrl = `http://localhost:3002/uploads/${pathBasename}`;
    console.log('PREVIEW_URL:', previewUrl);
  } catch (e) {
    console.error('脚本执行异常:', e);
    process.exit(1);
  }
})();
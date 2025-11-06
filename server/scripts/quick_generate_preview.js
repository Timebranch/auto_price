#!/usr/bin/env node
/**
 * 快速创建一条报价记录并生成PDF，用于本地样式预览。
 * - 使用管理员账号登录（默认 admin/admin123，可通过环境变量覆盖）。
 * - 自动获取第一个模板并创建记录。
 * - 生成PDF后输出预览URL（/uploads/<filename>）。
 */

async function main() {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
  const API = BASE_URL + '/api';
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
  const PREVIEW_WITHOUT_COMPANY = process.env.PREVIEW_WITHOUT_COMPANY === 'true'
const PREVIEW_IMAGE_URL = process.env.PREVIEW_IMAGE_URL
const USE_COLOR_BLOCK = process.env.USE_COLOR_BLOCK === 'true';

  const fmtDate = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  try {
    // 登录
    const loginRes = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
    });
    if (!loginRes.ok) {
      const t = await loginRes.text();
      throw new Error(`登录失败: ${loginRes.status} ${loginRes.statusText} ${t}`);
    }
    const loginJson = await loginRes.json();
    const token = loginJson?.token;
    if (!token) throw new Error('登录未返回token');

    const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    // 获取模板列表
    const tplRes = await fetch(API + '/quotes/templates', { headers: { Authorization: `Bearer ${token}` } });
    const tplJson = await tplRes.json();
    if (!tplRes.ok) throw new Error(`获取模板失败: ${tplRes.status} ${tplRes.statusText}`);
    const tplId = Array.isArray(tplJson) && tplJson.length ? tplJson[0].id : 1;

    // 创建报价记录
    const today = new Date();
    const recordBody = {
      template_id: tplId,
      title: '样式预览测试',
      form_data: {
        customerName: '天津光大钢铁有限公司',
        companyName: PREVIEW_WITHOUT_COMPANY ? '' : '天津光大钢铁有限公司',
        quoteNumber: 'PREVIEW-' + Date.now(),
        quoteDate: fmtDate(today),
        validityStartDate: fmtDate(today),
        validityEndDate: fmtDate(new Date(Date.now() + 7 * 86400000)),
        remarksList: [
          '报价含税，运费另计（如无特殊说明）。',
          '本报价有效期：7天（以页面所示为准）。',
          '最终成交价格以双方签订的销售合同为准。',
          '如有疑问，请联系销售代表：138-XXXX-XXXX（微信同号）。',
          '签章尺寸180px，允许与公司名称轻度重叠。',
          '备注区字体13px，行距1.8，优化可读性。'
        ],
        stampImageUrl: BASE_URL + '/uploads/qianzhang.png?v=' + Date.now(),
        useColorBlock: USE_COLOR_BLOCK,
        itemsImageUrl: PREVIEW_IMAGE_URL || (BASE_URL + '/uploads/__1760953341615.jpg?v=' + Date.now())
      }
    };

    const recRes = await fetch(API + '/quotes/records', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(recordBody)
    });
    const recJson = await recRes.json();
    if (!recRes.ok) throw new Error(`创建记录失败: ${recRes.status} ${recRes.statusText} ${JSON.stringify(recJson)}`);

    // 生成PDF
    const genRes = await fetch(API + `/quotes/records/${recJson.id}/generate-pdf`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const genJson = await genRes.json();
    if (!genRes.ok) throw new Error(`生成PDF失败: ${genRes.status} ${genRes.statusText} ${JSON.stringify(genJson)}`);

    console.log('PDF生成成功, 路径:', genJson.pdf_path);
    const basename = String(genJson.pdf_path || '').split('/').pop();
    const previewUrl = `${BASE_URL}/uploads/${basename}`;
    console.log('PREVIEW_URL:', previewUrl);
  } catch (e) {
    console.error('快速生成预览失败:', e);
    process.exit(1);
  }
}

main();
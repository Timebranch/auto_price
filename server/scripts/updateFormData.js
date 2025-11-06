#!/usr/bin/env node
/**
 * 更新报价记录的表单数据，注入 remarksList 与 stampImageUrl 等新模板所需字段。
 * 用法：node server/scripts/updateFormData.js <recordId>
 */

(async function main() {
  const recordId = process.argv[2];
  if (!recordId) {
    console.error('请提供报价记录ID，例如：node server/scripts/updateFormData.js 111');
    process.exit(1);
  }

  const baseURL = process.env.BASE_URL || 'http://localhost:3001';
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  async function fetchJson(url, opts = {}) {
    const res = await fetch(url, opts);
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { raw: text }; }
    if (!res.ok) {
      throw new Error(`[${res.status}] ${res.statusText}: ${JSON.stringify(json).slice(0, 200)}`);
    }
    return json;
  }

  try {
    // 登录获取 token
    const login = await fetchJson(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const token = login?.token;
    if (!token) throw new Error('登录未返回token');
    const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    // 获取现有记录
    const record = await fetchJson(`${baseURL}/api/quotes/records/${recordId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const currentForm = (() => {
      try { return JSON.parse(record.form_data || '{}'); } catch { return {}; }
    })();

    // 注入/覆盖新模板所需字段
    const updatedForm = {
      ...currentForm,
      // 公司名称用于签章右侧文本
      companyName: currentForm.companyName || '天津光大钢铁有限公司',
      // 备注列表（优先显示）；如已有 remarksList 则保留现有
      remarksList: Array.isArray(currentForm.remarksList) && currentForm.remarksList.length > 0 ? currentForm.remarksList : [
        '本报价有效期为：' + ((currentForm.validityStartDate || currentForm.validityStart || '') + ' 至 ' + (currentForm.validityEndDate || currentForm.validityEnd || '')).trim(),
        '最终成交价格以双方签订的正式销售合同为准。',
        '如对本报价有任何疑问，请联系销售代表。',
      ].filter(s => s && s.replace(/\s+/g, '').length > 0),
      // 签章图片URL（如果已有则保留现有）
      stampImageUrl: currentForm.stampImageUrl || `${baseURL}/uploads/qianzhang.png?v=${Date.now()}`,
    };

    // 调用更新接口
    const updated = await fetchJson(`${baseURL}/api/quotes/records/${recordId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        title: record.title,
        status: record.status,
        form_data: updatedForm,
      })
    });

    console.log('记录已更新：', updated.id || recordId);
    console.log('更新后的备注列表行数：', (updatedForm.remarksList || []).length);
    console.log('签章图片：', updatedForm.stampImageUrl);
    console.log('公司名称：', updatedForm.companyName);
    console.log('下一步：执行 generatePdf.js 重新生成PDF。');
  } catch (err) {
    console.error('更新记录失败：', err?.message || err);
    process.exit(1);
  }
})();
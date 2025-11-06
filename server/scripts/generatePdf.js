#!/usr/bin/env node
/**
 * 登录并为指定报价记录生成PDF，然后输出下载链接。
 * 用法：node server/scripts/generatePdf.js <recordId>
 */

async function main() {
  const recordId = process.argv[2];
  if (!recordId) {
    console.error('请提供报价记录ID，例如：node server/scripts/generatePdf.js 110');
    process.exit(1);
  }

  const baseURL = process.env.BASE_URL || 'http://localhost:3001';
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  try {
    const loginRes = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!loginRes.ok) throw new Error(`登录失败：${loginRes.status} ${loginRes.statusText}`);
    const loginJson = await loginRes.json();
    const token = loginJson?.token;
    if (!token) throw new Error('登录未返回token');

    const genRes = await fetch(`${baseURL}/api/quotes/records/${recordId}/generate-pdf`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!genRes.ok) throw new Error(`生成PDF失败：${genRes.status} ${genRes.statusText}`);
    const genJson = await genRes.json();
    const { message, download_url, pdf_path } = genJson || {};
    console.log('生成结果：', message || '成功');
    console.log('PDF路径：', pdf_path || '(未返回)');
    console.log('下载链接：', `${baseURL}${download_url}`);
  } catch (err) {
    console.error('生成PDF失败：', err?.message || err);
    process.exit(1);
  }
}

main();
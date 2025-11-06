#!/usr/bin/env node
(async () => {
  try {
    const baseApi = 'http://localhost:3001/api'

    // 使用默认管理员账号登录以获取 token
    const loginRes = await fetch(baseApi + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    })
    const loginJson = await loginRes.json()
    if (!loginRes.ok) {
      console.error('登录失败:', loginJson)
      process.exit(1)
    }
    const token = loginJson.token
    const authHeaders = { 'Authorization': 'Bearer ' + token }

    // 获取模板，选取第一个
    const tplRes = await fetch(baseApi + '/quotes/templates', { headers: authHeaders })
    const tplJson = await tplRes.json()
    if (!tplRes.ok) {
      console.error('获取模板失败:', tplJson)
      process.exit(1)
    }
    const templateId = Array.isArray(tplJson) && tplJson.length ? tplJson[0].id : null
    if (!templateId) {
      console.error('没有可用模板，无法创建报价单')
      process.exit(1)
    }

    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
    const title = `Mock报价单 - ${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`

    const form_data = {
      customerName: '天津壹伍贰钢铁贸易有限公司',
      contactPerson: '张三',
      phone: '+86 138-0013-8000',
      customerAddress: '天津市河东区某工业园区A座',
      quoteNumber: `MOCK-${fmtDate(now).replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`,
      quoteDate: fmtDate(now),
      validityStartDate: fmtDate(now),
      validityEndDate: fmtDate(new Date(now.getTime() + 7 * 24 * 3600 * 1000)),
      salesRep: '测试销售',
      salesRepPhone: '+86 138-0013-8001',
      items: [
        { itemName: 'H型钢', specification: '200×200×8×12', material: 'Q355B', quantity: 12, unit: '吨', unitPrice: 4980, totalPrice: 59760 },
        { itemName: '槽钢', specification: '20#', material: 'Q235B', quantity: 20, unit: '吨', unitPrice: 4320, totalPrice: 86400 }
      ],
      taxRatePercent: 13,
      freightIncluded: '否',
      remarks: '本报价含税不含运费，有效期7天。'
    }

    const createRes = await fetch(baseApi + '/quotes/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ template_id: templateId, title, form_data })
    })
    const createJson = await createRes.json()
    if (!createRes.ok) {
      console.error('创建报价单失败:', createJson)
      process.exit(1)
    }

    const newId = createJson.id
    console.log('CREATED_RECORD_ID:', newId)
    console.log('Mock报价单已创建：ID', newId, '标题', title)
  } catch (e) {
    console.error('脚本执行异常:', e)
    process.exit(1)
  }
})()
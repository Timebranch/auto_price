/*
 * 批量创建发货单与明细（含材质/单重/总重）
 * 运行：node server/scripts/createMockDeliveries.js
 */
const path = require('path')

// 使用已编译的数据库模块（dist），避免 ts-node 依赖
const { db, initDatabase } = require(path.join(__dirname, '../dist/models/database'))

async function getDefaultUserId() {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM users ORDER BY id ASC LIMIT 1', [], (err, row) => {
      if (err) return reject(err)
      if (!row) return reject(new Error('No user found to assign created_by'))
      resolve(row.id)
    })
  })
}

function insertDeliveryNote(userId, payload) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO delivery_notes (
        order_name, customer_name, delivery_time, created_by, file_path,
        status, license_plate, driver_name, driver_phone,
        receiver_name, receiver_phone, shipper_name, shipper_phone,
        address, note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    const params = [
      payload.order_name,
      payload.customer_name,
      payload.delivery_time,
      userId,
      payload.status || 'pending_review',
      payload.license_plate,
      payload.driver_name,
      payload.driver_phone,
      payload.receiver_name,
      payload.receiver_phone,
      payload.shipper_name,
      payload.shipper_phone,
      payload.address,
      payload.note || null,
    ]
    db.run(sql, params, function (err) {
      if (err) return reject(err)
      resolve(this.lastID)
    })
  })
}

function insertDeliveryItems(deliveryId, items) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO delivery_items (
        delivery_id, product_name, material, spec, length, quantity, unit, unit_weight, total_weight, remark, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    let anyErr = null
    items.forEach((it, idx) => {
      db.run(
        sql,
        [
          deliveryId,
          it.product_name,
          it.material || null,
          it.spec,
          it.length || null,
          Number(it.quantity),
          it.unit,
          it.unit_weight || null,
          it.total_weight || null,
          it.remark || null,
          idx,
        ],
        (e) => { if (e) anyErr = e }
      )
    })
    if (anyErr) return reject(anyErr)
    resolve(true)
  })
}

function buildMockData() {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10)
  const customers = ['中建一局', '中铁三局', '中冶天工', '中交三航', '江苏华滋', '中建八局', '中建三局', '中石化工程']
  const orders = ['海河项目', '滨海新区管廊', '智慧园区钢构', '装配式车间', '能源管道配套', '办公楼主体钢构', '厂区改造', '码头加固']
  const materials = ['Q235B', 'HRB400E', 'Q345B', '304不锈钢']
  const units = ['件', '吨', '米']

  const mockNotes = Array.from({ length: 8 }).map((_, i) => ({
    order_name: `${orders[i % orders.length]}_${i + 1}`,
    customer_name: customers[i % customers.length],
    delivery_time: `${dateStr} 08:3${i % 10}:00`,
    status: i % 3 === 0 ? 'approved' : 'pending_review',
    license_plate: `津A${1000 + i}`,
    driver_name: `司机${i + 1}`,
    driver_phone: `1380000${100 + i}`,
    receiver_name: `接货人${i + 1}`,
    receiver_phone: `1390000${200 + i}`,
    shipper_name: `发货人${i + 1}`,
    shipper_phone: `1370000${300 + i}`,
    address: `天津市滨海新区XX路${10 + i}号`,
    note: i % 2 === 0 ? '紧急送达' : '常规配送',
    items: [
      {
        product_name: '螺纹钢',
        material: materials[i % materials.length],
        spec: 'Φ16',
        length: '9m',
        quantity: 20 + i,
        unit: units[0],
        unit_weight: '0.617t/件',
        total_weight: `${(0.617 * (20 + i)).toFixed(2)}t`,
        remark: '按件计重',
      },
      {
        product_name: '方管',
        material: 'Q235B',
        spec: '100×100×3.0',
        length: '定尺',
        quantity: 120 + i * 3,
        unit: units[2],
        unit_weight: '0.012t/米',
        total_weight: `${(0.012 * (120 + i * 3)).toFixed(2)}t`,
        remark: '按米计重',
      },
      {
        product_name: '卷板',
        material: 'Q345B',
        spec: '6mm',
        length: '',
        quantity: 5 + i,
        unit: units[1],
        unit_weight: '',
        total_weight: `${(5 + i).toFixed(2)}t`,
        remark: '整板计重',
      },
    ],
  }))

  return mockNotes
}

async function main() {
  try {
    await initDatabase()
    const userId = await getDefaultUserId()
    const notes = buildMockData()
    for (const payload of notes) {
      const id = await insertDeliveryNote(userId, payload)
      await insertDeliveryItems(id, payload.items)
      console.log(`插入发货单 #${id} -> ${payload.order_name} (${payload.customer_name})`) 
    }
    console.log(`共插入发货单：${notes.length} 条`)
  } catch (e) {
    console.error('插入发货单数据失败：', e)
    process.exitCode = 1
  } finally {
    try { db.close() } catch {}
  }
}

main()
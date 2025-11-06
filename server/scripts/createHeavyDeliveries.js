/*
 * 生成两条商品明细较多（15与20行）的发货单，便于检查样式
 * 运行：node server/scripts/createHeavyDeliveries.js
 */
const path = require('path')
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
      payload.status || 'approved',
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
    db.serialize(() => {
      let anyErr = null
      items.forEach((it, idx) => {
        db.run(sql, [
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
        ], (e) => { if (e) anyErr = e })
      })
      if (anyErr) return reject(anyErr)
      resolve(true)
    })
  })
}

function makeItems(count) {
  const mats = ['Q235B','Q345B','HRB400E','304不锈钢']
  const items = []
  for (let i = 0; i < count; i++) {
    const mat = mats[i % mats.length]
    const qty = 5 + (i % 7)
    const unit = i % 3 === 0 ? '件' : (i % 3 === 1 ? '米' : '吨')
    const unitWeight = unit === '件' ? '0.62t/件' : (unit === '米' ? '0.012t/米' : '')
    const total = unit === '吨' ? `${qty.toFixed(2)}t` : `${((unit === '件' ? 0.62 : 0.012) * qty).toFixed(2)}t`
    items.push({
      product_name: i % 2 === 0 ? '螺纹钢' : '方管',
      material: mat,
      spec: i % 2 === 0 ? `Φ${12 + (i % 6)}` : `${80 + (i % 5) * 20}×${80 + (i % 5) * 20}×${(2 + (i % 4))}.0`,
      length: unit === '米' ? `${6 + (i % 4)}m` : (unit === '件' ? '定尺' : ''),
      quantity: qty,
      unit,
      unit_weight: unitWeight,
      total_weight: total,
      remark: i % 5 === 0 ? '需分批卸货' : ''
    })
  }
  return items
}

function buildHeavyNotes() {
  const nowDate = new Date().toISOString().slice(0,10)
  return [
    {
      order_name: `超长明细样式测试_15行`,
      customer_name: '天津光大钢铁有限公司',
      delivery_time: `${nowDate} 10:00:00`,
      status: 'approved',
      license_plate: '津A7777',
      driver_name: '司机甲',
      driver_phone: '13800001234',
      receiver_name: '接货甲',
      receiver_phone: '13900001234',
      shipper_name: '发货甲',
      shipper_phone: '13700001234',
      address: '天津市开发区测试路88号',
      note: '15行明细用于表格分页与布局验证',
      items: makeItems(15)
    },
    {
      order_name: `超长明细样式测试_20行`,
      customer_name: '江苏华滋能源有限公司',
      delivery_time: `${nowDate} 15:30:00`,
      status: 'approved',
      license_plate: '苏B8888',
      driver_name: '司机乙',
      driver_phone: '13800005678',
      receiver_name: '接货乙',
      receiver_phone: '13900005678',
      shipper_name: '发货乙',
      shipper_phone: '13700005678',
      address: '江苏省南通市测试大道18号',
      note: '20行明细用于表格分页与布局验证',
      items: makeItems(20)
    }
  ]
}

async function main() {
  try {
    await initDatabase()
    const userId = await getDefaultUserId()
    const notes = buildHeavyNotes()
    for (const payload of notes) {
      const id = await insertDeliveryNote(userId, payload)
      await insertDeliveryItems(id, payload.items)
      console.log(`插入重明细发货单 #${id} -> ${payload.order_name} (${payload.customer_name})`)
    }
    console.log(`共插入重明细发货单：${notes.length} 条`)
  } catch (e) {
    console.error('插入重明细发货单失败：', e)
    process.exitCode = 1
  } finally {
    try { db.close() } catch {}
  }
}

main()
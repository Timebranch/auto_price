<template>
  <div class="page-container">
    <!-- 顶部工具栏：下载模板与上传Excel -->
    <div class="toolbar">
      <a-space>
        <a-button @click="downloadTemplate">下载发货单模板</a-button>
        <a-upload :before-upload="beforeDeliveryExcelUpload" :show-upload-list="false" accept=".xls,.xlsx">
          <a-button>上传发货单</a-button>
        </a-upload>
      </a-space>
    </div>

    <!-- 移除卡片容器与标题，仅保留表单内容 -->
    <a-form layout="vertical">
      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item label="项目名称" required>
            <a-input v-model:value="form.order_name" placeholder="请输入项目名称" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="客户名称" required>
            <a-input v-model:value="form.customer_name" placeholder="请输入客户名称" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="发货日期" required>
            <a-date-picker v-model:value="deliveryDate" style="width: 100%" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-divider orientation="left">商品明细（至少一行）</a-divider>
      <div class="items">
        <a-space direction="vertical" style="width: 100%">
          <div v-for="(it, idx) in form.items" :key="idx" class="item-row">
            <a-row :gutter="12">
              <a-col :span="6">
                <a-form-item label="商品名称" required>
                  <a-input v-model:value="it.product_name" placeholder="如：螺纹钢/方管/卷板" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="材质">
                  <a-input v-model:value="it.material" placeholder="如：Q235B/HRB400E" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="规格" required>
                  <a-input v-model:value="it.spec" placeholder="如：Φ12/100×100×3.0" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="长度">
                  <a-input v-model:value="it.length" placeholder="如：9m/定尺（可不填）" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="12">
              <a-col :span="4">
                <a-form-item label="数量" required>
                  <a-input v-model:value="it.quantity" placeholder="请输入数量" style="width: 100%" />
                </a-form-item>
              </a-col>
              <a-col :span="3">
                <a-form-item label="单位" required>
                  <a-input v-model:value="it.unit" placeholder="如：件/吨/米" />
                </a-form-item>
              </a-col>
              <a-col :span="5">
                <a-form-item label="单重">
                  <a-input v-model:value="it.unit_weight" placeholder="如：0.617t/件" />
                </a-form-item>
              </a-col>
              <a-col :span="5">
                <a-form-item label="总重">
                  <a-input v-model:value="it.total_weight" placeholder="如：12.34t" />
                </a-form-item>
              </a-col>
              <a-col :span="7">
                <a-form-item label="备注">
                  <a-input v-model:value="it.remark" placeholder="可不填" />
                </a-form-item>
              </a-col>
            </a-row>
            <div class="item-actions">
              <a-button type="dashed" @click="addItem">新增一行</a-button>
              <a-button danger @click="removeItem(idx)" :disabled="form.items.length <= 1">删除该行</a-button>
            </div>
          </div>
        </a-space>
      </div>

      <a-divider orientation="left">物流与收货信息</a-divider>
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="车牌号" required>
            <a-input v-model:value="form.license_plate" placeholder="请输入车牌号" />
          </a-form-item>
        </a-col>
        <!-- 合并送货司机与司机电话为一个表单项，占两列宽度 -->
        <a-col :span="12">
        <a-form-item label="送货司机及电话" required>
          <div class="inline-inputs">
            <a-input v-model:value="form.driver_name" placeholder="司机姓名" />
            <a-input
              v-model:value="form.driver_phone"
              placeholder="手机号码"
              inputmode="tel"
              maxlength="11"
              @input="onDriverPhoneInput"
            />
          </div>
        </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="现场接货人" required>
            <a-input v-model:value="form.receiver_name" placeholder="请输入接货人姓名" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="接货人电话" required>
            <a-input v-model:value="form.receiver_phone" placeholder="请输入接货人电话" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="发货人" required>
            <a-input v-model:value="form.shipper_name" placeholder="发货人默认当前用户" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="发货人电话" required>
            <a-input v-model:value="form.shipper_phone" placeholder="默认当前用户电话" />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item label="送货地址" required>
            <a-input v-model:value="form.address" placeholder="请输入详细送货地址" />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item label="备注">
            <a-input v-model:value="form.note" placeholder="可不填" />
          </a-form-item>
        </a-col>
      </a-row>

      <div class="form-actions">
        <a-space>
          <a-button type="default" @click="saveDraft" :loading="saving">保存草稿</a-button>
          <a-button type="primary" @click="saveAndGenerate" :loading="saving">保存并生成</a-button>
          <a-button @click="goBack" :disabled="saving">返回</a-button>
        </a-space>
      </div>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import dayjs, { Dayjs } from 'dayjs'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'
import deliveryApi, { type DeliveryItemInput, type DeliveryCreatePayload } from '@/api/delivery'
import * as XLSX from 'xlsx'

const router = useRouter()
const authStore = useAuthStore()

const deliveryDate = ref<Dayjs | null>(dayjs())

// 统一静态资源基础地址（生产通过 VITE_API_BASE_URL 注入；本地默认 3005）
const API_BASE = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3005'
const API_BASE_CLEAN = API_BASE.replace(/\/$/, '')
const TEMPLATE_URL = `${API_BASE_CLEAN}/uploads/${encodeURIComponent('发货单模板.xlsx')}`

const downloadTemplate = () => {
  window.open(TEMPLATE_URL, '_blank')
}

const form = reactive({
  order_name: '',
  customer_name: '',
  items: [ { product_name: '', material: '', spec: '', length: '', quantity: 1, unit: '件', unit_weight: '', total_weight: '', remark: '' } ] as DeliveryItemInput[],
  license_plate: '',
  driver_name: '',
  driver_phone: '',
  receiver_name: '',
  receiver_phone: '',
  shipper_name: authStore.user?.username || '',
  shipper_phone: authStore.user?.phone || '',
  address: '',
  note: '',
})

const saving = ref(false)

const addItem = () => { form.items.push({ product_name: '', material: '', spec: '', length: '', quantity: 1, unit: '件', unit_weight: '', total_weight: '', remark: '' }) }
const removeItem = (idx: number) => { if (form.items.length > 1) form.items.splice(idx, 1) }
// 仅允许数字输入，限制为 11 位手机号
const onDriverPhoneInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  form.driver_phone = target.value.replace(/\D/g, '').slice(0, 11)
}

const validateForm = (): boolean => {
  const errs: string[] = []
  if (!form.order_name) errs.push('项目名称必填')
  if (!form.customer_name) errs.push('客户名称必填')
  if (!deliveryDate.value) errs.push('发货日期必填')
  if (form.items.length < 1) errs.push('至少需要一组商品条目')
  form.items.forEach((it, idx) => {
    if (!it.product_name) errs.push(`第${idx + 1}行商品名称必填`)
    if (!it.spec) errs.push(`第${idx + 1}行规格必填`)
    // 长度非必填
    if (String(it.quantity ?? '').trim() === '') errs.push(`第${idx + 1}行数量必填`)
    if (!it.unit) errs.push(`第${idx + 1}行单位必填`)
  })
  if (!form.license_plate) errs.push('车牌号必填')
  if (!form.driver_name) errs.push('送货司机必填')
  if (!form.driver_phone) errs.push('司机电话必填')
  else if (!/^1\d{10}$/.test(form.driver_phone)) errs.push('司机电话格式不正确')
  if (!form.receiver_name) errs.push('现场接货人必填')
  if (!form.receiver_phone) errs.push('接货人电话必填')
  if (!form.shipper_name) errs.push('发货人必填')
  if (!form.shipper_phone) errs.push('发货人电话必填')
  if (!form.address) errs.push('送货地址必填')

  if (errs.length > 0) {
    message.error(errs[0])
    return false
  }
  return true
}

const buildPayload = (status: 'draft' | 'pending_review'): DeliveryCreatePayload => ({
  order_name: form.order_name,
  customer_name: form.customer_name,
  delivery_date: deliveryDate.value ? (deliveryDate.value as Dayjs).format('YYYY-MM-DD') : undefined,
  items: form.items.map(it => ({ ...it, quantity: normalizeNumber(it.quantity as unknown as string | number) })),
  license_plate: form.license_plate,
  driver_name: form.driver_name,
  driver_phone: form.driver_phone,
  receiver_name: form.receiver_name,
  receiver_phone: form.receiver_phone,
  shipper_name: form.shipper_name,
  shipper_phone: form.shipper_phone,
  address: form.address,
  note: form.note || undefined,
  status,
})

// ===== Excel 解析：填充表单 =====
const headerMap: Record<string, keyof DeliveryItemInput | 'seq'> = {
  '序号': 'seq',
  '商品名称': 'product_name',
  '材质': 'material',
  '规格': 'spec',
  '长度': 'length',
  '数量': 'quantity',
  '单位': 'unit',
  '单重': 'unit_weight',
  '总重': 'total_weight',
  '备注': 'remark',
}

const normalizeNumber = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s = String(v ?? '')
    .replace(/[，,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // 先提取阿拉伯数字片段（支持正负与小数）
  const m = s.match(/[-+]?\d+(?:\.\d+)?/)
  if (m) {
    const n = parseFloat(m[0])
    return Number.isFinite(n) ? n : 0
  }
  // 若无阿拉伯数字，尝试中文数字（支持 十/百/千/万/亿，点/半）
  const cm = s.match(/[〇零一二两兩三四五六七八九十百千万萬亿点\.半]+/)
  if (cm) {
    const n = parseChineseNumeral(cm[0])
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

const parseChineseNumeral = (input: string): number => {
  const CN_DIGITS: Record<string, number> = {
    '零': 0, '〇': 0,
    '一': 1, '二': 2, '两': 2, '兩': 2,
    '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  }
  const CN_UNITS: Record<string, number> = { '十': 10, '百': 100, '千': 1000 }
  const s = String(input ?? '').trim()
  if (!s) return 0

  const parseUnder10000 = (seg: string): number => {
    let res = 0
    let cur = 0
    for (const ch of seg) {
      const digitVal = (CN_DIGITS as Record<string, number>)[ch]
      if (digitVal !== undefined) {
        cur = digitVal
        continue
      }
      const unitVal = (CN_UNITS as Record<string, number>)[ch]
      if (unitVal !== undefined) {
        if (ch === '十' && cur === 0) cur = 1
        res += cur * unitVal
        cur = 0
        continue
      }
      if (ch === '零' || ch === '〇') {
        continue
      }
      if (ch === '半') {
        res += 0.5
        continue
      }
    }
    return res + cur
  }

  const parseLarge = (str: string): number => {
    let total = 0
    let rest = str
    // 亿
    const idxYi = Math.max(rest.lastIndexOf('亿'), -1)
    if (idxYi !== -1) {
      const left = rest.slice(0, idxYi)
      const right = rest.slice(idxYi + 1)
      total += parseUnder10000(left) * 100000000
      rest = right
    }
    // 万/萬
    const idxWan = Math.max(rest.lastIndexOf('万'), rest.lastIndexOf('萬'))
    if (idxWan !== -1) {
      const left = rest.slice(0, idxWan)
      const right = rest.slice(idxWan + 1)
      total += parseUnder10000(left) * 10000
      rest = right
    }
    total += parseUnder10000(rest)
    return total
  }

  // 处理中文小数“点”或英文小数点
  let intPart = s
  let fracPart = ''
  const dotIdx = s.indexOf('点') !== -1 ? s.indexOf('点') : s.indexOf('.')
  if (dotIdx !== -1) {
    intPart = s.slice(0, dotIdx)
    fracPart = s.slice(dotIdx + 1)
  }

  const intVal = parseLarge(intPart)
  let fracVal = 0
  if (fracPart) {
    if (fracPart.includes('半')) {
      fracVal = 0.5
    } else {
      let denom = 10
      for (const ch of fracPart) {
        let digit = 0
        const dval = (CN_DIGITS as Record<string, number>)[ch]
        if (dval !== undefined) digit = dval
        else if (/\d/.test(ch)) digit = parseInt(ch, 10)
        else continue
        fracVal += digit / denom
        denom *= 10
      }
    }
  }

  const n = intVal + fracVal
  return Number.isFinite(n) ? n : 0
}

const getRowTexts = (row?: unknown[]): string[] => (Array.isArray(row) ? row : []).map((c) => String(c ?? '').trim())
// 移除旧的仅手机提取函数，改用 extractPhoneAny 统一处理手机/座机
// 允许座机/区号等非11位号码的备用匹配（优先匹配手机）
const extractPhoneAny = (s: string): string => {
  const digits = s.replace(/\D/g, '')
  const m = digits.match(/1\d{10}/)
  if (m) return m[0]
  const m2 = digits.match(/\d{7,12}/)
  return m2 ? m2[0] : ''
}
// 去除标签词
const stripLabels = (s: string, labels: string[]) => {
  return labels.reduce((acc, l) => acc.replace(new RegExp(l, 'g'), ''), s)
}
// 提取可能的车牌（中文+字母+5-6位字母/数字），统一为大写
const extractLicensePlate = (s: string): string => {
  const t = String(s ?? '').toUpperCase()
  const m = t.match(/[\u4E00-\u9FA5][A-Z][A-Z0-9]{5,6}/)
  return m ? m[0] : ''
}
const extractChineseName = (s: string): string => {
  const t = s
    .replace(/1\d{10}/g, '')
    .replace(/[A-Z\u4e00-\u9fa5]{1}[A-Z0-9]{5}/gi, '')
    .replace(/[0-9\-_.\s]/g, '')
  const m = t.match(/[\u4e00-\u9fa5]{2,6}/)
  return m ? m[0] : ''
}
// 统一的标签同义词集合，供严格匹配与列位识别使用
const KEY_SYNONYMS = {
  orderName: ['项目名称','工程名称','项目','工程'],
  customerName: ['客户名称','客户','单位','公司'],
  licensePlate: ['车牌号','车牌'],
  driverName: ['送货司机','司机','驾驶员'],
  driverPhone: ['司机电话','司机联系方式','司机手机','司机手机号','联系电话'],
  receiverName: ['现场接货人','接货人','收货人'],
  receiverPhone: ['接货人电话','收货人电话','收货人联系方式','联系电话'],
  shipperName: ['发货人','发件人'],
  shipperPhone: ['发货人电话','发件人电话','联系电话'],
  address: ['送货地址','收货地址','地址'],
  note: ['备注','说明']
}
// 归一化包含判断（去空白与冒号差异）
const includesAny = (s: string, keys: string[]) => {
  const sn = normalizeKey(String(s ?? ''))
  const kn = keys.map(normalizeKey)
  return kn.some((k) => sn.includes(k))
}
const extractDriverName = (rowTexts: string[]): string => {
  const line = (rowTexts || []).map((c) => String(c ?? '')).join(' ')
  const stripped = stripLabels(line, KEY_SYNONYMS.driverName)
  return extractChineseName(stripped)
}
// 严格匹配：仅当命中指定键时返回，未命中返回空
const findStrictValueByKeys = (rowTexts: string[], keys: string[]): string => {
  const texts = (Array.isArray(rowTexts) ? rowTexts : []).map((c) => String(c ?? '').trim())
  const textsNorm = texts.map(normalizeKey)
  const keysNorm = keys.map(normalizeKey)
  for (let i = 0; i < textsNorm.length; i++) {
    const cell = textsNorm[i]
    if (!cell) continue
    for (const key of keysNorm) {
      if (cell.includes(key)) {
        const rawCell = String(texts[i] ?? '')
        const m = rawCell.match(/[:：]\s*(.+)$/)
        if (m) return (m[1] ?? '').trim()
        if (i + 1 < texts.length) {
          const next = String(texts[i + 1] ?? '').trim()
          if (next) return next
        }
        const parts = rawCell.split(/[:：]/)
        if (parts.length > 1) return parts.slice(1).join(':').trim()
      }
    }
  }
  return ''
}
const normalizeKey = (s: string) => String(s).replace(/\s+/g, '').replace(/[：:]/g, '：')

const cellText = (v: unknown) => String(v ?? '').trim()
const takeAfterColon = (s: string) => {
  const m = String(s ?? '').match(/[:：]\s*(.+)$/)
  return m ? (m[1] ?? '').trim() : ''
}
// 向右查找第一个非空单元格作为值
const nextNonEmptyRight = (row: unknown[], fromIndex: number): string => {
  if (!Array.isArray(row)) return ''
  for (let j = fromIndex + 1; j < row.length; j++) {
    const v = cellText(row[j])
    if (v) return v
  }
  return ''
}

const parseDeliveryExcel = async (file: File) => {
  try {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheetName = wb.SheetNames[0] || ''
    const sheet = sheetName ? wb.Sheets[sheetName] : undefined
    const rows = sheet ? ((XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][]) || []) : []

    // —— 项目/客户（扫描整表，遇到“项目名称”所在行） ——
    let foundOrderName = ''
    let foundCustomerName = ''

    for (let i = 0; i < rows.length; i++) {
      const rawRow = Array.isArray(rows[i]) ? (rows[i] as unknown[]) : ([] as unknown[])
      const texts = getRowTexts(rows[i] as unknown[])
      if (!texts.length) continue
      const line = texts.join('')
      // 如果这一行包含“项目名称”，认为这行同时包含客户；按四列布局取第2/第4格
      const hasProject = includesAny(line, KEY_SYNONYMS.orderName)
      if (hasProject) {
        const idxProject = rawRow.findIndex((c) => includesAny(cellText(c), KEY_SYNONYMS.orderName))
        const idxCustomer = rawRow.findIndex((c) => includesAny(cellText(c), KEY_SYNONYMS.customerName))
        const vProject = idxProject >= 0 ? (takeAfterColon(cellText(rawRow[idxProject])) || nextNonEmptyRight(rawRow, idxProject)) : ''
        const vCustomer = idxCustomer >= 0 ? (takeAfterColon(cellText(rawRow[idxCustomer])) || nextNonEmptyRight(rawRow, idxCustomer)) : ''
        if (!foundOrderName && vProject) foundOrderName = vProject
        if (!foundCustomerName && vCustomer) foundCustomerName = vCustomer
        // 已命中直接退出循环
        break
      }
    }

    // 兜底：严格匹配（在前 15 行范围内）
    if (!foundOrderName || !foundCustomerName) {
      const limit = Math.min(rows.length, 15)
      for (let i = 0; i < limit; i++) {
        const rt = getRowTexts(rows[i] as unknown[])
        const line = rt.join('')
        if (!foundOrderName && includesAny(line, KEY_SYNONYMS.orderName)) {
          const v = findStrictValueByKeys(rt, KEY_SYNONYMS.orderName)
          if (v) foundOrderName = v
        }
        if (!foundCustomerName && includesAny(line, KEY_SYNONYMS.customerName)) {
          const v = findStrictValueByKeys(rt, KEY_SYNONYMS.customerName)
          if (v) foundCustomerName = v
        }
      }
    }

    // —— 明细表头行定位与明细解析 ——
    let headerRowIndex = -1
    let colToField: (keyof DeliveryItemInput | undefined)[] = []
    for (let i = 0; i < rows.length; i++) {
      const rowTexts = getRowTexts(rows[i] as unknown[])
      const mapped = rowTexts.map((t) => headerMap[t] as (keyof DeliveryItemInput | 'seq' | undefined))
      const count = mapped.filter(Boolean).length
      const hasCore = mapped.includes('product_name') && mapped.includes('quantity')
      if (count >= 4 && hasCore) {
        headerRowIndex = i
        colToField = mapped.map((m) => (m === 'seq' ? undefined : (m as keyof DeliveryItemInput)))
        break
      }
    }

    const items: DeliveryItemInput[] = []
    if (headerRowIndex !== -1) {
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i]
        const rowTexts = getRowTexts(row as unknown[])
        // 到达物流信息区则终止
        const joined = rowTexts.join('')
        if (joined.includes('车牌号') || joined.includes('送货司机') || joined.includes('现场接货人') || joined.includes('发货人') || joined.includes('送货地址')) {
          break
        }
        const item: DeliveryItemInput = { product_name: '', material: '', spec: '', length: '', quantity: 0, unit: '', unit_weight: '', total_weight: '', remark: '' }
        let hasText = false
        let hasNumeric = false
        const rowArr = Array.isArray(row) ? row : []
        for (let c = 0; c < rowTexts.length; c++) {
          const field = colToField[c]
          if (!field) continue
          const val = rowArr[c]
          if (field === 'quantity') {
            const num = normalizeNumber(val)
            item.quantity = num
            const raw = String(val ?? '').trim()
            if (raw !== '') hasNumeric = true
          } else {
            const str = String(val ?? '').trim()
            switch (field) {
              case 'product_name': item.product_name = str; break
              case 'material': item.material = str; break
              case 'spec': item.spec = str; break
              case 'length': item.length = str; break
              case 'unit': item.unit = str; break
              case 'unit_weight': item.unit_weight = str; break
              case 'total_weight': item.total_weight = str; break
              case 'remark': item.remark = str; break
              default: break
            }
            if (str !== '') hasText = true
          }
        }
        const hasData = hasText || hasNumeric
        if (hasData) items.push(item)
      }
    }

    // —— 物流与收货信息：列位优先，关键词兜底 ——
    let licensePlate = ''
    let driverName = ''
    let driverPhone = ''
    let receiverName = ''
    let receiverPhone = ''
    let shipperName = ''
    let shipperPhone = ''
    let address = ''
    let note = ''

    const scanStart = Math.max(0, headerRowIndex + 1)
    const scanEnd = Math.min(rows.length, scanStart + 40)
    for (let i = scanStart; i < scanEnd; i++) {
      const rawRow = Array.isArray(rows[i]) ? (rows[i] as unknown[]) : ([] as unknown[])
      const rowTexts = getRowTexts(rows[i] as unknown[])
      if (!rowTexts.length) continue

      // 车牌号与送货司机可能在同一行：定位各自标签列，向右取第一个非空值
      if (includesAny(rowTexts.join(''), KEY_SYNONYMS.licensePlate)) {
        const idxPlate = rawRow.findIndex((c) => includesAny(cellText(c), KEY_SYNONYMS.licensePlate))
        if (!licensePlate && idxPlate >= 0) {
          const vPlate = takeAfterColon(cellText(rawRow[idxPlate])) || nextNonEmptyRight(rawRow, idxPlate)
          licensePlate = vPlate || extractLicensePlate(rowTexts.join(' ')) || ''
        }
        const idxDriver = rawRow.findIndex((c) => includesAny(cellText(c), KEY_SYNONYMS.driverName))
        if (idxDriver >= 0) {
          const dRaw = takeAfterColon(cellText(rawRow[idxDriver])) || nextNonEmptyRight(rawRow, idxDriver)
          if (dRaw) {
            const ph = extractPhoneAny(dRaw)
            const nm = extractChineseName(dRaw)
            if (!driverPhone && ph) driverPhone = ph
            if (!driverName && nm) driverName = nm
          }
        }
        continue
      }

      // 现场接货人与电话：定位标签列，优先冒号后，否则向右第一个非空
      if (includesAny(rowTexts.join(''), KEY_SYNONYMS.receiverName) || includesAny(rowTexts.join(''), KEY_SYNONYMS.receiverPhone)) {
        const idxRecv = rawRow.findIndex((c) => includesAny(cellText(c), KEY_SYNONYMS.receiverName))
        if (idxRecv >= 0 && !receiverName) {
          const vRecv = takeAfterColon(cellText(rawRow[idxRecv])) || nextNonEmptyRight(rawRow, idxRecv)
          if (vRecv) receiverName = String(vRecv).trim()
        }
        const idxRecvPh = rawRow.findIndex((c) => includesAny(cellText(c), KEY_SYNONYMS.receiverPhone))
        if (idxRecvPh >= 0 && !receiverPhone) {
          const vPhRaw = takeAfterColon(cellText(rawRow[idxRecvPh])) || nextNonEmptyRight(rawRow, idxRecvPh) || ''
          const ph = extractPhoneAny(String(vPhRaw))
          if (ph) receiverPhone = ph
        } else if (!receiverPhone) {
          const ph = extractPhoneAny(rowTexts.join(' '))
          if (ph) receiverPhone = ph
        }
        continue
      }
      // 发货人与电话：定位标签列，优先冒号后，否则向右第一个非空
      if (includesAny(rowTexts.join(''), KEY_SYNONYMS.shipperName) || includesAny(rowTexts.join(''), KEY_SYNONYMS.shipperPhone)) {
        const idxShip = rawRow.findIndex((c) => includesAny(cellText(c), KEY_SYNONYMS.shipperName))
        if (idxShip >= 0 && !shipperName) {
          const vShip = takeAfterColon(cellText(rawRow[idxShip])) || nextNonEmptyRight(rawRow, idxShip)
          if (vShip) shipperName = String(vShip).trim()
        }
        const idxShipPh = rawRow.findIndex((c) => includesAny(cellText(c), KEY_SYNONYMS.shipperPhone))
        if (idxShipPh >= 0 && !shipperPhone) {
          const vPhRaw = takeAfterColon(cellText(rawRow[idxShipPh])) || nextNonEmptyRight(rawRow, idxShipPh) || ''
          const ph = extractPhoneAny(String(vPhRaw))
          if (ph) shipperPhone = ph
        } else if (!shipperPhone) {
          const ph = extractPhoneAny(rowTexts.join(' '))
          if (ph) shipperPhone = ph
        }
        continue
      }
      // 送货地址：定位标签列，优先冒号后，否则向右第一个非空
      if (includesAny(rowTexts.join(''), KEY_SYNONYMS.address)) {
        const idxAddr = rawRow.findIndex((c) => includesAny(cellText(c), KEY_SYNONYMS.address))
        if (idxAddr >= 0 && !address) {
          const vAddr = takeAfterColon(cellText(rawRow[idxAddr])) || nextNonEmptyRight(rawRow, idxAddr) || ''
          if (vAddr) address = String(vAddr).trim()
        }
        continue
      }
      // 备注：定位标签列，优先冒号后，否则向右第一个非空（过滤分隔符）
      if (includesAny(rowTexts.join(''), KEY_SYNONYMS.note)) {
        const idxNote = rawRow.findIndex((c) => includesAny(cellText(c), KEY_SYNONYMS.note))
        if (idxNote >= 0 && !note) {
          const vNote = takeAfterColon(cellText(rawRow[idxNote])) || nextNonEmptyRight(rawRow, idxNote) || ''
          const nv = String(vNote).trim()
          if (nv && !/^\s*[-—~]*\s*$/.test(nv)) note = nv
        }
        continue
      }

      // 回退：旧的关键词扫描（仅在尚未识别到时）
      const line = rowTexts.join(' ')
      if (!licensePlate && includesAny(line, KEY_SYNONYMS.licensePlate)) {
        licensePlate = findStrictValueByKeys(rowTexts, KEY_SYNONYMS.licensePlate) || extractLicensePlate(line) || ''
      }
      if (!driverName && includesAny(line, KEY_SYNONYMS.driverName)) {
        driverName = extractDriverName(rowTexts)
      }
      if (!driverPhone && (includesAny(line, KEY_SYNONYMS.driverName) || includesAny(line, KEY_SYNONYMS.driverPhone))) {
        driverPhone = extractPhoneAny(line) || extractPhoneAny(findStrictValueByKeys(rowTexts, KEY_SYNONYMS.driverPhone))
      }
      if (!receiverName && includesAny(line, KEY_SYNONYMS.receiverName)) {
        receiverName = findStrictValueByKeys(rowTexts, KEY_SYNONYMS.receiverName)
      }
      if (!receiverPhone && (includesAny(line, KEY_SYNONYMS.receiverName) || includesAny(line, KEY_SYNONYMS.receiverPhone))) {
        receiverPhone = extractPhoneAny(line) || extractPhoneAny(findStrictValueByKeys(rowTexts, KEY_SYNONYMS.receiverPhone))
      }
      if (!shipperName && includesAny(line, KEY_SYNONYMS.shipperName)) {
        shipperName = findStrictValueByKeys(rowTexts, KEY_SYNONYMS.shipperName)
      }
      if (!shipperPhone && (includesAny(line, KEY_SYNONYMS.shipperName) || includesAny(line, KEY_SYNONYMS.shipperPhone))) {
        shipperPhone = extractPhoneAny(line) || extractPhoneAny(findStrictValueByKeys(rowTexts, KEY_SYNONYMS.shipperPhone))
      }
      if (!address && includesAny(line, KEY_SYNONYMS.address)) {
        address = findStrictValueByKeys(rowTexts, KEY_SYNONYMS.address) || ''
      }
      if (!note && includesAny(line, KEY_SYNONYMS.note)) {
        const nv = findStrictValueByKeys(rowTexts, KEY_SYNONYMS.note)
        if (nv && !/^\s*[-—~]*\s*$/.test(nv)) {
          note = nv
        }
      }
    }

    // —— 回填到表单 ——
    if (foundOrderName) form.order_name = foundOrderName
    if (foundCustomerName) form.customer_name = foundCustomerName

    if (items.length > 0) {
      form.items = items
    }

    if (licensePlate) form.license_plate = licensePlate
    if (driverName) form.driver_name = driverName
    if (driverPhone) form.driver_phone = driverPhone
    if (receiverName) form.receiver_name = receiverName
    if (receiverPhone) form.receiver_phone = receiverPhone
    if (shipperName) form.shipper_name = shipperName
    if (shipperPhone) form.shipper_phone = shipperPhone
    if (address) form.address = address
    if (note) form.note = note

    message.success(`已按列位识别：项目/客户，明细${items.length}行，司机/接货信息`)
  } catch (error) {
    console.error('解析Excel失败:', error)
    message.error('解析Excel失败，请确认文件格式与模板一致')
  }
}

const beforeDeliveryExcelUpload = async (file: File) => {
  await parseDeliveryExcel(file)
  return false
}

const saveDraft = async () => {
  if (!validateForm()) return
  try {
    saving.value = true
    const payload = buildPayload('draft')
    await deliveryApi.create(payload)
    message.success('草稿已保存')
    router.push({ name: 'delivery' })
  } catch {
    message.error('保存草稿失败')
  } finally {
    saving.value = false
  }
}

const saveAndGenerate = async () => {
  if (!validateForm()) return
  try {
    saving.value = true
    const payload = buildPayload('pending_review')
    await deliveryApi.create(payload)
    message.success('发货单已保存并开始生成')
    router.push({ name: 'delivery' })
  } catch {
    message.error('保存并生成失败')
  } finally {
    saving.value = false
  }
}

const goBack = () => router.back()
</script>

<style scoped>
.page-container {
  padding: 12px;
}
.toolbar { margin-bottom: 12px; display: flex; justify-content: flex-start; }
.items .item-row {
  border: 1px dashed #e5e5e5;
  padding: 12px;
  border-radius: 8px;
}
.item-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}
.inline-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
</style>
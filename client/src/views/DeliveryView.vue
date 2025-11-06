<template>
  <div class="page-container">

    <a-card :bordered="false">
      <div class="toolbar">
        <a-space>
          <a-input v-model:value="orderName" placeholder="订单名称" allow-clear style="width: 220px" />
          <a-input v-model:value="customerName" placeholder="客户名称" allow-clear style="width: 220px" />
          <a-button type="primary" @click="handleSearch" :loading="loading">搜索</a-button>
          <a-button @click="resetSearch" :disabled="loading">重置</a-button>
        </a-space>
        <!-- 新增创建发货单按钮在右侧 -->
        <a-space>
          <a-button type="primary" @click="goCreate">创建发货单</a-button>
        </a-space>
      </div>

  <a-table
    :columns="columns"
    :data-source="rows"
    :loading="loading"
    row-key="id"
    size="middle"
  >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-button
                type="primary"
                size="small"
                @click="download(record)"
                :loading="isDownloading(record.id)"
                :disabled="record.status !== 'approved' || isDownloading(record.id)"
              >
                下载发货单
              </a-button>
          <a-button v-if="isFinance" size="small" @click="openAudit(record.id)">审核</a-button>
        </a-space>
      </template>
    </template>
  </a-table>

  <a-modal v-model:open="auditVisible" title="审核发货单" :footer="null" :confirm-loading="auditLoading" width="1200px">
    <div v-if="auditDetail" class="audit-content">
      <!-- 信息块：逐行展示 -->
      <div class="info-block">
        <div class="info-row">项目名称：{{ auditDetail?.order_name || '-' }}</div>
        <div class="info-row">客户名称：{{ auditDetail?.customer_name || '-' }}</div>
        <div class="info-row">发货日期：{{ (auditDetail?.delivery_date || String(auditDetail?.delivery_time || '').slice(0,10)) }}</div>
        <div class="info-row">发货人：{{ auditDetail?.shipper_name || '-' }}</div>
        <div class="info-row">送货地址：{{ auditDetail?.address || '-' }}</div>
        <div class="info-row">备注：{{ auditDetail?.note || '-' }}</div>
      </div>

      <!-- 明细列表：用户填写每行价格 -->
      <a-table
        :columns="auditColumns"
        :data-source="auditItems"
        row-key="index"
        size="small"
        :pagination="false"
        style="margin-top: 12px;"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'unit_price'">
            <a-input-number
              v-model:value="record.unit_price"
              :min="0"
              :precision="2"
              style="width: 120px;"
              @change="(val:number|string)=>onUnitPriceChange(record, val)"
            />
          </template>
          <template v-if="column.key === 'price'">
            {{ (record.price ?? 0).toFixed(2) }}
          </template>
        </template>
      </a-table>

      <!-- 摘要：总价格与大写，靠右显示 -->
      <div class="summary" style="text-align: right; margin-top: 12px;">
        <div class="summary-total">总价格：{{ totalPrice.toFixed(2) }}</div>
        <div class="summary-uppercase" style="margin-top: 4px;">价格大写：{{ totalPriceUppercase }}</div>
      </div>

      <!-- 操作按钮 -->
      <div style="margin-top: 16px; display: flex; gap: 8px;">
        <a-button v-if="isAdminLike" type="primary" @click="generateSettlement" :disabled="!canGenerateSettlement || auditLoading">生成结算单</a-button>
        <a-button type="primary" @click="approve" :loading="auditLoading">通过</a-button>
        <a-button danger @click="reject" :loading="auditLoading">不通过</a-button>
        <a-button @click="closeAudit" :disabled="auditLoading">关闭</a-button>
      </div>
    </div>
    <div v-else style="padding: 12px;">正在加载详情...</div>
  </a-modal>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { message } from 'ant-design-vue'
import deliveryApi, { type DeliveryNote } from '@/api/delivery'
import settlementsApi from '@/api/settlements'
// 新增路由跳转
import { useRouter } from 'vue-router'
const router = useRouter()
const goCreate = () => router.push('/delivery/create')

const orderName = ref('')
const customerName = ref('')
const loading = ref(false)
const rows = ref<DeliveryNote[]>([])
// 行级下载loading集合
const downloadingIds = ref(new Set<number>())
const isDownloading = (id: number) => downloadingIds.value.has(id)

// 基础地址用于拼接上传文件地址
const API_BASE = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3005'
const API_BASE_CLEAN = API_BASE.replace(/\/$/, '')

// 前端 mock 数据（无接口数据时展示）
const mockRows: DeliveryNote[] = [
  { id: 10001, order_name: '订单 A2025-005', customer_name: '天津光大钢铁有限公司', delivery_time: '2025-10-30 09:00:00', created_by: 1, file_path: '/uploads/preview_normal.pdf', created_at: '2025-10-29 18:12:00', updated_at: '2025-10-29 18:12:00' },
  { id: 10002, order_name: '订单 A2025-006', customer_name: '河北XX金属', delivery_time: '2025-10-31 14:30:00', created_by: 2, file_path: '/uploads/preview_steel.pdf', created_at: '2025-10-30 09:00:00', updated_at: '2025-10-30 09:00:00' },
  { id: 10003, order_name: '订单 A2025-007', customer_name: '山西YY制造', delivery_time: '2025-11-02 08:15:00', created_by: 3, file_path: '/uploads/preview_with_image.pdf', created_at: '2025-10-30 10:22:00', updated_at: '2025-10-30 10:22:00' },
]

const columns = [
  { title: '序号', key: 'index', customRender: ({ index }: { index: number }) => index + 1 },
  { title: '订单名称', dataIndex: 'order_name', key: 'order_name' },
  { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '发货时间', dataIndex: 'delivery_time', key: 'delivery_time' },
  { title: '操作', key: 'actions' },
]

const fetchList = async () => {
  loading.value = true
  try {
    const res = await deliveryApi.list({ orderName: orderName.value, customerName: customerName.value })
    rows.value = Array.isArray(res.data) && res.data.length > 0 ? res.data : mockRows
  } catch (err) {
    message.error('获取发货单失败')
    console.error('获取发货单失败:', err)
    rows.value = mockRows
  } finally {
    loading.value = false
  }
}

const handleSearch = () => fetchList()
const resetSearch = () => { orderName.value = ''; customerName.value = ''; fetchList() }

const download = async (record: DeliveryNote) => {
  if (record.status && record.status !== 'approved') {
    message.warning('仅审核通过的发货单可下载')
    return
  }
  if (isDownloading(record.id)) {
    return
  }
  downloadingIds.value.add(record.id)
  if (record.file_path) {
    const cleanPath = record.file_path.replace(/^\/+/, '')
    const absolute = record.file_path.startsWith('http')
      ? record.file_path
      : `${API_BASE_CLEAN}/${cleanPath}`
    try {
      window.open(absolute, '_blank')
    } finally {
      // 同步打开快捷结束，立刻清理loading
      downloadingIds.value.delete(record.id)
    }
    return
  }
  // 通过认证接口获取 Blob 并触发下载（避免缺少令牌）
  try {
    const res = await deliveryApi.download(record.id)
    const blob = res.data as Blob
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `delivery_${record.id}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('下载发货单失败:', err)
    message.error('下载失败：请确认已登录且有权限')
  } finally {
    downloadingIds.value.delete(record.id)
  }
}

// 角色判断（从本地存储的用户信息读取）
const userInfoRaw = localStorage.getItem('user_info')
const userInfo = userInfoRaw ? JSON.parse(userInfoRaw) : null
const isFinance = !!userInfo && userInfo.role === 'finance'
const isAdminLike = !!userInfo && (userInfo.role === 'finance' || userInfo.role === 'admin')

// 审核弹窗控制
const auditVisible = ref(false)
const auditTargetId = ref<number | null>(null)
const auditLoading = ref(false)
// 审核详情与明细的显式类型
interface DeliveryAuditItem {
  index?: number
  product_name: string
  material?: string
  spec: string
  length?: string
  quantity: number | string
  unit: string
  unit_weight?: string
  total_weight?: string
  remark?: string
  unit_price?: number
  price?: number
}
interface DeliveryDetail {
  id: number
  order_name: string
  customer_name: string
  delivery_time?: string
  delivery_date?: string
  shipper_name?: string
  shipper_phone?: string
  address?: string
  note?: string
  created_by?: number
  status?: DeliveryNote['status']
  items: DeliveryAuditItem[]
}
const auditDetail = ref<DeliveryDetail | null>(null)
const auditItems = ref<DeliveryAuditItem[]>([])
const openAudit = async (id: number) => {
  auditTargetId.value = id
  auditVisible.value = true
  auditLoading.value = true
  auditDetail.value = null
  auditItems.value = []
  try {
    const res = await deliveryApi.getOne(id)
    const data = (res.data as DeliveryDetail)
    auditDetail.value = data
    const items: DeliveryAuditItem[] = Array.isArray(data.items) ? (data.items as DeliveryAuditItem[]) : []
    auditItems.value = items.map((it, idx) => {
      const indexVal = typeof it.index === 'number' ? it.index : idx + 1
      return {
        ...it,
        index: indexVal,
        unit_price: typeof it.unit_price === 'number' ? it.unit_price : 0,
        price: typeof it.price === 'number' ? it.price : 0,
      }
    })
  } catch (e) {
    console.error('加载发货单详情失败:', e)
    message.error('加载详情失败')
  } finally {
    auditLoading.value = false
  }
}
const closeAudit = () => { auditVisible.value = false; auditTargetId.value = null }
const approve = async () => {
  if (auditTargetId.value == null) return
  try {
    await deliveryApi.updateStatus(auditTargetId.value, 'approved')
    message.success('审核通过')
    closeAudit()
    fetchList()
  } catch (e) {
    console.error(e)
    message.error('审核失败')
  }
}
const reject = async () => {
  if (auditTargetId.value == null) return
  try {
    await deliveryApi.updateStatus(auditTargetId.value, 'rejected')
    message.success('已拒绝')
    closeAudit()
    fetchList()
  } catch (e) {
    console.error(e)
    message.error('操作失败')
  }
}
// 状态标签映射
const statusLabel = (s?: DeliveryNote['status']) => {
  switch (s) {
    case 'draft': return '草稿中'
    case 'pending_review': return '待审核'
    case 'approved': return '审核通过'
    case 'rejected': return '已拒绝'
    default: return '未知'
  }
}
const statusColor = (s?: DeliveryNote['status']) => {
  switch (s) {
    case 'draft': return 'default'
    case 'pending_review': return 'orange'
    case 'approved': return 'green'
    case 'rejected': return 'red'
    default: return 'default'
  }
}

// 审核弹窗：明细表格列
const auditColumns = [
  { title: '商品名称', dataIndex: 'product_name', key: 'product_name' },
  { title: '材质', dataIndex: 'material', key: 'material' },
  { title: '规格', dataIndex: 'spec', key: 'spec' },
  { title: '长度', dataIndex: 'length', key: 'length' },
  { title: '数量', dataIndex: 'quantity', key: 'quantity' },
  { title: '单位', dataIndex: 'unit', key: 'unit' },
  { title: '单重', dataIndex: 'unit_weight', key: 'unit_weight' },
  { title: '总重', dataIndex: 'total_weight', key: 'total_weight' },
  { title: '备注', dataIndex: 'remark', key: 'remark' },
  { title: '单价', dataIndex: 'unit_price', key: 'unit_price' },
  { title: '价格', key: 'price' },
]

// 数字金额转中文大写（人民币）
const numberToChineseUppercase = (n: number): string => {
  // 使用只读元组与常量，索引访问增加安全回退
  const fraction = ['角', '分'] as const
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'] as const
  const unit: readonly [readonly string[], readonly string[]] = (
    [['元', '万', '亿'], ['', '拾', '佰', '仟']]
  ) as const
  const head = n < 0 ? '负' : ''
  n = Math.abs(n)
  let s = ''
  for (let i = 0; i < fraction.length; i++) {
    const d = digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] ?? ''
    const f = fraction[i] ?? ''
    s += (d + f).replace(/零./, '')
  }
  s = s || '整'
  let integer = Math.floor(n)
  for (let i = 0; i < unit[0].length && integer > 0; i++) {
    let p = ''
    const smallUnits = unit[1]
    const bigUnits = unit[0]
    for (let j = 0; j < smallUnits.length && integer > 0; j++) {
      const digitChar = digit[integer % 10] ?? ''
      const small = smallUnits[j] ?? ''
      p = digitChar + small + p
      integer = Math.floor(integer / 10)
    }
    s = p.replace(/(零.)+/g, '零').replace(/零+$/, '') + (bigUnits[i] ?? '') + s
  }
  const result = head + s
  return result
    .replace(/(零元)/, '元')
    .replace(/(零.)+/g, '零')
    .replace(/^元$/, '零元')
}

// 价格总计与大写
// 解析总重（优先 total_weight；缺失时用 unit_weight × quantity）
const parseNumber = (v: unknown): number => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const getItemTotalWeight = (it: { total_weight?: string; unit_weight?: string; quantity?: number | string }): number => {
  const total = parseNumber(it.total_weight)
  if (total > 0) return total
  const unit = parseNumber(it.unit_weight)
  const qty = typeof it.quantity === 'number' ? it.quantity : parseNumber(it.quantity)
  return unit > 0 && qty > 0 ? unit * qty : 0
}
const onUnitPriceChange = (item: { unit_price?: number; total_weight?: string; unit_weight?: string; quantity?: number | string; price?: number }, val: number | string) => {
  const unit = typeof val === 'number' ? val : parseNumber(val)
  item.unit_price = unit
  const weight = getItemTotalWeight(item)
  item.price = Number.isFinite(unit) && Number.isFinite(weight) ? unit * weight : 0
}
const totalPrice = computed(() => {
  return auditItems.value.reduce((sum, it) => {
    const v = typeof it.price === 'number' ? it.price : parseFloat(String(it.price ?? '0'))
    return sum + (Number.isFinite(v) ? v : 0)
  }, 0)
})
const totalPriceUppercase = computed(() => numberToChineseUppercase(totalPrice.value))

// 生成结算单可用性：所有行单价已填写，且不全为 0（至少一项>0）
const canGenerateSettlement = computed(() => {
  if (!auditDetail.value || auditItems.value.length === 0) return false
  const allFilled = auditItems.value.every(it => typeof it.unit_price === 'number' && !Number.isNaN(it.unit_price))
  const someNonZero = auditItems.value.some(it => Number(it.unit_price || 0) > 0)
  return allFilled && someNonZero
})

// 生成/覆盖结算单（保持弹窗打开）
const generateSettlement = async () => {
  if (!auditDetail.value) return
  try {
    const deliveryDate = auditDetail.value.delivery_date || String(auditDetail.value.delivery_time || '').slice(0, 10)
    const payload = {
      delivery_id: auditDetail.value.id,
      order_name: auditDetail.value.order_name,
      customer_name: auditDetail.value.customer_name,
      delivery_date: deliveryDate,
      address: auditDetail.value.address || '',
      shipper_name: auditDetail.value.shipper_name || '',
      items: auditItems.value.map(it => ({
        index: typeof it.index === 'number' ? it.index : undefined,
        product_name: it.product_name,
        material: it.material || '',
        spec: it.spec,
        length: it.length || '',
        quantity: it.quantity,
        unit: it.unit,
        unit_weight: it.unit_weight || '',
        total_weight: it.total_weight || '',
        remark: it.remark || '',
        unit_price: it.unit_price || 0,
        price: it.price || 0,
      })),
      total_price: Number(totalPrice.value || 0),
    }
    const res = await settlementsApi.upsert(payload)
    const data = res.data as unknown
    const id = typeof (data as Record<string, unknown>).id === 'number'
      ? (data as { id: number }).id
      : undefined
    message.success(id ? `结算单已生成（ID: ${id}）` : '结算单已生成')
  } catch (err) {
    console.error('生成结算单失败:', err)
    message.error('生成结算单失败，请检查权限或网络')
  }
}

onMounted(fetchList)
</script>

<style scoped>
.page-container { padding: 16px; }
.page-header h2 { margin: 0; }
.toolbar { margin-bottom: 12px; display: flex; justify-content: space-between; }
.audit-content { display: flex; flex-direction: column; gap: 12px; }
.info-block { background: #fafafa; border: 1px solid #f0f0f0; border-radius: 8px; padding: 12px 16px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 16px; row-gap: 8px; }
.info-row { line-height: 24px; font-size: 13px; color: #444; }
.summary { text-align: right; background: #fff; border-top: 1px dashed #e8e8e8; padding-top: 8px; }
.audit-content :deep(.ant-table-thead > tr > th) { background-color: #f7f7f9; }
.audit-content :deep(.ant-table) { border-radius: 8px; }
/* 放大弹窗标题字体 */
:deep(.ant-modal-title) { font-size: 22px; font-weight: 600; }
/* 总价格与价格大写加大并高亮 */
.summary .summary-total { font-size: 20px; color: #cf1322; font-weight: 600; }
.summary .summary-uppercase { font-size: 18px; color: #cf1322; }
</style>

<style scoped>
/* 暗色模式覆盖 */
:global(.layout.dark) .page-container .info-block {
  background: #1a1a1a;
  border-color: #303030;
}
:global(.layout.dark) .page-container .info-row { color: #d9d9d9; }
:global(.layout.dark) .page-container .summary {
  background: #1a1a1a;
  border-top-color: #303030;
}
:global(.layout.dark) .page-container :deep(.ant-modal-content) {
  background: #1a1a1a;
}
</style>
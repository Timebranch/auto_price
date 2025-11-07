<template>
  <div class="page" style="padding: 16px;">
    <div class="toolbar" style="display: flex; gap: 8px; margin-bottom: 12px;">
      <a-input v-model:value="orderName" placeholder="项目名称" style="width: 200px;" />
      <a-input v-model:value="customerName" placeholder="客户名称" style="width: 200px;" />
      <a-input v-model:value="shipperName" placeholder="发货人" style="width: 200px;" />
      <a-button type="primary" :loading="loading" @click="fetchList">搜索</a-button>
    </div>

    <a-table
      :loading="loading"
      :data-source="rows"
      :pagination="{ pageSize: 10 }"
      row-key="id"
    >
      <a-table-column title="项目名称" dataIndex="order_name" key="order_name" />
      <a-table-column title="客户名称" dataIndex="customer_name" key="customer_name" />
      <a-table-column title="发货日期" dataIndex="delivery_date" key="delivery_date" />
      <a-table-column title="送货地址" dataIndex="address" key="address" />
      <a-table-column title="发货人" dataIndex="shipper_name" key="shipper_name" />
      <a-table-column title="操作" key="action"
        :customRender="({ record }) => h(Button, { type: 'primary', size: 'small', onClick: () => openDetail(record.id) }, '查看')"
      />
    </a-table>

    <!-- 详情 Modal：展示为审核发货单样式，内容不可编辑 -->
    <a-modal v-model:open="detailOpen" title="结算单详情" :footer="null" width="900px">
      <div ref="printArea" class="settlement-detail">
        <div style="text-align: center; margin-bottom: 8px; font-weight: bold; font-size: 18px;">天津光大钢铁有限公司 结算单</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
          <div>项目名称：{{ detail?.order_name }}</div>
          <div>客户名称：{{ detail?.customer_name }}</div>
          <div>发货日期：{{ detail?.delivery_date }}</div>
          <div>送货地址：{{ detail?.address || '-' }}</div>
          <div>发货人：{{ detail?.shipper_name || '-' }}</div>
          <div>发货单ID：{{ detail?.delivery_id }}</div>
        </div>

        <a-table
          :data-source="detailItems"
          :pagination="false"
          size="small"
          row-key="index"
        >
          <a-table-column title="序号" key="index" :customRender="({ index }) => index + 1" />
          <a-table-column title="品名" dataIndex="product_name" key="product_name" />
          <a-table-column title="材质" dataIndex="material" key="material" />
          <a-table-column title="规格" dataIndex="spec" key="spec" />
          <a-table-column title="数量" dataIndex="quantity" key="quantity" />
          <a-table-column title="单位" dataIndex="unit" key="unit" />
          <a-table-column title="单价" key="unit_price" :customRender="({ record }) => formatMoney(record.unit_price)" />
          <a-table-column title="金额" key="price" :customRender="({ record }) => formatMoney(record.price)" />
          <a-table-column title="备注" dataIndex="remark" key="remark" />
        </a-table>

        <div style="text-align: right; margin-top: 12px;">
          <div>总价格：{{ formatMoney(detail?.total_price || 0) }}</div>
          <div style="margin-top: 4px;">价格大写：{{ totalPriceUppercase }}</div>
        </div>
      </div>

      <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
        <a-button @click="detailOpen = false">关闭</a-button>
        <a-button type="primary" @click="downloadPdf" :loading="downloading" :disabled="downloading">下载</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted, computed } from 'vue'
import { Button } from 'ant-design-vue'
import settlementsApi, { type SettlementListRow, type SettlementDetail, type SettlementItem } from '@/api/settlements'
import { message } from 'ant-design-vue'

const orderName = ref('')
const customerName = ref('')
const shipperName = ref('')
const loading = ref(false)
const rows = ref<SettlementListRow[]>([])

const detailOpen = ref(false)
const detail = ref<SettlementDetail | null>(null)
const printArea = ref<HTMLElement | null>(null)
const downloading = ref(false)

const formatMoney = (n: number) => {
  const num = Number(n || 0)
  return num.toFixed(2)
}

// 金额转中文大写（人民币）
const numberToChineseUppercase = (n: number): string => {
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

const totalPrice = computed(() => {
  const detailTotal = Number(detail.value?.total_price || 0)
  if (Number.isFinite(detailTotal) && detailTotal > 0) return detailTotal
  const sum = detailItems.value.reduce((acc, it) => acc + (Number(it.price) || 0), 0)
  return Number.isFinite(sum) ? sum : 0
})
const totalPriceUppercase = computed(() => numberToChineseUppercase(totalPrice.value))

interface SettlementItemRow {
  index: number
  product_name: string
  material: string
  spec: string
  quantity: number | string
  unit: string
  unit_price: number
  price: number
  remark: string
}
const detailItems = ref<SettlementItemRow[]>([])

const fetchList = async () => {
  loading.value = true
  try {
    const { data } = await settlementsApi.list({ orderName: orderName.value, customerName: customerName.value, shipperName: shipperName.value })
    rows.value = data
  } catch (err) {
    console.error(err)
    message.error('获取结算单列表失败')
  } finally {
    loading.value = false
  }
}

const openDetail = async (id: number) => {
  try {
    const { data } = await settlementsApi.getOne(id)
    detail.value = data
    const items = Array.isArray(data.items) ? data.items : []
    detailItems.value = items.map((it: SettlementItem, idx: number) => ({
      index: idx + 1,
      product_name: it.product_name,
      material: it.material || '',
      spec: it.spec || '',
      quantity: it.quantity,
      unit: it.unit,
      unit_price: Number(it.unit_price || 0),
      price: Number(it.price || 0),
      remark: it.remark || ''
    }))
    detailOpen.value = true
  } catch (err) {
    console.error(err)
    message.error('获取结算单详情失败')
  }
}

const downloadPdf = async () => {
  try {
    const id = detail.value?.id
    if (!id) return
    downloading.value = true
    const res = await settlementsApi.download(id)
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safe = (s: unknown) => String(s ?? '')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
    const filename = `${safe(detail.value?.order_name)}_${safe(detail.value?.customer_name)}_${safe(detail.value?.delivery_date)}_${safe(detail.value?.delivery_id)}.pdf`
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error(err)
    message.error('下载失败：请确认已登录且有权限')
  } finally {
    downloading.value = false
  }
}

onMounted(fetchList)
</script>

<style scoped>
.page { background: #fff; }
</style>

<style scoped>
/* 暗色模式覆盖：页面与弹窗内容 */
:global(.layout.dark) .page { background: #141414; }
:global(.layout.dark) :deep(.ant-modal-content) { background: #1a1a1a; border-color: #303030; }
:global(.layout.dark) .settlement-detail { color: #e8e8e8; }
</style>
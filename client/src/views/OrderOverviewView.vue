<template>
  <div class="order-overview">
    <!-- 筛选区：日期范围 + 订单名称搜索 -->
    <div class="filters">
      <a-space wrap>
        <a-range-picker v-model:value="dateRange" :allowClear="false" />
        <a-input-search v-model:value="searchText" placeholder="按订单名称筛选" style="width: 260px" allowClear />
      </a-space>
    </div>

    <!-- 汇总卡片：当月进行中/已完成/有风险 -->
    <div class="summary">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-card>
            <a-statistic title="当月进行中的订单" :value="inProgressCount" />
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card>
            <a-statistic title="当月已完成的订单" :value="completedCount" />
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card>
            <a-statistic title="当月有风险的订单" :value="riskCount" />
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 工作联系单列表 -->
    <a-card title="工作联系单">
      <a-table :columns="liaisonColumns" :data-source="filteredLiaisons" row-key="id" :pagination="{ pageSize: 8 }" />
    </a-card>

    <!-- 发运列表 -->
    <a-card title="发运列表" style="margin-top: 16px;">
      <a-table :columns="deliveryColumns" :data-source="filteredDeliveries" row-key="id" :pagination="{ pageSize: 8 }" />
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import dayjs, { Dayjs } from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
import { useAuthStore } from '@/stores/auth'

type Role = 'admin' | 'sales' | 'production_lead' | 'production_manager' | 'storekeeper' | 'user'

interface Order {
  id: number
  name: string
  customer: string
  createdBy: string // 用户名或ID字符串
  createdAt: string // YYYY-MM-DD
  status: 'in_progress' | 'completed'
  risk: 'none' | 'warning' | 'danger'
}

interface Liaison {
  id: number
  orderId: number
  orderName: string
  date: string // YYYY-MM-DD
  status: 'open' | 'closed'
  note: string
}

interface Delivery {
  id: number
  orderId: number
  orderName: string
  date: string // YYYY-MM-DD
  status: 'scheduled' | 'shipped' | 'delivered'
  quantity: number
  destination: string
}

const authStore = useAuthStore()

// 日期范围：默认当月
const dateRange = ref<[Dayjs, Dayjs]>([
  dayjs().startOf('month'),
  dayjs().endOf('month')
])
const searchText = ref('')

// 示例订单数据（后续替换为接口数据）
const orders = ref<Order[]>([
  { id: 1, name: '订单 A2025-001', customer: '天津光大钢铁有限公司', createdBy: 'sales_zhang', createdAt: dayjs().subtract(1, 'day').format('YYYY-MM-DD'), status: 'in_progress', risk: 'warning' },
  { id: 2, name: '订单 A2025-002', customer: '河北XX金属', createdBy: 'production_wang', createdAt: dayjs().subtract(10, 'day').format('YYYY-MM-DD'), status: 'completed', risk: 'none' },
  { id: 3, name: '订单 A2025-003', customer: '山西YY制造', createdBy: 'sales_zhang', createdAt: dayjs().add(2, 'day').format('YYYY-MM-DD'), status: 'in_progress', risk: 'danger' },
  { id: 4, name: '订单 A2025-004', customer: '上海ZZ工厂', createdBy: 'production_li', createdAt: dayjs().format('YYYY-MM-DD'), status: 'completed', risk: 'none' }
])

// 示例联系单与发运数据（与订单绑定）
const liaisons = ref<Liaison[]>([
  { id: 11, orderId: 1, orderName: '订单 A2025-001', date: dayjs().format('YYYY-MM-DD'), status: 'open', note: '与客户确认材料规格' },
  { id: 12, orderId: 3, orderName: '订单 A2025-003', date: dayjs().subtract(3, 'day').format('YYYY-MM-DD'), status: 'closed', note: '生产线调整完成' },
  { id: 13, orderId: 2, orderName: '订单 A2025-002', date: dayjs().subtract(8, 'day').format('YYYY-MM-DD'), status: 'closed', note: '完成收尾工作' }
])

const deliveries = ref<Delivery[]>([
  { id: 21, orderId: 1, orderName: '订单 A2025-001', date: dayjs().add(1, 'day').format('YYYY-MM-DD'), status: 'scheduled', quantity: 120, destination: '天津港' },
  { id: 22, orderId: 3, orderName: '订单 A2025-003', date: dayjs().add(5, 'day').format('YYYY-MM-DD'), status: 'shipped', quantity: 200, destination: '连云港' },
  { id: 23, orderId: 2, orderName: '订单 A2025-002', date: dayjs().subtract(2, 'day').format('YYYY-MM-DD'), status: 'delivered', quantity: 80, destination: '青岛港' }
])

// 角色权限：销售只能看自己创建的订单；生产厂长/主任、管理员可以看全部
const role = computed<Role>(() => (authStore.user?.role as Role) || 'user')
const normalizedRole = computed<Role>(() => (role.value === 'user' ? 'sales' : role.value))
const currentUserKey = computed(() => authStore.user?.username || authStore.user?.id?.toString() || '')

const roleFilteredOrders = computed(() => {
  if (normalizedRole.value === 'sales') {
    return orders.value.filter(o => o.createdBy === currentUserKey.value)
  }
  // 生产与管理员看全部
  if (['production_lead', 'production_manager', 'admin', 'finance'].includes(normalizedRole.value)) {
    return orders.value
  }
  return []
})

// 全局筛选（日期范围 + 订单名称）
const inRange = (d: string) => {
  const date = dayjs(d)
  return date.isSameOrAfter(dateRange.value[0], 'day') && date.isSameOrBefore(dateRange.value[1], 'day')
}
const nameMatch = (name: string) => name.toLowerCase().includes(searchText.value.trim().toLowerCase())

const filteredOrders = computed(() => roleFilteredOrders.value.filter(o => inRange(o.createdAt) && nameMatch(o.name)))

// 汇总统计
const inProgressCount = computed(() => filteredOrders.value.filter(o => o.status === 'in_progress').length)
const completedCount = computed(() => filteredOrders.value.filter(o => o.status === 'completed').length)
const riskCount = computed(() => filteredOrders.value.filter(o => o.risk !== 'none').length)

// 绑定列表筛选（基于订单 + 日期范围 + 名称匹配）
const allowedOrderIds = computed(() => new Set(filteredOrders.value.map(o => o.id)))
const filteredLiaisons = computed(() => liaisons.value.filter(l => allowedOrderIds.value.has(l.orderId) && inRange(l.date) && nameMatch(l.orderName)))
const filteredDeliveries = computed(() => deliveries.value.filter(d => allowedOrderIds.value.has(d.orderId) && inRange(d.date) && nameMatch(d.orderName)))

// 表格列
const liaisonColumns = [
  { title: '订单名称', dataIndex: 'orderName', key: 'orderName' },
  { title: '日期', dataIndex: 'date', key: 'date' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '备注', dataIndex: 'note', key: 'note' }
]

const deliveryColumns = [
  { title: '订单名称', dataIndex: 'orderName', key: 'orderName' },
  { title: '日期', dataIndex: 'date', key: 'date' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '数量', dataIndex: 'quantity', key: 'quantity' },
  { title: '目的地', dataIndex: 'destination', key: 'destination' }
]


onMounted(() => {
  // 若需要从后端加载订单、联系单、发运数据，可在此处触发 API 并填充上述列表
  authStore.fetchCurrentUser?.().catch(() => {})
})
</script>

<style scoped>
.order-overview { padding: 16px; }
.filters { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.summary { margin-bottom: 16px; }
</style>
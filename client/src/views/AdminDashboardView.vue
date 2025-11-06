<template>
  <div class="admin-dashboard">
    <a-tabs v-model:activeKey="activeTab">
      <a-tab-pane key="overview" tab="订单总览">
        <div class="cards">
          <a-card v-for="order in orders" :key="order.id" class="order-card" :title="order.title" :bordered="true">
            <template #extra>
              <a-tag :color="statusColor(order)">{{ order.stage }} · {{ order.status }}</a-tag>
            </template>
            <div class="row">
              <span>客户：</span><strong>{{ order.customer }}</strong>
            </div>
            <div class="row">
              <span>计划节点：</span>
              <a-progress :percent="order.progress" size="small" />
            </div>
            <div class="row">
              <span>风险：</span>
              <a-badge :status="riskStatus(order)" :text="riskText(order)" />
            </div>
          </a-card>
        </div>
      </a-tab-pane>
      <a-tab-pane key="alerts" tab="风险报警">
        <a-alert v-if="alerts.length === 0" message="暂无风险" type="success" show-icon />
        <a-list v-else :data-source="alerts" bordered>
          <template #renderItem="{ item }">
            <a-list-item>
              <a-badge status="error" />
              <span class="alert-text">【{{ item.orderTitle }}】 {{ item.message }}</span>
            </a-list-item>
          </template>
        </a-list>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

type OrderStage = '报价' | '合同' | '排产' | '生产' | '发运' | '质检'
interface OrderCard {
  id: number
  title: string
  customer: string
  stage: OrderStage
  status: '按期' | '延期'
  progress: number
  dueDate: string // YYYY-MM-DD
}

const activeTab = ref('overview')

// 示例订单数据（后续替换为接口返回）
const orders = ref<OrderCard[]>([
  { id: 1, title: '订单 A2025-001', customer: '天津光大钢铁有限公司', stage: '排产', status: '按期', progress: 45, dueDate: '2025-11-01' },
  { id: 2, title: '订单 A2025-002', customer: '河北XX金属', stage: '生产', status: '延期', progress: 60, dueDate: '2025-10-20' },
  { id: 3, title: '订单 A2025-003', customer: '山西YY制造', stage: '合同', status: '按期', progress: 20, dueDate: '2025-12-05' }
])

const today = new Date()

const statusColor = (o: OrderCard) => (o.status === '按期' ? 'green' : 'red')
const riskStatus = (o: OrderCard) => (o.status === '按期' ? 'success' : 'error')
const riskText = (o: OrderCard) => {
  const d = new Date(o.dueDate)
  const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (o.status === '延期') return `节点逾期 ${Math.abs(days)} 天`
  if (days <= 3) return `节点临近（${days} 天）`
  return '正常'
}

const alerts = computed(() => {
  return orders.value
    .map(o => ({ orderTitle: o.title, message: riskText(o), status: o.status }))
    .filter(a => a.status === '延期' || a.message.includes('临近'))
})
</script>

<style scoped>
.admin-dashboard { padding: 16px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.order-card .row { margin: 6px 0; display: flex; align-items: center; gap: 6px; }
.alert-text { margin-left: 8px; }
</style>
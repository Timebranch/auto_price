<template>
  <div class="home">
    <!-- 顶部欢迎区 -->
<div class="hero">
  <div class="hero-content">
    <div class="hero-title">欢迎使用光大协同办公系统</div>
    <div class="hero-sub">请选择常用模块进行工作</div>
  </div>
  <div class="hero-actions">
    <a-space>
      <a-button type="primary" @click="go('/quotes')">快速进入报价单</a-button>
      <a-button @click="go('/technical-tasks')">快速进入技术任务单</a-button>
    </a-space>
  </div>
</div>

    <!-- 模块入口：基于角色显示 -->
    <div class="modules">
  <a-row :gutter="16">
    <a-col v-if="canSeeQuotes" :xs="24" :sm="12" :md="8">
      <a-card class="app-card quotes" :hoverable="true" :bordered="false" @click="go('/quotes')">
        <div class="app-card-body">
          <div class="app-card-icon"><FileTextOutlined /></div>
          <div class="app-card-meta">
            <div class="app-card-title">报价单</div>
            <div class="app-card-desc">管理与查看报价，支持新建与编辑</div>
          </div>
        </div>
        <div class="app-card-actions">
          <a-space>
            <a-button type="primary" @click.stop="go('/quotes')">进入列表</a-button>
            <a-button ghost @click.stop="go('/quotes/create')">新建报价</a-button>
          </a-space>
        </div>
      </a-card>
    </a-col>

    <a-col v-if="canSeeDelivery" :xs="24" :sm="12" :md="8">
      <a-card class="app-card delivery" :hoverable="true" :bordered="false" @click="go('/delivery')">
        <div class="app-card-body">
          <div class="app-card-icon"><FileOutlined /></div>
          <div class="app-card-meta">
            <div class="app-card-title">发货单</div>
            <div class="app-card-desc">查看与生成发货单，支持下载</div>
          </div>
        </div>
        <div class="app-card-actions">
          <a-space>
            <a-button type="primary" @click.stop="go('/delivery')">进入列表</a-button>
            <a-button ghost @click.stop="go('/delivery/create')">新建发货单</a-button>
          </a-space>
        </div>
      </a-card>
    </a-col>

    <a-col v-if="isAdminOrFinance" :xs="24" :sm="12" :md="8">
      <a-card class="app-card settlements" :hoverable="true" :bordered="false" @click="go('/settlements')">
        <div class="app-card-body">
          <div class="app-card-icon"><CheckCircleOutlined /></div>
          <div class="app-card-meta">
            <div class="app-card-title">结算单</div>
            <div class="app-card-desc">对账与结算管理，仅管理员/财务可用</div>
          </div>
        </div>
        <div class="app-card-actions">
          <a-button type="primary" @click.stop="go('/settlements')">进入列表</a-button>
        </div>
      </a-card>
    </a-col>

    <a-col v-if="canSeeTechnical" :xs="24" :sm="12" :md="8">
      <a-card class="app-card technical" :hoverable="true" :bordered="false" @click="go('/technical-tasks')">
        <div class="app-card-body">
          <div class="app-card-icon"><UnorderedListOutlined /></div>
          <div class="app-card-meta">
            <div class="app-card-title">技术任务单</div>
            <div class="app-card-desc">创建与跟进技术任务，支持协作卡下载</div>
          </div>
        </div>
        <div class="app-card-actions">
          <a-space>
            <a-button type="primary" @click.stop="go('/technical-tasks')">进入列表</a-button>
            <a-button ghost @click.stop="go('/technical-tasks/create')">新建任务</a-button>
          </a-space>
        </div>
      </a-card>
    </a-col>

    <a-col v-if="canSeeKnowledge" :xs="24" :sm="12" :md="8">
      <a-card class="app-card knowledge" :hoverable="true" :bordered="false" @click="go('/knowledge')">
        <div class="app-card-body">
          <div class="app-card-icon"><ReadOutlined /></div>
          <div class="app-card-meta">
            <div class="app-card-title">知识库</div>
            <div class="app-card-desc">常用资料沉淀与检索，支持多角色访问</div>
          </div>
        </div>
        <div class="app-card-actions">
          <a-button type="primary" @click.stop="go('/knowledge')">进入知识库</a-button>
        </div>
      </a-card>
    </a-col>
      </a-row>
    </div>

    <!-- 趋势图表：基于角色显示所需模块的时间趋势 -->
    <div class="trends">
      <a-row :gutter="16">
        <a-col v-if="canSeeQuotes" :xs="24" :sm="12" :md="12">
          <a-card :bordered="false" class="trend-card">
            <TrendsChart title="报价单 · 最近30天" :dates="quotesDates" color="#fa8c16" :rangeDays="30" />
          </a-card>
        </a-col>
        <a-col v-if="canSeeDelivery" :xs="24" :sm="12" :md="12">
          <a-card :bordered="false" class="trend-card">
            <TrendsChart title="发货单 · 最近30天" :dates="deliveryDates" color="#1890ff" :rangeDays="30" />
          </a-card>
        </a-col>
        <a-col v-if="canSeeTechnical" :xs="24" :sm="12" :md="12">
          <a-card :bordered="false" class="trend-card">
            <TrendsChart title="技术任务 · 最近30天" :dates="technicalDates" color="#2f54eb" :rangeDays="30" />
          </a-card>
        </a-col>
        <a-col v-if="isAdminOrFinance" :xs="24" :sm="12" :md="12">
          <a-card :bordered="false" class="trend-card">
            <TrendsChart title="结算单 · 最近30天" :dates="settlementDates" color="#52c41a" :rangeDays="30" />
          </a-card>
        </a-col>
      </a-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { FileTextOutlined, FileOutlined, CheckCircleOutlined, UnorderedListOutlined, ReadOutlined } from '@ant-design/icons-vue'
import TrendsChart from '@/components/TrendsChart.vue'
import { quoteApi } from '@/api/quote'
import deliveryApi from '@/api/delivery'
import type { DeliveryNote } from '@/api/delivery'
import { technicalTasksApi } from '@/api/technicalTasks'
import settlementsApi from '@/api/settlements'

const router = useRouter()
const authStore = useAuthStore()
const role = computed(() => authStore.user?.role || 'user')
const isAdminOrFinance = computed(() => role.value === 'admin' || role.value === 'finance')
const canSeeQuotes = computed(() => ['admin', 'finance', 'sales', 'technician', 'user'].includes(role.value))
const canSeeDelivery = computed(() => ['admin', 'finance', 'sales', 'technician', 'user'].includes(role.value))
const canSeeTechnical = computed(() => ['admin', 'sales', 'technician'].includes(role.value) || role.value === 'user')
const canSeeKnowledge = computed(() => ['admin', 'finance', 'sales', 'technician'].includes(role.value))

const go = (path: string) => router.push(path)

// 图表数据源（按日聚合使用 created_at/本地时间字段）
const quotesDates = ref<string[]>([])
const deliveryDates = ref<string[]>([])
const technicalDates = ref<string[]>([])
const settlementDates = ref<string[]>([])

onMounted(async () => {
  const tasks: Promise<void>[] = []
  if (canSeeQuotes.value) {
    tasks.push(
      quoteApi.getQuoteRecords().then(({ data }) => {
        quotesDates.value = (data || []).map(r => (r.created_at_local || r.created_at))
      }).catch(() => { quotesDates.value = [] })
    )
  }
  if (canSeeDelivery.value) {
    tasks.push(
      deliveryApi.list().then(({ data }) => {
        deliveryDates.value = (data || []).map((r: DeliveryNote) => r.created_at || r.delivery_time)
      }).catch(() => { deliveryDates.value = [] })
    )
  }
  if (canSeeTechnical.value) {
    tasks.push(
      technicalTasksApi.list().then((data) => {
        technicalDates.value = (data || []).map(r => r.created_at)
      }).catch(() => { technicalDates.value = [] })
    )
  }
  if (isAdminOrFinance.value) {
    tasks.push(
      settlementsApi.list().then(({ data }) => {
        settlementDates.value = (data || []).map(r => r.created_at)
      }).catch(() => { settlementDates.value = [] })
    )
  }
  await Promise.all(tasks).catch(() => {})
})
</script>

<style scoped>
.home { display: flex; flex-direction: column; gap: 16px; }
.hero { background: #fff; border-radius: 14px; box-shadow: 0 8px 20px rgba(0,0,0,0.06); border: 1px solid #f0f0f0; }
.hero-content { padding: 20px 24px; }
.hero-title { font-size: 22px; font-weight: 700; color: #1f1f1f; }
.hero-sub { margin-top: 6px; color: #666; }
.hero-actions { padding: 0 24px 18px; }

.modules { padding: 8px 6px; }
.feature-card { border-radius: 12px; box-shadow: 0 6px 18px rgba(0,0,0,0.06); transition: transform 0.18s ease, box-shadow 0.18s ease; }
.feature-card { margin: 6px; background: #fff; border: 1px solid #f0f0f0; }
.feature-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,0.08); }
.feature { display: flex; align-items: center; gap: 14px; padding: 12px 14px; }
.feature-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #fafafa; box-shadow: inset 0 1px 2px rgba(0,0,0,0.04); }
.feature-info { flex: 1; }
.feature-title { font-size: 16px; font-weight: 700; color: #1f1f1f; }
.feature-desc { color: #595959; margin: 6px 0 10px; }
.module-header { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.module-desc { color: #595959; margin-bottom: 12px; }
.quotes .feature-icon { color: #fa8c16; }
.quotes.feature-card { background: linear-gradient(180deg, rgba(250,140,22,0.06), #fff); }
.delivery .feature-icon { color: #1890ff; }
.delivery.feature-card { background: linear-gradient(180deg, rgba(24,144,255,0.06), #fff); }
.settlements .feature-icon { color: #52c41a; }
.settlements.feature-card { background: linear-gradient(180deg, rgba(82,196,26,0.08), #fff); }
.technical .feature-icon { color: #2f54eb; }
.technical.feature-card { background: linear-gradient(180deg, rgba(47,84,235,0.06), #fff); }
.knowledge .feature-icon { color: #722ed1; }
.knowledge.feature-card { background: linear-gradient(180deg, rgba(114,46,209,0.06), #fff); }
/* 新版应用卡片样式 */
.app-card { border-radius: 12px; margin: 6px; cursor: pointer; background: #fff; border: 1px solid #f0f0f0; box-shadow: 0 6px 18px rgba(0,0,0,0.06); transition: transform 0.18s ease, box-shadow 0.18s ease; }
.app-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,0.08); }
.app-card-body { display: flex; align-items: center; gap: 14px; padding: 14px 14px 10px; }
.app-card-icon { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: #fafafa; box-shadow: inset 0 1px 2px rgba(0,0,0,0.04); font-size: 28px; }
.app-card-meta { flex: 1; }
.app-card-title { font-size: 18px; font-weight: 700; color: #1f1f1f; }
.app-card-desc { color: #595959; margin: 6px 0 0; }
.app-card-actions { padding: 0 14px 14px; }
.quotes .app-card-icon { color: #fa8c16; }
.quotes.app-card { background: linear-gradient(180deg, rgba(250,140,22,0.06), #fff); }
.delivery .app-card-icon { color: #1890ff; }
.delivery.app-card { background: linear-gradient(180deg, rgba(24,144,255,0.06), #fff); }
.settlements .app-card-icon { color: #52c41a; }
.settlements.app-card { background: linear-gradient(180deg, rgba(82,196,26,0.08), #fff); }
.technical .app-card-icon { color: #2f54eb; }
.technical.app-card { background: linear-gradient(180deg, rgba(47,84,235,0.06), #fff); }
.knowledge .app-card-icon { color: #722ed1; }
.knowledge.app-card { background: linear-gradient(180deg, rgba(114,46,209,0.06), #fff); }
/* 趋势图表区块 */
.trends { padding: 8px 6px; }
.trend-card { border-radius: 12px; margin: 6px; background: #fff; border: 1px solid #f0f0f0; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
</style>

<style scoped>
/* 暗色模式适配（依赖 App.vue 布局的 .layout.dark 类） */
:global(.layout.dark) .home .hero {
  background: #1a1a1a;
  border-color: #303030;
}
:global(.layout.dark) .home .hero h1,
:global(.layout.dark) .home .hero p {
  color: #e8e8e8;
}

:global(.layout.dark) .home .app-card {
  background: #1a1a1a;
  border-color: #303030;
  box-shadow: none;
}
:global(.layout.dark) .home .app-card-title { color: #e8e8e8; }
:global(.layout.dark) .home .app-card-desc { color: #bfbfbf; }

/* 趋势图卡片与容器 */
:global(.layout.dark) .home .trend-section {
  background: #1a1a1a;
  border-color: #303030;
}
:global(.layout.dark) .home .trend-card {
  background: #1a1a1a;
  border-color: #303030;
}
:global(.layout.dark) .home .trend-card-title { color: #e8e8e8; }

/* 其它列表或统计卡片统一暗色底色 */
:global(.layout.dark) .home :deep(.ant-card) { background: #1a1a1a; }
:global(.layout.dark) .home :deep(.ant-statistic-title) { color: #bfbfbf; }
:global(.layout.dark) .home :deep(.ant-statistic-content) { color: #e8e8e8; }

/* 亮色下：卡片内幽灵按钮默认使用 hover 样式（覆盖真实类名） */
.home .app-card-actions :deep(.ant-btn-background-ghost),
.home .app-card-actions :deep(.ant-btn-ghost) {
  color: #fa8c16 !important;
  border-color: #fa8c16 !important;
  background: #ffffff !important;
}
.home .app-card-actions :deep(.ant-btn-background-ghost:hover),
.home .app-card-actions :deep(.ant-btn-ghost:hover) {
  color: #fa8c16 !important;
  border-color: #fa8c16 !important;
  background: #ffffff !important;
}

/* 暗色下：卡片内幽灵按钮默认使用 hover 样式（覆盖真实类名） */
:global(.layout.dark) .home .app-card-actions :deep(.ant-btn-background-ghost),
:global(.layout.dark) .home .app-card-actions :deep(.ant-btn-ghost) {
  color: #fa8c16 !important;
  border-color: #fa8c16 !important;
  background: #ffffff !important;
}
:global(.layout.dark) .home .app-card-actions :deep(.ant-btn-background-ghost:hover),
:global(.layout.dark) .home .app-card-actions :deep(.ant-btn-ghost:hover) {
  color: #fa8c16 !important;
  border-color: #fa8c16 !important;
  background: #ffffff !important;
}
</style>

<template>
  <div class="analysis-container">
    <div class="filters">
      <a-space>
        <a-select
          v-model:value="selectedUserId"
          allow-clear
          placeholder="筛选销售人员"
          style="min-width: 220px"
          :options="userOptions"
          @change="onUserChange"
        />
        <a-range-picker
          v-model:value="dateRange"
          @change="onRangeChange"
          style="min-width: 320px"
        />
        <a-button type="primary" @click="refresh">刷新</a-button>
      </a-space>
    </div>
    <div class="chart" ref="chartRef"></div>

    <div v-if="selectedUserId" class="user-quotes">
      <div class="subheader">
        <span>所选销售的报价单列表</span>
      </div>
      <a-table :data-source="userQuoteRows" :columns="quoteColumns" row-key="id" :loading="loadingQuotes" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import dayjs, { Dayjs } from 'dayjs'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
dayjs.extend(isSameOrBefore)
import * as echarts from 'echarts'
import type { LineSeriesOption, EChartsOption } from 'echarts'
import { analyticsApi, type SalesDailyRow, type UserQuotesRecord } from '@/api/analytics'
import adminApi, { type AdminUser } from '@/api/admin'
import { message } from 'ant-design-vue'

// 日期范围：默认最近一个月（含今天）
const dateRange = ref<[Dayjs, Dayjs]>([dayjs().subtract(29, 'day'), dayjs()])
const selectedUserId = ref<number | undefined>(undefined)

// 销售用户选项（role为 sales 或 user）
const salesUsers = ref<AdminUser[]>([])
const userOptions = computed(() => salesUsers.value.map(u => ({ label: `${u.username}`, value: u.id })))

// 图表
const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

// 报表数据缓存
const dailyRows = ref<SalesDailyRow[]>([])
const loadingStats = ref(false)
const loadingQuotes = ref(false)

const quoteColumns = [
  { title: '报价单ID', dataIndex: 'id', key: 'id', width: 100 },
  { title: '标题', dataIndex: 'title', key: 'title' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
]

const userQuoteRows = ref<UserQuotesRecord[]>([])

const fetchUsers = async () => {
  try {
    const res = await adminApi.getUsers()
    salesUsers.value = res.data.filter(u => u.role === 'sales' || u.role === 'user')
  } catch {
    message.error('获取销售人员失败')
  }
}

const toDateStr = (d: Dayjs) => d.format('YYYY-MM-DD')

// 标题与描述（用于 ECharts 内置标题）以及图表颜色
const selectedUser = computed(() => selectedUserId.value ? salesUsers.value.find(u => u.id === selectedUserId.value) : undefined)
const chartTitleText = computed(() => selectedUser.value ? `${selectedUser.value.username} 每日报价数量` : '销售人员每日报价总计')
const chartSubText = computed(() => `${toDateStr(dateRange.value[0])} 至 ${toDateStr(dateRange.value[1])}`)
const chartColors = computed(() => selectedUser.value ? ['#1890ff', '#fa8c16'] : ['#fa8c16'])

const fetchDailyStats = async () => {
  loadingStats.value = true
  try {
    const params = { start: toDateStr(dateRange.value[0]), end: toDateStr(dateRange.value[1]), noCache: Date.now() }
    const res = await analyticsApi.getSalesDaily(params)
    // 某些环境可能返回304，保持旧数据并仅重渲染
    if (res.status === 304) {
      renderChart()
    } else {
      dailyRows.value = res.data?.data || []
      renderChart()
    }
  } catch (err) {
    console.error('fetchDailyStats error:', err)
    message.error('获取统计数据失败')
  } finally {
    loadingStats.value = false
  }
}

const fetchUserQuotes = async () => {
  if (!selectedUserId.value) return
  loadingQuotes.value = true
  try {
    const params = { start: toDateStr(dateRange.value[0]), end: toDateStr(dateRange.value[1]), userId: selectedUserId.value, noCache: Date.now() }
    const res = await analyticsApi.getUserQuotes(params)
    userQuoteRows.value = res.data.records
  } catch (err) {
    console.error('fetchUserQuotes error:', err)
    message.error('获取报价单列表失败')
  } finally {
    loadingQuotes.value = false
  }
}

const buildDateAxis = () => {
  const days: string[] = []
  let cur = dateRange.value[0].startOf('day')
  const end = dateRange.value[1].startOf('day')
  while (cur.isSameOrBefore(end, 'day')) {
    days.push(cur.format('YYYY-MM-DD'))
    cur = cur.add(1, 'day')
  }
  return days
}

const groupByUser = (rows: SalesDailyRow[]) => {
  const map: Record<string, Record<string, number>> = {}
  rows.forEach(r => {
    const key = `${r.user_id}:${r.username}`
    if (!map[key]) map[key] = {}
    map[key][r.day] = r.count
  })
  return map
}

const sumByDay = (rows: SalesDailyRow[]) => {
  const daySum: Record<string, number> = {}
  rows.forEach(r => {
    daySum[r.day] = (daySum[r.day] || 0) + r.count
  })
  return daySum
}

const renderChart = () => {
  if (!chartRef.value) return
  if (!chart) {
    chart = echarts.init(chartRef.value)
  }
  const isDark = document.querySelector('.layout.dark') !== null
  const xAxis = buildDateAxis()

  let series: LineSeriesOption[] = []

  if (!selectedUserId.value) {
    // 未选择销售时，显示总和一条线
    const dayTotals = sumByDay(dailyRows.value)
    const data = xAxis.map(d => dayTotals[d] || 0)
    series = [{
      name: '总计',
      type: 'line',
      data,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 3 },
      emphasis: { focus: 'series' },
    }]
  } else {
    // 选择了销售时，显示两条线：选中销售 + 所有人总计
    const user = salesUsers.value.find(u => u.id === selectedUserId.value)
    const grouped = groupByUser(dailyRows.value)
    const key = user ? `${user.id}:${user.username}` : ''
    const dayMap = key ? (grouped[key] || {}) : {}
    const userData = xAxis.map(d => dayMap[d] || 0)
    const dayTotals = sumByDay(dailyRows.value)
    const totalData = xAxis.map(d => dayTotals[d] || 0)
    series = [
      {
        name: user ? user.username : '选中销售',
        type: 'line',
        data: userData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 3 },
        emphasis: { focus: 'series' },
      },
      {
        name: '总计',
        type: 'line',
        data: totalData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 3 },
        emphasis: { focus: 'series' },
      }
    ]
  }

  const option: EChartsOption = {
    color: chartColors.value,
    title: {
      text: chartTitleText.value,
      subtext: chartSubText.value,
      left: 'left',
      top: 0,
      padding: [8, 12, 8, 12],
      textStyle: { fontSize: 16, fontWeight: 600, color: isDark ? '#e8e8e8' : '#1f1f1f' },
      subtextStyle: { fontSize: 12, color: isDark ? '#bfbfbf' : '#8c8c8c' },
      itemGap: 6,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? 'rgba(28,28,28,0.95)' : 'rgba(255,255,255,0.95)',
      borderColor: isDark ? '#303030' : '#d9d9d9',
      textStyle: { color: isDark ? '#e8e8e8' : '#1f1f1f' },
    },
    legend: { show: series.length > 1, top: series.length > 1 ? 36 : 0 },
    // 预留标题与图形的间距，随图例动态调整，避免与横坐标重叠
    grid: { left: 40, right: 20, bottom: 40, top: series.length > 1 ? 84 : 56 },
    xAxis: {
      type: 'category',
      data: xAxis,
      axisLabel: { color: isDark ? '#bfbfbf' : '#595959' },
      axisLine: { lineStyle: { color: isDark ? '#303030' : '#d9d9d9' } },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: isDark ? '#bfbfbf' : '#595959' },
      axisLine: { lineStyle: { color: isDark ? '#303030' : '#d9d9d9' } },
      splitLine: { lineStyle: { color: isDark ? '#1f1f1f' : '#f0f0f0' } },
    },
    series,
  }
  chart.setOption(option)
}

const refresh = () => {
  fetchDailyStats().then(() => {
    if (selectedUserId.value) fetchUserQuotes()
  })
}

const onUserChange = () => {
  // 清空列表并重绘图表
  if (!selectedUserId.value) {
    userQuoteRows.value = []
  }
  renderChart()
  fetchUserQuotes()
}

const onRangeChange = () => {
  refresh()
}

onMounted(async () => {
  await fetchUsers()
  await fetchDailyStats()
})

onBeforeUnmount(() => {
  if (chart) {
    chart.dispose()
    chart = null
  }
})

watch(dateRange, () => onRangeChange())
</script>

<style scoped>
.analysis-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
.filters {
  display: flex;
  justify-content: space-between;
}
.chart {
  width: 100%;
  height: 420px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}
.subheader {
  font-weight: 700;
  font-size: 18px;
  margin: 8px 0;
  color: #1f1f1f;
}
</style>

<style scoped>
/* 暗色模式覆盖：图表容器背景与边框 */
:global(.layout.dark) .analysis-container .chart {
  background: #1a1a1a;
  border-color: #303030;
}
</style>
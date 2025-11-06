<template>
  <div ref="el" class="trends-chart"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref } from 'vue'
import * as echarts from 'echarts'

interface Props {
  title: string
  color?: string
  dates: string[] // ISO 或 yyyy-MM-dd HH:mm:ss
  rangeDays?: number // 默认30天
}

const props = withDefaults(defineProps<Props>(), {
  color: '#2f54eb',
  rangeDays: 30
})

const el = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const toDateKey = (s: string) => {
  try {
    const d = new Date(s)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  } catch { return String(s).slice(0, 10) }
}

const buildSeries = () => {
  const today = new Date()
  const labels: string[] = []
  for (let i = props.rangeDays - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    labels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  const countMap = new Map<string, number>()
  props.dates.forEach(s => {
    const k = toDateKey(s)
    countMap.set(k, (countMap.get(k) || 0) + 1)
  })
  const barData = labels.map(k => countMap.get(k) || 0)
  // 简单7日均线
  const maData: number[] = []
  const win = 7
  for (let i = 0; i < barData.length; i++) {
    let sum = 0
    let c = 0
    for (let j = Math.max(0, i - win + 1); j <= i; j++) { sum += barData[j]; c++ }
    maData.push(c ? Number((sum / c).toFixed(2)) : 0)
  }

  return { labels, barData, maData }
}

const render = () => {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value!)
  const { labels, barData, maData } = buildSeries()
  const color = props.color || '#2f54eb'
  // 保护：对象可能为空
  if (!chart) return
  chart.setOption({
    grid: { left: 40, right: 20, top: 36, bottom: 32 },
    tooltip: { trigger: 'axis' },
    title: { text: props.title, left: 10, top: 10, textStyle: { fontSize: 13, fontWeight: 600 } },
    xAxis: { type: 'category', data: labels, axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: '每日数量', type: 'bar', data: barData, barMaxWidth: 20,
        itemStyle: { color: color, opacity: 0.45 }
      },
      {
        name: '7日均值', type: 'line', data: maData,
        smooth: true, symbol: 'circle', symbolSize: 4,
        lineStyle: { color, width: 2 }, itemStyle: { color }
      }
    ]
  })
}

onMounted(() => { render(); window.addEventListener('resize', resize) })
onBeforeUnmount(() => { window.removeEventListener('resize', resize); chart?.dispose(); chart = null })

const resize = () => { chart?.resize() }
watch(() => [props.dates, props.color, props.title, props.rangeDays], () => { render() })
</script>

<style scoped>
.trends-chart { width: 100%; height: 220px; }
</style>
<template>
  <div class="page technical-tasks">
    <div class="header">
      <div class="actions">
        <a-button type="primary" @click="goCreate">新增任务</a-button>
      </div>
    </div>

    <!-- 资讯看板：临近截止提醒 & 进行中任务数 -->
    <div class="kanban">
      <a-card class="kanban-card in-progress" size="small" :bordered="false">
        <template #title>
          <div class="card-header">
            <ThunderboltOutlined />
            <span>进行中任务</span>
          </div>
        </template>
        <a-statistic :value="inProgressCount" suffix="项" :value-style="{ color: '#ffffff', fontWeight: 700 }" />
      </a-card>
      <a-card class="kanban-card near-deadline" size="small" :bordered="false">
        <template #title>
          <div class="card-header">
            <FieldTimeOutlined />
            <span>临近截止</span>
          </div>
        </template>
        <a-statistic :value="nearDeadlineCount" suffix="项" :value-style="{ color: '#ffffff', fontWeight: 700 }" />
        <div class="card-sub" v-if="nearDeadlineCount > 0">有 {{ nearDeadlineCount }} 项任务即将到期</div>
        <div class="card-sub" v-else>暂无到期提醒</div>
      </a-card>
    </div>

    <!-- 搜索区域 -->
    <div class="search">
      <a-form layout="inline" @submit.prevent="doSearch">
      <a-form-item label="项目名称">
        <a-input v-model:value="query.projectName" placeholder="输入项目名称" allow-clear @pressEnter="doSearch" />
      </a-form-item>
      <a-form-item label="客户名称">
        <a-input v-model:value="query.customerName" placeholder="输入客户名称" allow-clear @pressEnter="doSearch" />
      </a-form-item>
      <a-form-item label="截止时间">
        <a-date-picker v-model:value="deadlineBefore" value-format="YYYY-MM-DD" placeholder="选择截止日期" />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" @click="doSearch">搜索</a-button>
        <a-button style="margin-left: 8px" @click="resetSearch">重置</a-button>
      </a-form-item>
      </a-form>
    </div>

    <!-- 列表 -->
    <a-table :data-source="list" :loading="loading" row-key="id" :pagination="{ pageSize: 10 }">
      <a-table-column key="project_name" title="项目名称" dataIndex="project_name" />
      <a-table-column key="customer_name" title="客户名称" dataIndex="customer_name" />
      <a-table-column key="sales_owner_name" title="归属销售人员" dataIndex="sales_owner_name" />
      <a-table-column key="technician_name" title="技术人员" dataIndex="technician_name" />
      <a-table-column key="client_contact_name" title="对接客户姓名" dataIndex="client_contact_name" />
      <a-table-column key="client_contact_phone" title="对接客户联系方式" dataIndex="client_contact_phone" />
      <a-table-column key="start_time" title="任务开始时间" dataIndex="start_time" :customRender="renderStartCell" />
      <a-table-column key="deadline" title="任务结束时间" dataIndex="deadline"
        :customRender="renderDeadlineCell" />
      <a-table-column key="status" title="状态" :customRender="renderStatusCell" />
      <a-table-column key="actions" title="操作" :customRender="renderActionsCell" />
    </a-table>
  </div>
  
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h, type VNode } from 'vue'
import { Button } from 'ant-design-vue'
import dayjs from 'dayjs'
import { ThunderboltOutlined, FieldTimeOutlined } from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import { technicalTasksApi, type TechnicalTaskListItem, type TechnicalTaskQuery } from '../api/technicalTasks'
import authService from '../api/auth'

const router = useRouter()
const list = ref<TechnicalTaskListItem[]>([])
const loading = ref(false)
const cardDownloading = ref<Record<number, boolean>>({})
const query = ref<TechnicalTaskQuery>({ projectName: '', customerName: '', deadlineBefore: '' })
const deadlineBefore = ref<string>('')
const currentUser = authService.getStoredUser()

const inProgressCount = computed(() => list.value.filter(it => it.status === 'active').length)
const nearDeadlineCount = computed(() => {
  const now = Date.now()
  const nearMs = 3 * 24 * 60 * 60 * 1000
  return list.value.filter(it => {
    const d = new Date(it.deadline).getTime()
    return d >= now && (d - now) <= nearMs
  }).length
})

function renderDeadlineCell({ text }: { text: string }): VNode {
  const d = new Date(text).getTime()
  const now = Date.now()
  const nearMs = 3 * 24 * 60 * 60 * 1000
  const isNear = d >= now && (d - now) <= nearMs
  const display = dayjs(text).isValid() ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : text
  return h('span', { style: isNear ? { color: '#f5222d' } : undefined }, display)
}

type TableRenderArg<T> = { text?: unknown; record: T; index?: number }

function renderActionsCell({ record }: TableRenderArg<TechnicalTaskListItem>): VNode {
  const nodes: VNode[] = []
  if (canEdit(record)) {
    nodes.push(h('a-button', { size: 'small', onClick: () => handleEdit(record) }, '修改'))
  }
  if (canDownloadAttachment()) {
    nodes.push(h('a-button', { size: 'small', onClick: () => downloadAttachment(record) }, '下载附件'))
  }
  if (canDownloadCardPdf()) {
    nodes.push(h(Button, { type: 'primary', size: 'small', loading: !!cardDownloading.value[record.id], disabled: !!cardDownloading.value[record.id], onClick: () => downloadCardPdf(record) }, '下载协作卡'))
  }
  if (nodes.length === 0) {
    nodes.push(h('span', { style: { color: '#999' } }, '无权限'))
  }
  return h('div', { style: { display: 'flex', gap: '8px' } }, nodes)
}

function renderStartCell({ text }: { text: string }): VNode {
  const display = dayjs(text).isValid() ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : text
  return h('span', null, display)
}

function renderStatusCell({ record }: TableRenderArg<TechnicalTaskListItem>): VNode {
  const isExpired = dayjs(record?.deadline).isValid() && dayjs(record.deadline).isBefore(dayjs())
  let label = '已生成'
  let color = 'blue'
  if (record?.status === 'draft') { label = '草稿中'; color = 'default' }
  else if (record?.status === 'completed') { label = '已完成'; color = 'green' }
  else if (isExpired) { label = '已过期'; color = 'red' }
  return h('a-tag', { color }, label)
}

function canEdit(record: TechnicalTaskListItem): boolean {
  return !!currentUser && currentUser.role === 'sales' && currentUser.id === record.author_id
}
function canDownloadAttachment(): boolean {
  return !!currentUser && currentUser.role === 'technician'
}
function canDownloadCardPdf(): boolean {
  return !!currentUser && (currentUser.role === 'sales' || currentUser.role === 'admin' || currentUser.role === 'finance')
}

function handleEdit(record: TechnicalTaskListItem) {
  try { sessionStorage.setItem('editing_task', JSON.stringify(record)) } catch {}
  router.push(`/technical-tasks/create?id=${record.id}`)
}

async function downloadAttachment(record: TechnicalTaskListItem) {
  try {
    const res = await technicalTasksApi.downloadAttachment(record.id)
    const filename = `${record.project_name}-附件.zip`
    triggerBlobDownload(res.data as Blob, filename)
  } catch (err) {
    console.error(err)
    window.$message?.error?.('附件下载失败，请稍后再试')
  }
}

async function downloadCardPdf(record: TechnicalTaskListItem) {
  cardDownloading.value[record.id] = true
  try {
    const res = await technicalTasksApi.downloadCardPdf(record.id)
    const filename = `${record.project_name}-技术支持协作卡.pdf`
    triggerBlobDownload(res.data as Blob, filename)
  } catch (err) {
    console.error(err)
    window.$message?.error?.('协作卡下载失败，请稍后再试')
  } finally {
    cardDownloading.value[record.id] = false
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

async function fetchList() {
  loading.value = true
  try {
    const data = await technicalTasksApi.list({
      projectName: query.value.projectName,
      customerName: query.value.customerName,
      deadlineBefore: deadlineBefore.value || undefined
    })
    list.value = data && data.length ? data : mockTasks()
  } catch {
    // 接口不可用或出错时使用本地mock数据
    list.value = mockTasks()
  } finally {
    loading.value = false
  }
}

function doSearch() { fetchList() }
function resetSearch() {
  query.value = { projectName: '', customerName: '', deadlineBefore: '' }
  deadlineBefore.value = ''
  fetchList()
}

function goCreate() { router.push('/technical-tasks/create') }

onMounted(fetchList)

function mockTasks(): TechnicalTaskListItem[] {
  const now = Date.now()
  const fmt = (ms: number) => new Date(ms).toISOString()
  return [
    {
      id: 101,
      project_name: '钢结构设计优化 A 项目',
      customer_name: '天津光大钢铁有限公司',
      sales_owner_name: '张三',
      technician_name: '李工',
      client_contact_name: '王经理',
      client_contact_phone: '13800000001',
      start_time: fmt(now - 7 * 24 * 3600 * 1000),
      deadline: fmt(now + 2 * 24 * 3600 * 1000),
      status: 'active',
      author_id: 1,
      created_at: fmt(now - 8 * 24 * 3600 * 1000),
      updated_at: fmt(now - 1 * 24 * 3600 * 1000)
    },
    {
      id: 102,
      project_name: '焊接工艺评估 B 项目',
      customer_name: '华滋能源有限公司',
      sales_owner_name: '李四',
      technician_name: '赵工',
      client_contact_name: '刘主任',
      client_contact_phone: '13800000002',
      start_time: fmt(now - 10 * 24 * 3600 * 1000),
      deadline: fmt(now + 10 * 24 * 3600 * 1000),
      status: 'completed',
      author_id: 2,
      created_at: fmt(now - 11 * 24 * 3600 * 1000),
      updated_at: fmt(now - 2 * 24 * 3600 * 1000)
    },
    {
      id: 103,
      project_name: '结构强度仿真 C 项目',
      customer_name: '北京钢铁集团',
      sales_owner_name: '王五',
      technician_name: '钱工',
      client_contact_name: '孙主管',
      client_contact_phone: '13800000003',
      start_time: fmt(now - 3 * 24 * 3600 * 1000),
      deadline: fmt(now + 1 * 24 * 3600 * 1000),
      status: 'active',
      author_id: 3,
      created_at: fmt(now - 4 * 24 * 3600 * 1000),
      updated_at: fmt(now - 12 * 3600 * 1000)
    },
    {
      id: 104,
      project_name: '生产线工艺改造 D 项目',
      customer_name: '江苏华滋能源有限公司',
      sales_owner_name: '赵六',
      technician_name: '周工',
      client_contact_name: '吴主管',
      client_contact_phone: '13800000004',
      start_time: fmt(now - 20 * 24 * 3600 * 1000),
      deadline: fmt(now + 25 * 24 * 3600 * 1000),
      status: 'draft',
      author_id: 4,
      created_at: fmt(now - 21 * 24 * 3600 * 1000),
      updated_at: fmt(now - 5 * 24 * 3600 * 1000)
    }
  ]
}
</script>

<style scoped>
.technical-tasks { padding: 16px; }
.header { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 12px; }
.search { margin: 12px 0 16px; }
.kanban { display: grid; grid-template-columns: repeat(2, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px; }
.kanban-card { color: #fff; position: relative; overflow: hidden; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.08); }
.kanban-card.in-progress { background: linear-gradient(135deg, #6a85b6 0%, #bac8e0 100%); }
.kanban-card.near-deadline { background: linear-gradient(135deg, #b36b6b 0%, #e8c7c7 100%); }
.kanban-card::after { content: ''; position: absolute; right: -40px; top: -40px; width: 120px; height: 120px; background: radial-gradient(rgba(255,255,255,0.2), rgba(255,255,255,0)); filter: blur(6px); transform: rotate(25deg); }
.card-header { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #fff; }
.card-sub { margin-top: 6px; opacity: 0.9; }
.kanban-card :deep(.ant-statistic-title) { color: rgba(255,255,255,0.85); }
.kanban-card :deep(.ant-card-head) { border-bottom: none; }
.kanban-card :deep(.ant-card-body) { padding-top: 8px; }
</style>

function handleEdit(record: TechnicalTaskListItem) {
  try { sessionStorage.setItem('editing_task', JSON.stringify(record)) } catch {}
  router.push(`/technical-tasks/create?id=${record.id}`)
}

async function downloadAttachment(record: TechnicalTaskListItem) {
  try {
    const res = await technicalTasksApi.downloadAttachment(record.id)
    const filename = `${record.project_name}-附件.zip`
    triggerBlobDownload(res.data as Blob, filename)
  } catch (e) {
    window.$message?.error?.('附件下载失败，请稍后再试')
  }
}

async function downloadCardPdf(record: TechnicalTaskListItem) {
  try {
    const res = await technicalTasksApi.downloadCardPdf(record.id)
    const filename = `${record.project_name}-技术支持协作卡.pdf`
    triggerBlobDownload(res.data as Blob, filename)
  } catch (e) {
    window.$message?.error?.('协作卡下载失败，请稍后再试')
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
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

    <!-- 技术任务详情模态框（技术人员查看使用；允许技术人员修改基础信息） -->
    <a-modal v-model:open="detailVisible" title="技术任务详情" :footer="null" :width="720">
      <a-descriptions bordered :column="1" size="small">
        <a-descriptions-item label="项目名称">{{ detailRecord?.project_name }}</a-descriptions-item>
        <a-descriptions-item label="客户名称">{{ detailRecord?.customer_name }}</a-descriptions-item>
        <a-descriptions-item label="归属销售人员">{{ detailRecord?.sales_owner_name }}</a-descriptions-item>
        <a-descriptions-item label="技术人员">{{ displayTechnicians(detailRecord) }}</a-descriptions-item>
        <a-descriptions-item label="对接客户姓名">{{ detailRecord?.client_contact_name }}</a-descriptions-item>
        <a-descriptions-item label="对接客户联系方式">{{ detailRecord?.client_contact_phone }}</a-descriptions-item>
        <a-descriptions-item label="任务开始时间">{{ formatDate(detailRecord?.start_time) }}</a-descriptions-item>
        <a-descriptions-item label="任务结束时间">{{ formatDate(detailRecord?.deadline) }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <span :class="`status-label status-${statusType(detailRecord)}`">{{ statusLabel(detailRecord) }}</span>
        </a-descriptions-item>
      </a-descriptions>
      <!-- 技术人员内联编辑区 -->
      <div v-if="canTechnicianInlineEdit()" style="margin-top: 12px">
        <a-form layout="inline" class="detail-edit-inline">
          <a-form-item label="技术人员">
            <a-select
              v-model:value="editTechnicianNames"
              mode="tags"
              :options="technicianOptions"
              placeholder="选择或输入技术人员"
              style="width: 300px"
            />
          </a-form-item>
          <a-form-item label="状态">
            <a-select v-model:value="editStatus" style="width: 140px">
              <a-select-option value="draft">草稿</a-select-option>
              <a-select-option value="active">进行中</a-select-option>
              <a-select-option value="completed">已完成</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-button type="primary" :loading="savingEditable" @click="saveEditableFields">保存</a-button>
          </a-form-item>
        </a-form>
      </div>
      <!-- 约定交付产物列表展示 -->
      <div style="margin-top: 16px">
        <h4 style="margin: 6px 0">约定交付产物</h4>
        <ul v-if="deliverablesList(detailRecord).length" class="deliverables-list">
          <li v-for="(d, idx) in deliverablesList(detailRecord)" :key="idx">{{ d }}</li>
        </ul>
        <div v-else style="color: #999">暂无约定交付产物</div>
      </div>
    </a-modal>
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
const detailVisible = ref(false)
const detailRecord = ref<TechnicalTaskListItem | null>(null)
// 技术人员角色在详情模态中的可编辑字段
const editTechnicianNames = ref<string[]>([])
const editStatus = ref<'draft'|'active'|'completed'>('active')
const savingEditable = ref(false)
const technicianOptions = ref<{ label: string, value: string }[]>([])

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
    nodes.push(h(Button, { size: 'small', onClick: () => handleEdit(record) }, '修改'))
  }
  if (canView()) {
    nodes.push(h(Button, { size: 'small', onClick: () => openDetail(record) }, '查看'))
  }
  if (canDownloadAttachment()) {
    nodes.push(h(Button, { size: 'small', onClick: () => downloadAttachment(record) }, '下载附件'))
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
  let label = '进行中'
  let type = 'active'
  if (record?.status === 'draft') { label = '草稿'; type = 'draft' }
  else if (record?.status === 'completed') { label = '已完成'; type = 'completed' }
  else if (isExpired) { label = '已过期'; type = 'expired' }
  return h('span', { class: `status-label status-${type}` }, label)
}

function canEdit(record: TechnicalTaskListItem): boolean {
  return !!currentUser && currentUser.role === 'sales' && currentUser.id === record.author_id
}
function canView(): boolean {
  return !!currentUser && currentUser.role === 'technician'
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

async function openDetail(record: TechnicalTaskListItem) {
  try {
    const full = await technicalTasksApi.getOne(record.id)
    detailRecord.value = full || record
  } catch {
    detailRecord.value = record
  }
  const rec = detailRecord.value!
  editTechnicianNames.value = Array.isArray(rec.technician_usernames) && rec.technician_usernames.length > 0
    ? rec.technician_usernames.slice()
    : (rec.technician_name ? [rec.technician_name] : [])
  editStatus.value = rec.status
  const names = Array.from(new Set(list.value.flatMap(it => {
    const many = Array.isArray(it.technician_usernames) ? it.technician_usernames : []
    const single = it.technician_name ? [it.technician_name] : []
    return [...many, ...single]
  }).filter((n): n is string => typeof n === 'string' && n.length > 0)))
  technicianOptions.value = names.map(n => ({ label: n, value: n }))
  detailVisible.value = true
}

function canTechnicianInlineEdit(): boolean {
  return !!currentUser && currentUser.role === 'technician'
}

async function saveEditableFields() {
  if (!detailRecord.value) return
  savingEditable.value = true
  try {
    const rec = detailRecord.value
    const payload = {
      project_name: rec.project_name,
      customer_name: rec.customer_name,
      sales_owner_id: 0,
      technician_id: 0,
      sales_owner_username: rec.sales_owner_name,
      technician_username: editTechnicianNames.value[0] || '',
      technician_usernames: editTechnicianNames.value.slice(),
      client_contact_name: rec.client_contact_name,
      client_contact_phone: rec.client_contact_phone,
      start_time: rec.start_time,
      deadline: rec.deadline,
      deliverables: Array.isArray(rec.deliverables) ? rec.deliverables : [],
      status: editStatus.value,
      attachmentFile: null
    }
    await technicalTasksApi.update(rec.id, payload)
    detailRecord.value.status = editStatus.value
    detailRecord.value.technician_usernames = editTechnicianNames.value.slice()
    const idx = list.value.findIndex(it => it.id === rec.id)
    if (idx >= 0) {
      list.value[idx].status = editStatus.value
      list.value[idx].technician_name = editTechnicianNames.value[0] || list.value[idx].technician_name
      list.value[idx].technician_usernames = editTechnicianNames.value.slice()
    }
    window.$message?.success?.('已保存修改')
  } catch {
    window.$message?.error?.('保存失败，请稍后再试')
  } finally {
    savingEditable.value = false
  }
}

function statusType(rec: TechnicalTaskListItem | null): 'draft'|'active'|'completed'|'expired' {
  if (!rec) return 'active'
  const isExpired = dayjs(rec?.deadline).isValid() && dayjs(rec.deadline).isBefore(dayjs())
  if (rec.status === 'draft') return 'draft'
  if (rec.status === 'completed') return 'completed'
  return isExpired ? 'expired' : 'active'
}
function statusLabel(rec: TechnicalTaskListItem | null): string {
  if (!rec) return '进行中'
  const isExpired = dayjs(rec?.deadline).isValid() && dayjs(rec.deadline).isBefore(dayjs())
  if (rec.status === 'draft') return '草稿'
  if (rec.status === 'completed') return '已完成'
  return isExpired ? '已过期' : '进行中'
}
function formatDate(v?: string): string {
  if (!v) return '-'
  return dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : v
}

function displayTechnicians(rec: TechnicalTaskListItem | null): string {
  if (!rec) return '-'
  const arr = Array.isArray(rec.technician_usernames) ? rec.technician_usernames : []
  if (arr.length > 0) return arr.join('、')
  return rec.technician_name || '-'
}

function deliverablesList(rec: TechnicalTaskListItem | null): string[] {
  if (!rec) return []
  const raw = (rec as unknown as { deliverables?: unknown }).deliverables
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (typeof raw === 'string' && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string' && x.length > 0) : []
    } catch { return [] }
  }
  return []
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
.kanban-card :deep(.ant-statistic-content) { text-align: center; }
.kanban-card :deep(.ant-statistic-content-value) { font-size: 36px; font-weight: 800; }
.kanban .card-sub { text-align: center; font-size: 12px; }
.detail-edit-inline { display: flex; align-items: center; gap: 12px; flex-wrap: nowrap; }
.deliverables-list { list-style: disc; padding-left: 20px; }
.deliverables-list li { line-height: 22px; }
/* 列表表头文字不换行（仅本页生效） */
.technical-tasks :deep(.ant-table-thead > tr > th) { white-space: nowrap; }

/* 状态标签样式（背景色填充，使用 :deep 以确保作用于表格自定义渲染内容） */
.technical-tasks :deep(.status-label) { display: inline-block; padding: 0 8px; line-height: 22px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.technical-tasks :deep(.status-draft) { background-color: #f0f0f0; color: #595959; }
.technical-tasks :deep(.status-active) { background-color: #e6f4ff; color: #0958d9; }
.technical-tasks :deep(.status-completed) { background-color: #f6ffed; color: #389e0d; }
.technical-tasks :deep(.status-expired) { background-color: #fff1f0; color: #cf1322; }
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
<template>
  <div class="page technical-task-create">
    <div v-if="overlayVisible" class="page-overlay">
      <img :src="logoUrl" alt="logo" class="overlay-logo" />
      <div class="overlay-text">正在生成协作卡，请稍候…</div>
    </div>
    <div class="header">
      <h2 v-if="editingId">编辑技术任务</h2>
    </div>

    <a-form layout="vertical" @submit.prevent>
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="项目名称" :rules="[{ required: true, message: '必填' }]">
            <a-input v-model:value="form.project_name" placeholder="请输入项目名称" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="客户名称" :rules="[{ required: true, message: '必填' }]">
            <a-input v-model:value="form.customer_name" placeholder="请输入客户名称" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="归属销售人员" :rules="[{ required: true, message: '必填' }]">
            <a-input v-model:value="salesOwnerName" placeholder="请输入销售人员用户名" />
            <div class="tip">临时方案：输入销售人员用户名（后端将根据用户名解析ID）。</div>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="技术人员（可多选）" :rules="[{ required: true, message: '必填' }]">
            <a-select
              v-model:value="technicianNames"
              mode="tags"
              :options="technicianOptions"
              :token-separators="[',',';',' ']"
              placeholder="选择或输入技术人员用户名"
            />
            <div class="tip">支持选择多个技术人员，后端将一并保存并返回。</div>
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="对接客户姓名" :rules="[{ required: true, message: '必填' }]">
            <a-input v-model:value="form.client_contact_name" placeholder="请输入客户对接人姓名" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="对接客户联系方式" :rules="[{ required: true, message: '必填' }]">
            <a-input v-model:value="form.client_contact_phone" placeholder="请输入客户联系方式" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="技术任务开始时间" :rules="[{ required: true, message: '必填' }]">
            <a-date-picker v-model:value="startDate" show-time value-format="YYYY-MM-DD HH:mm:ss" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="双方约定交付时间" :rules="[{ required: true, message: '必填' }]">
            <a-date-picker v-model:value="deadline" show-time value-format="YYYY-MM-DD HH:mm:ss" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="双方约定产物" :rules="[{ required: true, message: '至少添加一个产物' }]">
        <div>
          <div v-for="(it, idx) in deliverables" :key="idx" style="display:flex; gap:8px; margin-bottom:8px;">
            <a-input v-model:value="deliverables[idx]" placeholder="请输入约定产物" />
            <a-button danger @click="removeDeliverable(idx)">移除</a-button>
          </div>
          <a-button type="dashed" @click="addDeliverable">添加产物</a-button>
        </div>
      </a-form-item>

      <a-form-item label="相关文件打包上传" :rules="[{ required: true, message: '必填' }]">
        <a-upload :file-list="fileList" :beforeUpload="() => false" accept=".zip" @change="onFileChange">
          <a-button>选择ZIP文件</a-button>
        </a-upload>
      </a-form-item>

      <div class="form-actions">
        <a-button @click="saveDraft" :disabled="submitting">存为草稿</a-button>
        <a-button type="primary" @click="saveAndGenerate" :loading="submitting">保存并生成技术支持工作协作卡</a-button>
        <a-button @click="goBack">返回</a-button>
      </div>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { UploadProps, UploadFile } from 'ant-design-vue'
import { useRouter, useRoute } from 'vue-router'
import { technicalTasksApi, type CreateTechnicalTaskPayload, type TechnicalTaskListItem } from '../api/technicalTasks'
import authService from '../api/auth'
import adminApi, { type AdminUser } from '../api/admin'
// 需求变更：引入用户信息以加载技术人员选项

const router = useRouter()
const route = useRoute()
const editingId = ref<number | null>(route.query.id ? Number(route.query.id) : null)
const form = ref<CreateTechnicalTaskPayload>({
  project_name: '',
  customer_name: '',
  sales_owner_id: 0,
  technician_id: 0,
  sales_owner_username: undefined,
  technician_username: undefined,
  technician_usernames: undefined,
  client_contact_name: '',
  client_contact_phone: '',
  start_time: '',
  deadline: '',
  deliverables: [],
  status: 'active',
  attachmentFile: null
})
const salesOwnerName = ref('')
const technicianNames = ref<string[]>([])
const technicianOptions = ref<{ label: string, value: string }[]>([])
const startDate = ref('')
const deadline = ref('')
const deliverables = ref<string[]>([''])
const fileList = ref<UploadFile[]>([])
const submitting = ref(false)
const overlayVisible = ref(false)
const currentUser = authService.getStoredUser()

// 统一静态资源基础地址（生产通过 VITE_API_BASE_URL 注入；本地默认 3005）
const API_BASE = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3005'
const UPLOADS_BASE = `${API_BASE.replace(/\/$/, '')}/uploads`
const logoUrl = computed(() => `${UPLOADS_BASE}/logo.jpg`)

function addDeliverable() { deliverables.value.push('') }
function removeDeliverable(idx: number) { deliverables.value.splice(idx, 1) }
const onFileChange: UploadProps['onChange'] = (info) => {
  fileList.value = info.fileList.slice(-1)
  const origin = fileList.value[0]?.originFileObj as File | undefined
  form.value.attachmentFile = origin ?? null
}

async function submit(status: 'draft'|'active') {
  // 校验
  if (!form.value.project_name || !form.value.customer_name || !salesOwnerName.value || technicianNames.value.length === 0 || !form.value.client_contact_name || !form.value.client_contact_phone || !startDate.value || !deadline.value || deliverables.value.filter(v => v && v.trim()).length === 0 || !form.value.attachmentFile) {
    window.$message?.error?.('请完整填写所有必填项并上传ZIP文件')
    return
  }
  submitting.value = true
  try {
    // 由后端根据用户名解析ID（销售默认当前用户）
    form.value.sales_owner_username = salesOwnerName.value
    form.value.technician_username = technicianNames.value[0] || ''
    form.value.technician_usernames = technicianNames.value.slice()
    form.value.sales_owner_id = 0
    form.value.technician_id = 0
    form.value.start_time = startDate.value
    form.value.deadline = deadline.value
    form.value.deliverables = deliverables.value.filter(v => v && v.trim())
    form.value.status = status

    if (editingId.value) {
      await technicalTasksApi.update(editingId.value, form.value)
      window.$message?.success?.('更新成功')
    } else {
      await technicalTasksApi.create(form.value)
      window.$message?.success?.(status === 'draft' ? '已保存草稿' : '保存成功')
    }
    router.push('/technical-tasks')
  } finally {
    submitting.value = false
  }
}

function saveDraft() { submit('draft') }
async function saveAndGenerate() {
  overlayVisible.value = true
  try {
    await submit('active')
  } finally {
    overlayVisible.value = false
  }
}
function goBack() {
  // 清空表单并返回
  form.value = { project_name: '', customer_name: '', sales_owner_id: 0, technician_id: 0, client_contact_name: '', client_contact_phone: '', start_time: '', deadline: '', deliverables: [], status: 'active', attachmentFile: null }
  salesOwnerName.value = ''
  technicianNames.value = []
  startDate.value = ''
  deadline.value = ''
  deliverables.value = ['']
  fileList.value = []
  router.push('/technical-tasks')
}

onMounted(async () => {
  await loadTechnicianOptions()
  if (!editingId.value) {
    return
  }
  try {
    const data = await technicalTasksApi.getOne(editingId.value)
    prefillFromRecord(data)
  } catch {
    // 后端不可用时，尝试从 sessionStorage 读取
    try {
      const raw = sessionStorage.getItem('editing_task')
      if (raw) {
        const rec = JSON.parse(raw) as TechnicalTaskListItem
        prefillFromRecord(rec)
      }
    } catch {}
  }
})

function prefillFromRecord(rec: TechnicalTaskListItem) {
  form.value.project_name = rec.project_name || ''
  form.value.customer_name = rec.customer_name || ''
  salesOwnerName.value = rec.sales_owner_name || ''
  technicianNames.value = Array.isArray(rec.technician_usernames) && rec.technician_usernames.length > 0
    ? rec.technician_usernames.slice()
    : (rec.technician_name ? [rec.technician_name] : [])
  startDate.value = rec.start_time || ''
  deadline.value = rec.deadline || ''
  // deliverables 字段后端可能未返回，保持原状或留空
}

async function loadTechnicianOptions() {
  try {
    // 管理员可获取系统用户列表（仅取技术人员）
    if (currentUser && currentUser.role === 'admin') {
      const { data } = await adminApi.getUsers()
      const techs = (data || []).filter((u: AdminUser) => u.role === 'technician')
      technicianOptions.value = techs.map((u: AdminUser) => ({ label: u.username, value: u.username }))
      return
    }
  } catch {
    // 非管理员或接口不可用时走兜底
  }
  // 兜底：从技术任务列表里提取历史出现过的技术人员名，支持自由输入
  try {
    const items = await technicalTasksApi.list()
    const names = Array.from(
      new Set(
        (items || [])
          .flatMap((it: TechnicalTaskListItem) => {
            const many = Array.isArray(it.technician_usernames) ? it.technician_usernames : []
            const single = it.technician_name ? [it.technician_name] : []
            return [...many, ...single]
          })
          .filter((n): n is string => typeof n === 'string' && n.length > 0)
      )
    ) as string[]
    technicianOptions.value = names.map(n => ({ label: n, value: n }))
  } catch {
    technicianOptions.value = []
  }
}
</script>

<style scoped>
.technical-task-create { padding: 16px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.tip { color: #999; font-size: 12px; margin-top: 4px; }
.form-actions { display: flex; gap: 10px; margin-top: 16px; }
.page-overlay { position: fixed; inset: 0; background: rgba(255,255,255,0.88); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 2000; }
.overlay-logo { width: 120px; height: 120px; object-fit: contain; animation: pulse 1.2s ease-in-out infinite; }
.overlay-text { margin-top: 16px; color: #333; font-size: 14px; }
@keyframes pulse { 0% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 0.9; } }
</style>

<style scoped>
/* 暗色模式覆盖 */
:global(.layout.dark) .technical-task-create .overlay-text { color: #e8e8e8; }
:global(.layout.dark) .technical-task-create .page-overlay { background: rgba(0,0,0,0.55); }
</style>
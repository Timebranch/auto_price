<template>
  <div class="page technical-task-create">
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
          <a-form-item label="技术人员" :rules="[{ required: true, message: '必填' }]">
            <a-input v-model:value="technicianName" placeholder="请输入技术人员用户名" />
            <div class="tip">临时方案：输入技术人员用户名（后端将根据用户名解析ID）。</div>
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
import { ref, onMounted } from 'vue'
import type { UploadProps, UploadFile } from 'ant-design-vue'
import { useRouter, useRoute } from 'vue-router'
import { technicalTasksApi, type CreateTechnicalTaskPayload, type TechnicalTaskListItem } from '../api/technicalTasks'

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
  client_contact_name: '',
  client_contact_phone: '',
  start_time: '',
  deadline: '',
  deliverables: [],
  status: 'active',
  attachmentFile: null
})
const salesOwnerName = ref('')
const technicianName = ref('')
const startDate = ref('')
const deadline = ref('')
const deliverables = ref<string[]>([''])
const fileList = ref<UploadFile[]>([])
const submitting = ref(false)

function addDeliverable() { deliverables.value.push('') }
function removeDeliverable(idx: number) { deliverables.value.splice(idx, 1) }
const onFileChange: UploadProps['onChange'] = (info) => {
  fileList.value = info.fileList.slice(-1)
  const origin = fileList.value[0]?.originFileObj as File | undefined
  form.value.attachmentFile = origin ?? null
}

async function submit(status: 'draft'|'active') {
  // 校验
  if (!form.value.project_name || !form.value.customer_name || !salesOwnerName.value || !technicianName.value || !form.value.client_contact_name || !form.value.client_contact_phone || !startDate.value || !deadline.value || deliverables.value.filter(v => v && v.trim()).length === 0 || !form.value.attachmentFile) {
    window.$message?.error?.('请完整填写所有必填项并上传ZIP文件')
    return
  }
  submitting.value = true
  try {
    // 由后端根据用户名解析ID（销售默认当前用户）
    form.value.sales_owner_username = salesOwnerName.value
    form.value.technician_username = technicianName.value
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
function saveAndGenerate() { submit('active') }
function goBack() {
  // 清空表单并返回
  form.value = { project_name: '', customer_name: '', sales_owner_id: 0, technician_id: 0, client_contact_name: '', client_contact_phone: '', start_time: '', deadline: '', deliverables: [], status: 'active', attachmentFile: null }
  salesOwnerName.value = ''
  technicianName.value = ''
  startDate.value = ''
  deadline.value = ''
  deliverables.value = ['']
  fileList.value = []
  router.push('/technical-tasks')
}

onMounted(async () => {
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
  technicianName.value = rec.technician_name || ''
  startDate.value = rec.start_time || ''
  deadline.value = rec.deadline || ''
  // deliverables 字段后端可能未返回，保持原状或留空
}
</script>

<style scoped>
.technical-task-create { padding: 16px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.tip { color: #999; font-size: 12px; margin-top: 4px; }
.form-actions { display: flex; gap: 10px; margin-top: 16px; }
</style>
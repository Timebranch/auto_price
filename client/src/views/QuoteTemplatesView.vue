<template>
  <div class="quote-templates-container">
    <div class="header">
      <h1>报价模板管理</h1>
      <a-space>
        <!-- 未来可加入：新增模板、导入/导出 -->
        <a-button disabled>新增模板（开发中）</a-button>
      </a-space>
    </div>

    <a-card>
      <a-table
        :columns="columns"
        :data-source="templates"
        :loading="loading"
        row-key="id"
        :pagination="{ pageSize: 8 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'updated_at'">
            {{ formatDate(record.updated_at) }}
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-space>
              <a-button size="small" @click="viewTemplate(record.id)">查看</a-button>
              <a-button size="small" disabled @click="editTemplate(record.id)">编辑（开发中）</a-button>
              <a-button size="small" disabled>设为默认（开发中）</a-button>
              <a-button size="small" danger disabled>删除（开发中）</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:visible="detailVisible" title="模板详情" :footer="null" width="720px">
      <div v-if="currentTemplate">
        <a-descriptions bordered :column="1" size="small">
          <a-descriptions-item label="模板名称">{{ currentTemplate.name }}</a-descriptions-item>
          <a-descriptions-item label="模板说明">{{ currentTemplate.description }}</a-descriptions-item>
          <a-descriptions-item label="最后更新">{{ formatDate(currentTemplate.updated_at) }}</a-descriptions-item>
        </a-descriptions>
        <a-divider />
        <a-typography-title :level="5">字段定义（JSON）</a-typography-title>
        <a-code style="width: 100%;" :code="prettyFields" language="json" />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { message } from 'ant-design-vue'
import { quoteApi, type QuoteTemplate } from '@/api/quote'

const loading = ref(false)
const templates = ref<QuoteTemplate[]>([])
const detailVisible = ref(false)
const currentTemplate = ref<QuoteTemplate | null>(null)

const columns = [
  { title: '模板名称', dataIndex: 'name', key: 'name' },
  { title: '说明', dataIndex: 'description', key: 'description' },
  { title: '最后更新', key: 'updated_at' },
  { title: '操作', key: 'actions' }
]

const fetchTemplates = async () => {
  loading.value = true
  try {
    const res = await quoteApi.getTemplates()
    templates.value = res.data
  } catch (err) {
    message.error('获取模板列表失败')
    console.error('获取模板列表失败:', err)
  } finally {
    loading.value = false
  }
}

const formatDate = (s: string) => new Date(s).toLocaleString('zh-CN')

const viewTemplate = async (id: number) => {
  try {
    const res = await quoteApi.getTemplate(id)
    currentTemplate.value = res.data
    detailVisible.value = true
  } catch (err) {
    message.error('获取模板详情失败')
    console.error('获取模板详情失败:', err)
  }
}

const editTemplate = (id: number) => {
  // 暂未开放编辑功能，保留入口并使用参数避免未使用变量诊断
  message.info(`模板编辑功能开发中（ID: ${id}）`)
}

const prettyFields = computed(() => {
  try {
    const raw = currentTemplate.value?.fields || '[]'
    const obj = JSON.parse(raw)
    return JSON.stringify(obj, null, 2)
  } catch {
    return currentTemplate.value?.fields || '[]'
  }
})

onMounted(fetchTemplates)
</script>

<style scoped>
.quote-templates-container { padding: 24px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
</style>
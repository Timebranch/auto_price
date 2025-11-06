<template>
  <div class="quote-list-container">
    <div class="header">
      <div />
      <a-space>
        <a-button v-if="isAdmin" @click="goTemplates">管理模板</a-button>
        <a-button v-if="isAdmin" @click="createMockQuote">Mock报价单</a-button>
        <a-button type="primary" @click="createQuote">
          <template #icon>
            <PlusOutlined />
          </template>
          新建报价单
        </a-button>
      </a-space>
    </div>

    <!-- 筛选区：日期范围 + 报价标题搜索 -->
    <div class="filters">
      <a-space wrap>
        <a-range-picker v-model:value="dateRange" :allowClear="false" />
        <a-input-search v-model:value="searchText" placeholder="按客户名称筛选" style="width: 260px" allowClear />
        <a-select
          v-if="isAdmin"
          v-model:value="selectedSales"
          :options="salesOptions"
          placeholder="按销售筛选"
          style="width: 200px"
          allowClear
        />
      </a-space>
    </div>

    <!-- 汇总卡片：筛选范围内的统计 -->
    <div class="summary">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-card>
            <a-statistic title="筛选内草稿数量" :value="draftCount" />
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card>
            <a-statistic title="筛选内已完成数量" :value="completedCount" />
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card>
            <a-statistic title="筛选内报价总数" :value="totalCount" />
          </a-card>
        </a-col>
      </a-row>
    </div>

    <a-table 
      :columns="columns" 
      :data-source="filteredQuotes" 
      :loading="loading"
      row-key="id"
      :pagination="pagination"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 'completed' ? 'green' : 'orange'">
            {{ record.status === 'completed' ? '已完成' : '草稿' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'created_at'">
          {{ formatDate(record?.createdAtLocal || '') }}
        </template>
        <template v-else-if="column.key === 'customerName'">
          {{ record.customerName || '-' }}
        </template>
        <template v-else-if="column.key === 'sales'">
          {{ record.sales_full_name || record.sales_username || '-' }}
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-space>
            <a-button size="small" @click="editQuote(record.id)">编辑</a-button>
            <!-- 移除“查看”按钮：与编辑跳转一致，避免重复入口 -->
            <a-button 
              v-if="record.status === 'completed' && record.generated_pdf_path" 
              size="small" 
              @click="downloadPDF(record.id)"
            >
              下载PDF
            </a-button>
            <a-popconfirm
              title="确定要删除这个报价单吗？"
              @confirm="deleteQuote(record.id)"
            >
              <a-button size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { quoteApi, type QuoteRecord } from '@/api/quote'
import { useAuthStore } from '@/stores/auth'
import dayjs, { Dayjs } from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import customParseFormat from 'dayjs/plugin/customParseFormat'
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.extend(customParseFormat)

type QuoteRecordWithLocal = QuoteRecord & { created_at_local?: string }

const router = useRouter()
const authStore = useAuthStore()
const isAdmin = computed(() => authStore.isAdmin)
const loading = ref(false)
const quotes = ref<QuoteRecord[]>([])
const dateRange = ref<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')])
const searchText = ref('')
const selectedSales = ref<number | null>(null)

const columns = [
  {
    title: '客户公司名称',
    dataIndex: 'customerName',
    key: 'customerName',
  },
  {
    title: '销售',
    dataIndex: 'sales',
    key: 'sales',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
  },
  {
    title: '操作',
    key: 'actions',
  },
]

const pagination = {
  pageSize: 10,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
}

const fetchQuotes = async () => {
  loading.value = true
  try {
    const response = await quoteApi.getQuoteRecords()
    quotes.value = response.data
  } catch (error) {
    message.error('获取报价单列表失败')
    console.error('获取报价单列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 过滤逻辑：日期范围 + 标题包含（兼容 SQLite `YYYY-MM-DD HH:mm:ss` 格式）
const inRange = (d: string) => {
  const date = dayjs(d, 'YYYY-MM-DD HH:mm:ss', true)
  if (!date.isValid()) {
    // 回退：尝试 ISO 解析（将空格替换为 T），若仍无效则不排除该记录
    const iso = dayjs(d.includes('T') ? d : d.replace(' ', 'T'))
    if (!iso.isValid()) return true
    return iso.isSameOrAfter(dateRange.value[0], 'day') && iso.isSameOrBefore(dateRange.value[1], 'day')
  }
  return date.isSameOrAfter(dateRange.value[0], 'day') && date.isSameOrBefore(dateRange.value[1], 'day')
}
// 改为按客户名称搜索
const customerMatch = (q: QuoteRecord) => getCustomerName(q).toLowerCase().includes(searchText.value.trim().toLowerCase())
const getCustomerName = (q: QuoteRecord) => {
  try {
    const obj = JSON.parse(q.form_data as unknown as string)
    const val = (obj as Record<string, unknown>)?.['customerName']
    return typeof val === 'string' ? val : ''
  } catch {
    return ''
  }
}
const filteredQuotes = computed(() =>
  quotes.value
    .filter(q => inRange(q.created_at) && customerMatch(q) && (!isAdmin.value || selectedSales.value === null || q.user_id === selectedSales.value))
    .map(q => {
      const qr = q as QuoteRecordWithLocal
      return {
        ...q,
        customerName: getCustomerName(q),
        createdAtLocal: qr.created_at_local ?? q.created_at,
      }
    })
)

// 汇总统计（基于筛选结果）
const completedCount = computed(() => filteredQuotes.value.filter(q => q.status === 'completed').length)
const draftCount = computed(() => filteredQuotes.value.filter(q => q.status !== 'completed').length)
const totalCount = computed(() => filteredQuotes.value.length)

const createQuote = () => {
  router.push('/quotes/create')
}

const createMockQuote = () => {
  router.push({ path: '/quotes/create', query: { mock: '1' } })
}

const goTemplates = () => {
  router.push('/quotes/templates')
}

const editQuote = (id: number) => {
  router.push(`/quotes/edit/${id}`)
}

// 移除与编辑一致的查看方法，避免重复

const downloadPDF = async (id: number) => {
  try {
    const response = await quoteApi.downloadPDF(id)
    // 使用后端生成的文件名（generated_pdf_path 的 basename）
    const rec = quotes.value.find(q => q.id === id)
    let filename = `quote_${id}.pdf`
    if (rec?.generated_pdf_path) {
      const base = String(rec.generated_pdf_path).split('/').pop()
      if (base && base.endsWith('.pdf')) {
        filename = base
      } else if (base) {
        filename = `${base}.pdf`
      }
    }
    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    message.error('下载PDF失败')
    console.error('下载PDF失败:', error)
  }
}

const deleteQuote = async (id: number) => {
  try {
    await quoteApi.deleteQuoteRecord(id)
    message.success('删除成功')
    fetchQuotes()
  } catch (error) {
    message.error('删除失败')
    console.error('删除失败:', error)
  }
}

const formatDate = (dateString?: string) => {
  if (!dateString) return ''
  const d = dayjs(dateString, 'YYYY-MM-DD HH:mm:ss', true)
  if (d.isValid()) return d.format('YYYY-MM-DD HH:mm:ss')
  const normalized = dateString.includes('T') ? dateString : dateString.replace(' ', 'T')
  const iso = dayjs(normalized)
  return iso.isValid() ? iso.format('YYYY-MM-DD HH:mm:ss') : dateString
}

onMounted(() => {
  fetchQuotes()
})

const salesOptions = computed(() => {
  const map = new Map<number, string>()
  quotes.value.forEach(q => {
    if (typeof q.user_id === 'number') {
      const label = (q.sales_full_name || q.sales_username || `用户#${q.user_id}`)
      if (!map.has(q.user_id)) {
        map.set(q.user_id, label)
      }
    }
  })
  return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
})
</script>

<style scoped>
.quote-list-container {
  padding: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.filters { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.summary { margin-bottom: 16px; }

/* 汇总卡片：交替浅色背景（1/2/3） */
.summary .ant-row > .ant-col:nth-child(1) .ant-card { background: #fff7e6; }
.summary .ant-row > .ant-col:nth-child(2) .ant-card { background: #e6f7ff; }
.summary .ant-row > .ant-col:nth-child(3) .ant-card { background: #f6ffed; }

/* 已移除标题，不再需要 .header h1 样式 */
</style>

<style scoped>
/* 暗色模式覆盖：列表与汇总卡片避免白色背景 */
:global(.layout.dark) .quote-list-container :deep(.ant-card) { background: #1a1a1a; border-color: #303030; }
:global(.layout.dark) .quote-list-container .summary :deep(.ant-card) { background: #1a1a1a; }
:global(.layout.dark) .quote-list-container :deep(.ant-table) { background: #1a1a1a; }
:global(.layout.dark) .quote-list-container :deep(.ant-table-tbody > tr > td) { background: #141414; }
</style>
<template>
  <div class="quote-list-container">
    <div class="header">
      <!-- 移除页面大标题“报价单管理” -->
      <a-button type="primary" @click="createQuote">
        <template #icon>
          <PlusOutlined />
        </template>
        新建报价单
      </a-button>
    </div>

    <a-table 
      :columns="columns" 
      :data-source="quotes" 
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
          {{ formatDate(record.created_at) }}
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-space>
            <a-button size="small" @click="editQuote(record.id)">编辑</a-button>
            <a-button size="small" @click="viewQuote(record.id)">查看</a-button>
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { quoteApi, type QuoteRecord } from '@/api/quote'

const router = useRouter()
const loading = ref(false)
const quotes = ref<QuoteRecord[]>([])

const columns = [
  {
    title: '报价单标题',
    dataIndex: 'title',
    key: 'title',
  },
  {
    title: '模板名称',
    dataIndex: 'template_name',
    key: 'template_name',
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

const createQuote = () => {
  router.push('/quotes/create')
}

const editQuote = (id: number) => {
  router.push(`/quotes/edit/${id}`)
}

const viewQuote = (id: number) => {
  // 可以跳转到详情页面或者打开模态框
  router.push(`/quotes/edit/${id}`)
}

const downloadPDF = async (id: number) => {
  try {
    const response = await quoteApi.downloadPDF(id)
    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `quote_${id}.pdf`)
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

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchQuotes()
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

/* 已移除标题，不再需要 .header h1 样式 */
</style>
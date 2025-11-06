<template>
  <div class="dashboard-container">
    <!-- 统计卡片 -->
    <a-row :gutter="[24, 16]" style="margin-bottom: 24px;">
      <a-col :xs="24" :sm="12" :md="6">
        <a-card class="stat-card">
          <a-statistic
            title="总报价单数"
            :value="statistics.totalQuotes"
            :value-style="{ color: '#fa8c16' }"
          >
            <template #prefix>
              <FileTextOutlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :md="6">
        <a-card class="stat-card">
          <a-statistic
            title="已完成"
            :value="statistics.completedQuotes"
            :value-style="{ color: '#52c41a' }"
          >
            <template #prefix>
              <CheckCircleOutlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :md="6">
        <a-card class="stat-card">
          <a-statistic
            title="草稿"
            :value="statistics.draftQuotes"
            :value-style="{ color: '#fa8c16' }"
          >
            <template #prefix>
              <EditOutlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :md="6">
        <a-card class="stat-card">
          <a-statistic
            title="本月新增"
            :value="statistics.monthlyQuotes"
            :value-style="{ color: '#fa8c16' }"
          >
            <template #prefix>
              <CalendarOutlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 快速操作 -->
    <a-card title="快速操作" class="action-card" style="margin-bottom: 24px;">
      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :sm="12" :md="6">
          <a-button type="primary" size="large" block class="action-btn" @click="createQuote">
            <template #icon>
              <PlusOutlined />
            </template>
            新建报价单
          </a-button>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-button size="large" block class="action-btn" @click="viewAllQuotes">
            <template #icon>
              <UnorderedListOutlined />
            </template>
            查看所有报价
          </a-button>
        </a-col>
        <a-col v-if="isAdmin" :xs="24" :sm="12" :md="6">
          <a-button size="large" block class="action-btn" @click="viewTemplates">
            <template #icon>
              <FileOutlined />
            </template>
            模板管理
          </a-button>
        </a-col>
        <a-col v-if="isAdmin" :xs="24" :sm="12" :md="6">
          <a-button size="large" block class="action-btn" @click="exportData">
            <template #icon>
              <DownloadOutlined />
            </template>
            导出数据
          </a-button>
        </a-col>
      </a-row>
    </a-card>

    <!-- 最近的报价单 -->
    <a-card title="最近的报价单" class="recent-quotes-card">
      <template #extra>
        <a-button type="link" @click="viewAllQuotes">查看全部</a-button>
      </template>
      
      <div class="table-responsive">
        <a-table 
          :columns="columns" 
          :data-source="recentQuotes" 
          :loading="loading"
          row-key="id"
          :pagination="false"
          size="small"
          :scroll="{ x: 800 }"
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
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { 
  PlusOutlined, 
  FileTextOutlined, 
  CheckCircleOutlined, 
  EditOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  FileOutlined,
  DownloadOutlined
} from '@ant-design/icons-vue'
import { quoteApi, type QuoteRecord } from '../api/quote'

const router = useRouter()
const loading = ref(false)
const quotes = ref<QuoteRecord[]>([])

// 统计数据
const statistics = computed(() => {
  const total = quotes.value.length
  const completed = quotes.value.filter(q => q.status === 'completed').length
  const draft = quotes.value.filter(q => q.status === 'draft').length
  
  // 计算本月新增
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const monthly = quotes.value.filter(q => {
    const createdDate = new Date(q.created_at)
    return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear
  }).length

  return {
    totalQuotes: total,
    completedQuotes: completed,
    draftQuotes: draft,
    monthlyQuotes: monthly
  }
})

// 最近的报价单（最多显示5条）
const recentQuotes = computed(() => {
  return quotes.value
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
})

// 表格列定义
const columns = [
  {
    title: '标题',
    dataIndex: 'title',
    key: 'title',
  },
  {
    title: '模板',
    dataIndex: 'template_name',
    key: 'template_name',
  },
  {
    title: '状态',
    key: 'status',
  },
  {
    title: '创建时间',
    key: 'created_at',
  },
  {
    title: '操作',
    key: 'actions',
  },
]

// 获取报价单列表
const fetchQuotes = async () => {
  try {
    loading.value = true
    const response = await quoteApi.getQuoteRecords()
    quotes.value = response.data
  } catch (error) {
    console.error('获取报价单失败:', error)
    message.error('获取报价单失败')
  } finally {
    loading.value = false
  }
}

// 格式化日期
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('zh-CN')
}

// 操作方法
const createQuote = () => {
  router.push('/quotes/create')
}

const viewAllQuotes = () => {
  router.push('/quotes')
}

const viewTemplates = () => {
  message.info('模板管理功能开发中...')
}

const exportData = () => {
  message.info('数据导出功能开发中...')
}

const editQuote = (id: number) => {
  router.push(`/quotes/edit/${id}`)
}

const viewQuote = (id: number) => {
  router.push(`/quotes/view/${id}`)
}

const downloadPDF = async (id: number) => {
  try {
    const response = await quoteApi.downloadPDF(id)
    const blob = new Blob([response.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    // 使用后端生成的文件名
    const rec = quotes.value.find(q => q.id === id)
    let filename = `quote-${id}.pdf`
    if (rec?.generated_pdf_path) {
      const base = String(rec.generated_pdf_path).split('/').pop()
      if (base && base.endsWith('.pdf')) {
        filename = base
      } else if (base) {
        filename = `${base}.pdf`
      }
    }
    link.download = filename
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下载PDF失败:', error)
    message.error('下载PDF失败')
  }
}

onMounted(() => {
  fetchQuotes()
})
import { useAuthStore } from '../stores/auth'
const authStore = useAuthStore()
const isAdmin = computed(() => authStore.isAdmin)

// 原有 viewTemplates 方法保留，仅管理员看到按钮
</script>

<style scoped>
.dashboard-container {
  padding: 0;
  width: 100%;
}

.ant-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.ant-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.stat-card .ant-statistic {
  text-align: center;
}

.action-btn {
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
}

.table-responsive {
  overflow-x: auto;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .dashboard-container {
    padding: 0 16px;
  }
}

@media (max-width: 768px) {
  .ant-col {
    margin-bottom: 16px;
  }
  
  .action-btn {
    height: 50px;
    font-size: 12px;
  }
  
  .dashboard-container {
    padding: 0 12px;
  }
}

@media (max-width: 576px) {
  .dashboard-container {
    padding: 0 8px;
  }
  
  .ant-statistic-title {
    font-size: 12px;
  }
  
  .ant-statistic-content-value {
    font-size: 20px;
  }
}

/* 统计卡片动画 */
.ant-card .ant-statistic {
  transition: all 0.3s ease;
}

.ant-card:hover .ant-statistic-content-value {
  transform: scale(1.05);
}

/* 表格样式优化 */
.ant-table-wrapper {
  background: #ffffff;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  padding: 16px;
  overflow: hidden;
  border: 1px solid #3a3a3a;
}

.ant-table-thead > tr > th {
  background: #fafafa !important;
  color: #595959 !important;
  font-weight: 600;
  color: #e0e0e0;
}

.ant-table-tbody > tr:hover > td {
  background: #f5f5f5 !important;
}
</style>
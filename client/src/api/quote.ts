import axios from 'axios'

// 生产环境通过 VITE_API_BASE_URL 注入远端基础地址；本地开发走同源 Vite 代理
const API_BASE = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || ''
const API_BASE_URL = `${API_BASE.replace(/\/$/, '')}/api`

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 添加认证token
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    console.error('API请求失败:', error)
    // 处理认证错误
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export interface QuoteTemplate {
  id: number
  name: string
  description: string
  template_html: string
  fields: string
  created_at: string
  updated_at: string
}

export interface QuoteRecord {
  id: number
  template_id: number
  title: string
  form_data: string
  generated_pdf_path?: string
  status: 'draft' | 'completed'
  created_at: string
  updated_at: string
  template_name?: string
  // 新增：创建者用户及销售信息（后端已联表返回）
  user_id?: number
  sales_username?: string
  sales_full_name?: string
  sales_phone?: string
  created_at_local?: string
}

export const quoteApi = {
  // 获取所有报价模板
  getTemplates: () => api.get<QuoteTemplate[]>('/quotes/templates'),

  // 获取指定模板
  getTemplate: (id: number) => api.get<QuoteTemplate>(`/quotes/templates/${id}`),

  // 创建新的报价记录
  createQuoteRecord: (data: {
    template_id: number
    title: string
    form_data: Record<string, unknown>
  }) => api.post<QuoteRecord>('/quotes/records', data),

  // 获取所有报价记录
  getQuoteRecords: () => api.get<QuoteRecord[]>('/quotes/records'),

  // 获取指定报价记录
  getQuoteRecord: (id: number) => api.get<QuoteRecord>(`/quotes/records/${id}`),

  // 更新报价记录
  updateQuoteRecord: (id: number, data: {
    title: string
    form_data: Record<string, unknown>
    status?: 'draft' | 'completed'
  }) => api.put<QuoteRecord>(`/quotes/records/${id}`, data),

  // 删除报价记录
  deleteQuoteRecord: (id: number) => api.delete(`/quotes/records/${id}`),

  // 生成PDF
  generatePDF: (id: number) => api.post(`/quotes/records/${id}/generate-pdf`, {}, { timeout: 60000 }),

  // 下载PDF
  downloadPDF: (id: number) => api.get(`/quotes/records/${id}/download`, {
    responseType: 'blob'
  }),
  // 上传签章图片（表单字段名 stamp，限制 5MB，仅图片）
  uploadStamp: (file: File) => {
    const formData = new FormData()
    formData.append('stamp', file)
    return api.post<{ url: string; path: string }>(`/quotes/upload-stamp`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  // 上传报价项目图片（表单字段名 itemsImage，限制 5MB，仅图片）
  uploadItemsImage: (file: File) => {
    const formData = new FormData()
    formData.append('itemsImage', file)
    return api.post<{ url: string; path: string }>(`/quotes/upload-items-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}
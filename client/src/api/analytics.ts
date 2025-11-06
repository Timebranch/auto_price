import axios from 'axios'

// 基础地址与 axios 实例（与 admin.ts 保持一致）；本地通过 Vite 代理同源访问
const API_BASE = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || ''
const API_BASE_URL = `${API_BASE.replace(/\/$/, '')}/api`

const api = axios.create({ baseURL: API_BASE_URL, timeout: 10000 })

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export interface SalesDailyRow {
  day: string // YYYY-MM-DD
  user_id: number
  username: string
  count: number
}

export interface SalesDailyResponse {
  start: string
  end: string
  userId?: number
  data: SalesDailyRow[]
}

export interface UserQuotesRecord {
  id: number
  title: string
  status: 'draft' | 'completed'
  generated_pdf_path?: string
  created_at: string
  username: string
}

export interface UserQuotesResponse {
  start: string
  end: string
  userId: number
  records: UserQuotesRecord[]
}

export const analyticsApi = {
  getSalesDaily: (params: { start?: string; end?: string; userId?: number }) =>
    api.get<SalesDailyResponse>('/admin/analytics/sales-daily', { params }),
  getUserQuotes: (params: { start?: string; end?: string; userId: number }) =>
    api.get<UserQuotesResponse>('/admin/analytics/user-quotes', { params }),
}

export default analyticsApi
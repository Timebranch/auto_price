import axios from 'axios'

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

export interface SettlementListRow {
  id: number
  delivery_id: number
  order_name: string
  customer_name: string
  delivery_date: string
  address?: string
  shipper_name?: string
  created_at: string
  updated_at: string
}

export interface SettlementDetail {
  id: number
  delivery_id: number
  order_name: string
  customer_name: string
  delivery_date: string
  address?: string
  shipper_name?: string
  total_price: number
  items: SettlementItem[]
}

export interface SettlementUpsertPayload {
  delivery_id: number
  order_name: string
  customer_name: string
  delivery_date: string
  address?: string
  shipper_name?: string
  items: SettlementItem[]
  total_price: number
}

// 结算单中的单条明细类型（兼容后端字段）
export interface SettlementItem {
  product_name: string
  material?: string
  spec?: string
  quantity: number | string
  unit: string
  unit_price: number | string
  price: number | string
  remark?: string
}

export const settlementsApi = {
  list: (params: { orderName?: string; customerName?: string; shipperName?: string } = {}) =>
    api.get<SettlementListRow[]>('/settlements', { params }),
  getOne: (id: number) => api.get<SettlementDetail>(`/settlements/${id}`),
  upsert: (payload: SettlementUpsertPayload) => api.post('/settlements/upsert', payload),
  downloadUrl: (id: number) => `${API_BASE_URL}/settlements/${id}/download`,
  download: (id: number) => api.get(`/settlements/${id}/download`, { responseType: 'blob' }),
}

export default settlementsApi
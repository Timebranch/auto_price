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

export interface DeliveryNote {
  id: number
  order_name: string
  customer_name: string
  delivery_time: string // YYYY-MM-DD HH:mm:ss
  created_by: number
  file_path?: string
  status?: 'draft' | 'pending_review' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

export interface DeliveryItemInput {
  product_name: string
  material?: string
  spec: string
  length: string
  quantity: number
  unit: string
  unit_weight?: string
  total_weight?: string
  remark?: string
}

export interface DeliveryCreatePayload {
  order_name: string
  customer_name: string
  delivery_date?: string // YYYY-MM-DD（表单日期组件）
  delivery_time?: string // 可选，完整日期时间
  items: DeliveryItemInput[]
  license_plate: string
  driver_name: string
  driver_phone: string
  receiver_name: string
  receiver_phone: string
  shipper_name: string
  shipper_phone: string
  address: string
  note?: string
  status?: 'draft' | 'pending_review'
}

export const deliveryApi = {
  list: (params: { orderName?: string; customerName?: string } = {}) =>
    api.get<DeliveryNote[]>('/deliveries', { params }),
  getOne: (id: number) => api.get(`/deliveries/${id}`),
  create: (payload: DeliveryCreatePayload) => api.post('/deliveries', payload),
  downloadUrl: (id: number) => `${API_BASE_URL}/deliveries/${id}/download`,
  // 通过认证请求获取文件 Blob（用于需要 Authorization 的下载接口）
  download: (id: number) => api.get(`/deliveries/${id}/download`, { responseType: 'blob' }),
  updateStatus: (id: number, status: 'approved' | 'rejected' | 'pending_review' | 'draft') =>
    api.patch(`/deliveries/${id}/status`, { status })
}

export default deliveryApi
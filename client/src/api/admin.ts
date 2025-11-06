import axios from 'axios'

// 生产环境通过 VITE_API_BASE_URL 注入远端基础地址；本地开发走同源 Vite 代理
const API_BASE = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || ''
const API_BASE_URL = `${API_BASE.replace(/\/$/, '')}/api`

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// 请求拦截器 - 添加认证token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      // 与 quote.ts 保持一致的用法，避免 any 断言
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器 - 处理认证错误
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

export interface AdminUser {
  id: number
  username: string
  email?: string
  phone?: string
  full_name?: string
  avatar_url?: string
  role: 'admin' | 'user' | 'sales' | 'finance' | 'technician'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateUserRequest {
  username: string
  phone: string
  password: string
  role: 'admin' | 'user' | 'sales' | 'finance' | 'technician'
  email?: string
}

export interface UpdateUserRequest {
  username?: string
  phone?: string
  email?: string
  fullName?: string
  password?: string
}

export const adminApi = {
  // 获取用户列表
  getUsers: () => api.get<AdminUser[]>('/admin/users'),

  // 创建用户
  createUser: (data: CreateUserRequest) => api.post('/admin/users', data),

  // 禁用（删除）用户
  disableUser: (id: number) => api.delete(`/admin/users/${id}`),

  // 启用用户
  activateUser: (id: number) => api.put(`/admin/users/${id}/activate`),

  // 更新角色
  updateRole: (id: number, role: 'admin' | 'user' | 'sales' | 'finance' | 'technician') => api.put(`/admin/users/${id}/role`, { role }),

  // 更新用户信息
  updateUser: (id: number, data: UpdateUserRequest) => api.put(`/admin/users/${id}`, data),
}

export default adminApi
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

export interface KnowledgeArticle {
  id: number
  title: string
  content: string
  author_id?: number
  created_at: string
  updated_at: string
}

export const knowledgeApi = {
  list: () => api.get<KnowledgeArticle[]>('/knowledge'),
  create: (data: { title: string; content: string }) => api.post('/knowledge', data),
  update: (id: number, data: { title: string; content: string }) => api.put(`/knowledge/${id}`, data),
  delete: (id: number) => api.delete(`/knowledge/${id}`),
  clearMock: () => api.delete('/knowledge/mock'),
}

export default knowledgeApi
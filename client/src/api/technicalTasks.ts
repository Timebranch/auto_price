import api from './index.ts'

export interface TechnicalTaskListItem {
  id: number
  project_name: string
  customer_name: string
  sales_owner_name: string
  technician_name?: string
  client_contact_name: string
  client_contact_phone: string
  start_time: string
  deadline: string
  status: 'draft' | 'active' | 'completed'
  author_id: number
  created_at: string
  updated_at: string
  // 可选：后端返回的附件路径/标识
  attachments_path?: string | null
}

export interface TechnicalTaskQuery {
  projectName?: string
  customerName?: string
  deadlineBefore?: string // YYYY-MM-DD
}

export interface CreateTechnicalTaskPayload {
  project_name: string
  customer_name: string
  sales_owner_id: number
  technician_id: number
  // 可选：使用用户名由后端解析ID
  sales_owner_username?: string
  technician_username?: string
  client_contact_name: string
  client_contact_phone: string
  start_time: string // ISO
  deadline: string   // ISO
  deliverables: string[]
  status: 'draft' | 'active' | 'completed'
  attachmentFile?: File | null
}

export const technicalTasksApi = {
  list: async (query: TechnicalTaskQuery = {}) => {
    const params = new URLSearchParams()
    if (query.projectName) params.set('projectName', query.projectName)
    if (query.customerName) params.set('customerName', query.customerName)
    if (query.deadlineBefore) params.set('deadlineBefore', query.deadlineBefore)
    const { data } = await api.get<TechnicalTaskListItem[]>(`/technical-tasks?${params.toString()}`)
    return data
  },
  create: async (payload: CreateTechnicalTaskPayload) => {
    const fd = new FormData()
    fd.set('project_name', payload.project_name)
    fd.set('customer_name', payload.customer_name)
    fd.set('sales_owner_id', String(payload.sales_owner_id || 0))
    fd.set('technician_id', String(payload.technician_id || 0))
    if (payload.sales_owner_username) fd.set('sales_owner_username', payload.sales_owner_username)
    if (payload.technician_username) fd.set('technician_username', payload.technician_username)
    fd.set('client_contact_name', payload.client_contact_name)
    fd.set('client_contact_phone', payload.client_contact_phone)
    fd.set('start_time', payload.start_time)
    fd.set('deadline', payload.deadline)
    fd.set('deliverables', JSON.stringify(payload.deliverables))
    fd.set('status', payload.status)
    if (payload.attachmentFile) {
      fd.set('attachment', payload.attachmentFile)
    }
    const { data } = await api.post('/technical-tasks', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    return data as { id: number, status: 'draft'|'active', attachments_path?: string | null }
  },
  getOne: async (id: number) => {
    const { data } = await api.get<TechnicalTaskListItem>(`/technical-tasks/${id}`)
    return data
  },
  update: async (id: number, payload: CreateTechnicalTaskPayload) => {
    const fd = new FormData()
    fd.set('project_name', payload.project_name)
    fd.set('customer_name', payload.customer_name)
    if (payload.sales_owner_username) fd.set('sales_owner_username', payload.sales_owner_username)
    if (payload.technician_username) fd.set('technician_username', payload.technician_username)
    fd.set('client_contact_name', payload.client_contact_name)
    fd.set('client_contact_phone', payload.client_contact_phone)
    fd.set('start_time', payload.start_time)
    fd.set('deadline', payload.deadline)
    fd.set('deliverables', JSON.stringify(payload.deliverables))
    fd.set('status', payload.status)
    if (payload.attachmentFile) {
      fd.set('attachment', payload.attachmentFile)
    }
    const { data } = await api.put(`/technical-tasks/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    return data as { id: number, status: 'draft'|'active'|'completed', attachments_path?: string | null }
  },
  downloadAttachment: async (id: number) => api.get(`/technical-tasks/${id}/attachment`, { responseType: 'blob' }),
  downloadCardPdf: async (id: number) => api.get(`/technical-tasks/${id}/collaboration-card/download`, { responseType: 'blob' }),
  downloadAttachmentUrl: (id: number) => `${(import.meta.env?.VITE_API_BASE_URL as string | undefined) || ''}/api/technical-tasks/${id}/attachment`,
  downloadCardPdfUrl: (id: number) => `${(import.meta.env?.VITE_API_BASE_URL as string | undefined) || ''}/api/technical-tasks/${id}/collaboration-card/download`
}
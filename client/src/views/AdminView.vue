<template>
  <div class="admin-container">
    <!-- 页面标题移除：不显示“用户管理” -->
    <div class="header">
      <a-button type="primary" @click="modalOpen = true">新增用户</a-button>
    </div>

    <div class="table-responsive">
      <a-table :columns="userColumns" :data-source="users" row-key="id" :loading="loading">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <a-tag :color="record.role === 'admin' ? 'orange' : record.role === 'finance' ? 'purple' : record.role === 'technician' ? 'geekblue' : 'blue'">
              {{ record.role === 'admin' ? '管理员' : record.role === 'finance' ? '财务' : record.role === 'technician' ? '技术员' : '销售人员' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'is_active'">
            <a-tag :color="record.is_active ? 'green' : 'red'">{{ record.is_active ? '启用' : '禁用' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-space>
              <a-popconfirm title="确认禁用该用户？" @confirm="disableUser(record.id)" v-if="record.is_active">
                <a-button size="small" danger>禁用</a-button>
              </a-popconfirm>
              <a-popconfirm title="确认启用该用户？" @confirm="activateUser(record.id)" v-else>
                <a-button size="small">启用</a-button>
              </a-popconfirm>
              <!-- 移除列表中的角色切换，下放到编辑弹框中 -->
              <a-button size="small" @click="openEdit(record)">编辑</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 新增用户弹窗 -->
    <a-modal v-model:open="modalOpen" title="新增用户" :confirm-loading="loading" @ok="createUser" @cancel="modalOpen = false">
      <a-form layout="vertical">
        <a-form-item label="用户名">
          <a-input v-model:value="newUser.username" placeholder="请输入用户名" />
        </a-form-item>
        <a-form-item label="手机号">
          <a-input v-model:value="newUser.phone" placeholder="请输入手机号" />
        </a-form-item>
        
        <a-form-item label="密码">
          <a-input-password v-model:value="newUser.password" placeholder="请输入密码" />
        </a-form-item>
        <a-form-item label="角色">
          <a-select v-model:value="newUser.role" style="width: 180px">
            <a-select-option value="user">销售人员</a-select-option>
            <a-select-option value="technician">技术员</a-select-option>
            <a-select-option value="admin">管理员</a-select-option>
            <a-select-option value="finance">财务</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑用户弹窗 -->
    <a-modal v-model:open="editOpen" title="编辑用户信息" :confirm-loading="loading" @ok="saveEdit" @cancel="editOpen = false">
      <a-form layout="vertical">
        <a-form-item label="用户名">
          <a-input v-model:value="editForm.username" placeholder="请输入用户名" />
        </a-form-item>
        <a-form-item label="手机号">
          <a-input v-model:value="editForm.phone" placeholder="请输入手机号" />
        </a-form-item>
        <!-- 新增：角色选择，统一在编辑弹框中处理角色变更 -->
        <a-form-item label="角色">
          <a-select v-model:value="editForm.role" style="width: 180px">
            <a-select-option value="user">销售人员</a-select-option>
            <a-select-option value="technician">技术员</a-select-option>
            <a-select-option value="admin">管理员</a-select-option>
            <a-select-option value="finance">财务</a-select-option>
          </a-select>
        </a-form-item>
        
        <!-- 如需支持姓名，可取消注释 -->
        <!-- <a-form-item label="姓名（可选)">
          <a-input v-model:value="editForm.fullName" placeholder="请输入姓名（可选）" />
        </a-form-item> -->
        <a-form-item label="重置密码（可选)">
          <a-input-password v-model:value="editForm.password" placeholder="请输入新密码（可选）" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import adminApi, { type AdminUser, type CreateUserRequest, type UpdateUserRequest } from '../api/admin'

const loading = ref(false)

const users = ref<AdminUser[]>([])
const modalOpen = ref(false)

const newUser = ref<CreateUserRequest>({ username: '', phone: '', password: '', role: 'user' })

const userColumns = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '手机号', dataIndex: 'phone', key: 'phone' },
  // 移除“姓名”列：创建用户时不需要该字段
  { title: '角色', key: 'role' },
  { title: '状态', key: 'is_active' },
  { title: '操作', key: 'actions' },
]

const fetchUsers = async () => {
  loading.value = true
  try {
    const response = await adminApi.getUsers()
    users.value = response.data
  } catch {
    message.error('获取用户列表失败')
  } finally {
    loading.value = false
  }
}

const createUser = async () => {
  // 必填项校验
  const u = newUser.value
  if (!u.username || u.username.trim().length === 0) {
    message.error('请输入用户名')
    return
  }
  if (!u.phone || u.phone.trim().length === 0) {
    message.error('请输入手机号')
    return
  }
  if (!u.password || u.password.trim().length === 0) {
    message.error('请输入密码')
    return
  }
  loading.value = true
  try {
    await adminApi.createUser({
      ...u,
      username: u.username.trim(),
      phone: u.phone.trim(),
      password: u.password.trim(),
    })
    message.success('创建用户成功')
    newUser.value = { username: '', phone: '', password: '', role: 'user' }
    modalOpen.value = false
    fetchUsers()
  } catch (err: unknown) {
    let msg = '创建用户失败'
    if (typeof err === 'object' && err !== null) {
      const resp = (err as { response?: { data?: unknown } }).response
      const data = resp?.data
      if (data && typeof data === 'object') {
        const d = data as { error?: unknown; message?: unknown }
        if (typeof d.error === 'string') {
          msg = d.error
        } else if (typeof d.message === 'string') {
          msg = d.message
        }
      } else if (typeof (err as { message?: unknown }).message === 'string') {
        msg = (err as { message: string }).message
      }
    }
    message.error(msg)
  } finally {
    loading.value = false
  }
}

const disableUser = async (id: number) => {
  loading.value = true
  try {
    await adminApi.disableUser(id)
    message.success('用户已禁用')
    fetchUsers()
  } catch {
    message.error('禁用用户失败')
  } finally {
    loading.value = false
  }
}

const activateUser = async (id: number) => {
  loading.value = true
  try {
    await adminApi.activateUser(id)
    message.success('用户已启用')
    fetchUsers()
  } catch {
    message.error('启用用户失败')
  } finally {
    loading.value = false
  }
}

// 编辑弹窗状态与表单
const editOpen = ref(false)
const editingId = ref<number | null>(null)
const originalRole = ref<'admin' | 'user' | 'sales' | 'finance' | 'technician'>('user')
const editForm = ref<UpdateUserRequest & { role: 'admin' | 'user' | 'sales' | 'finance' | 'technician' }>({ role: 'user' })

const openEdit = (record: AdminUser) => {
  editingId.value = record.id
  editForm.value = {
    username: record.username,
    phone: record.phone || '',
    role: record.role,
    // fullName: record.full_name || '', // 如需要姓名，可解注
  }
  originalRole.value = record.role
  editOpen.value = true
}

const saveEdit = async () => {
  if (!editingId.value) {
    editOpen.value = false
    return
  }
  loading.value = true
  try {
    const payload: UpdateUserRequest = {
      username: editForm.value.username?.trim(),
      phone: editForm.value.phone?.trim(),
    }
    if (editForm.value.password && editForm.value.password.trim().length > 0) {
      payload.password = editForm.value.password.trim()
    }
    // 先更新基础信息
    await adminApi.updateUser(editingId.value, payload)
    // 如果角色发生变化，则单独调用角色更新接口
    if (editForm.value.role && editForm.value.role !== originalRole.value) {
      await adminApi.updateRole(editingId.value, editForm.value.role)
    }
    message.success('用户信息已更新')
    editOpen.value = false
    editingId.value = null
    editForm.value = { role: 'user' }
    originalRole.value = 'user'
    fetchUsers()
  } catch (err: unknown) {
    let msg = '更新失败'
    if (typeof err === 'object' && err !== null) {
      const resp = (err as { response?: { data?: unknown } }).response
      const data = resp?.data
      if (data && typeof data === 'object') {
        const d = data as { error?: unknown; message?: unknown }
        if (typeof d.error === 'string') {
          msg = d.error
        } else if (typeof d.message === 'string') {
          msg = d.message
        }
      } else if (typeof (err as { message?: unknown }).message === 'string') {
        msg = (err as { message: string }).message
      }
    }
    message.error(msg)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchUsers()
})

// 关闭弹窗后清空表单项的值
watch(modalOpen, (open) => {
  if (!open) {
    newUser.value = { username: '', phone: '', password: '', role: 'user' }
  }
})

watch(editOpen, (open) => {
  if (!open) {
    editForm.value = { role: 'user' }
    editingId.value = null
    originalRole.value = 'user'
  }
})
</script>

<style scoped>
.admin-container {
  padding: 24px;
}
.table-responsive {
  overflow-x: auto;
}
.header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 16px;
}
</style>
<template>
  <a-config-provider :theme="themeConfig">
    <!-- 登录/注册页采用独立全屏布局，不渲染侧边栏与头部 -->
    <template v-if="isAuthRoute">
      <ErrorBoundary>
        <router-view />
      </ErrorBoundary>
    </template>

    <!-- 其他页面使用主布局，导航改为顶部横向菜单 -->
      <a-layout v-else class="layout" :class="{ dark: isDark }">
      <a-layout-header class="header">
        <div class="header-content">
          <div class="header-left">
            <div class="brand">
              <img class="brand-logo" :src="`${UPLOADS_BASE}/logo_new.png`" alt="光大Logo" />
              <span class="brand-text">光大钢铁</span>
            </div>
          </div>
          <div class="header-center">
            <a-menu
              mode="horizontal"
              :selectable="true"
              v-model:selectedKeys="selectedKeys"
              @select="onMenuSelect"
            >
              <a-menu-item key="/">
                <router-link to="/" style="color: inherit;">首页</router-link>
              </a-menu-item>
              <a-menu-item v-if="canSeeQuotes" key="/quotes">
                <router-link to="/quotes" style="color: inherit;">报价单</router-link>
              </a-menu-item>
              <a-menu-item v-if="canSeeDelivery" key="/delivery">
                <router-link to="/delivery" style="color: inherit;">发货单</router-link>
              </a-menu-item>
              <a-menu-item v-if="isAdmin" key="/settlements">
                <router-link to="/settlements" style="color: inherit;">结算单</router-link>
              </a-menu-item>
              <a-menu-item v-if="isAdmin || isSales || isTechnician" key="/technical-tasks">
                <router-link to="/technical-tasks" style="color: inherit;">技术任务单</router-link>
              </a-menu-item>
              <a-menu-item v-if="isAdmin || isSales || isTechnician" key="/knowledge">
                <router-link to="/knowledge" style="color: inherit;">知识库</router-link>
              </a-menu-item>
              <a-menu-item v-if="isAdmin" key="/admin/users">
                <router-link to="/admin/users" style="color: inherit;">用户管理</router-link>
              </a-menu-item>
              <a-menu-item v-if="isAdmin" key="/admin/sales-analysis">
                <router-link to="/admin/sales-analysis" style="color: inherit;">销售分析</router-link>
              </a-menu-item>
            </a-menu>
          </div>
          <div class="header-right">
            <a-space>
              <a-button size="small" type="text" class="theme-toggle" @click="toggleTheme">
                <BulbOutlined /> {{ isDark ? '亮色' : '暗色' }}
              </a-button>
            </a-space>
            <a-dropdown>
              <a class="ant-dropdown-link" @click.prevent>
                <a-avatar size="small" class="user-avatar">
                  <UserOutlined />
                </a-avatar>
                {{ authStore.user?.username || '未登录' }} <DownOutlined />
              </a>
              <template #overlay>
                <a-menu>
                  <a-menu-item @click="logout">退出登录</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </div>
      </a-layout-header>

      <a-layout-content class="content">
        <ErrorBoundary>
          <router-view />
        </ErrorBoundary>
      </a-layout-content>
    </a-layout>
  </a-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { DownOutlined, UserOutlined, BulbOutlined } from '@ant-design/icons-vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import { theme as antTheme } from 'ant-design-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const selectedKeys = ref<string[]>(['/'])
const mapRouteToNavKey = (p: string) => {
  if (p.startsWith('/quotes')) return '/quotes'
  if (p.startsWith('/delivery')) return '/delivery'
  if (p.startsWith('/settlements')) return '/settlements'
  if (p.startsWith('/technical-tasks')) return '/technical-tasks'
  if (p.startsWith('/knowledge')) return '/knowledge'
  if (p.startsWith('/admin/users')) return '/admin/users'
  if (p.startsWith('/admin/sales-analysis')) return '/admin/sales-analysis'
  return '/'
}
watch(() => route.path, (p) => { selectedKeys.value = [mapRouteToNavKey(p)] })

// 统一静态资源基础地址（本地默认 3001）
const API_BASE = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3005'
const UPLOADS_BASE = `${API_BASE.replace(/\/$/, '')}/uploads`

// 是否为认证路由（登录/注册），这些页面不显示主布局
const isAuthRoute = computed(() => Boolean(route.meta.requiresGuest) || route.name === 'login' || route.name === 'register')

const role = computed(() => authStore.user?.role || 'user')
const isAdmin = computed(() => role.value === 'admin' || role.value === 'finance')
// 将普通用户默认视为销售，以便可访问主要业务模块
const isSales = computed(() => role.value === 'sales' || role.value === 'user')
const isTechnician = computed(() => role.value === 'technician')

// 菜单权限
const canSeeQuotes = computed(() => isAdmin.value || isSales.value || isTechnician.value)
const canSeeDelivery = computed(() => isAdmin.value || isSales.value || isTechnician.value)

// 顶部导航不展示当前页面标题，移除未使用的 pageTitle 计算属性

const logout = () => { authStore.logout() }

// 菜单选择立即更新选中态并同步路由
const onMenuSelect = (info: { key: string }) => {
  selectedKeys.value = [info.key]
  router.push(info.key)
}

// 主题切换（暗色/亮色），持久化到 localStorage
const isDark = ref(localStorage.getItem('theme_mode') === 'dark')
const toggleTheme = () => {
  isDark.value = !isDark.value
  localStorage.setItem('theme_mode', isDark.value ? 'dark' : 'light')
}
const themeConfig = computed(() => ({
  algorithm: isDark.value ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#fa8c16',
    colorLink: '#fa8c16',
    colorLinkHover: '#faad14',
    colorLinkActive: '#d46b08',
    borderRadius: 10,
    fontSize: 14,
    colorBgLayout: isDark.value ? '#0f0f10' : '#f7f8fa',
    colorBgContainer: isDark.value ? '#141414' : '#ffffff',
  }
}))
</script>

<style scoped>
.layout { min-height: 100vh; }
/* 顶部品牌与菜单样式（改为清爽的白底） */
.header { position: sticky; top: 0; z-index: 100; height: 64px; background: #ffffff; color: #1f1f1f; padding: 0 16px; border-bottom: 1px solid #f0f0f0; }
.header-content { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.header-left { display: flex; align-items: center; gap: 14px; margin-right: 20px; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand-logo { width: 28px; height: 28px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.brand-text { color: #1f1f1f; font-weight: 600; letter-spacing: 0.5px; }
.header-center { flex: 1 1 auto; }
.header-center :deep(.ant-menu) { background: transparent; border-bottom: none; color: #1f1f1f; }
.header-center :deep(.ant-menu-item-selected),
.header-center :deep(.ant-menu-item-active) { background: transparent !important; }
.header-center :deep(.ant-menu-item-selected) { background: transparent !important; }
.header-center :deep(.ant-menu-item:hover),
.header-center :deep(.ant-menu-submenu-title:hover) { background: rgba(0,0,0,0.04) !important; }
/* 选中/悬停时文本保持深色，避免出现橙色 */
.header-center :deep(.ant-menu-item-selected a),
.header-center :deep(.ant-menu-item-active a),
.header-center :deep(.ant-menu-item a:hover) { color: inherit !important; }
/* 选中态使用品牌橙色并加粗，背景仍保持透明 */
.header-center :deep(.ant-menu-item-selected a) { color: #fa8c16 !important; font-weight: 700 !important; }
/* 移除横向菜单默认的主色下划线与橙色文本高亮 */
.header-center :deep(.ant-menu-horizontal > .ant-menu-item::after),
.header-center :deep(.ant-menu-horizontal > .ant-menu-submenu::after) { border-bottom: none !important; }
.header-center :deep(.ant-menu-light .ant-menu-item-selected),
.header-center :deep(.ant-menu-light .ant-menu-item:hover) { color: #1f1f1f !important; }
.header-center :deep(.ant-menu .ant-menu-item a) { color: #1f1f1f !important; background: transparent !important; }
.header-center :deep(.ant-menu .ant-menu-item a:hover) { color: #1f1f1f !important; background-color: transparent !important; }
.header-right { display: flex; align-items: center; }
.ant-dropdown-link { color: #1f1f1f; display: inline-flex; align-items: center; gap: 8px; }
.header :deep(.ant-dropdown-link:hover),
.header :deep(.ant-dropdown-link:focus) { background-color: transparent !important; }
.user-avatar { background-color: #fa8c16; }
.theme-toggle { color: #1f1f1f; }

.content { background: #fff; padding: 16px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); height: calc(100vh - 64px); overflow-y: auto; }
.footer { text-align: center; }

/* 全局业务页面美化：卡片化与表格/表单间距优化 */
.page-container { padding: 8px 6px; }
.page-container :deep(.ant-card) { border-radius: 12px; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
.page-container :deep(.ant-form-item) { margin-bottom: 12px; }
.page-container :deep(.ant-table) { border-radius: 10px; overflow: hidden; }
.page-container :deep(.ant-table-thead > tr > th) { background: #f7f9fc; }
.page-container :deep(.ant-table-tbody > tr:hover > td) { background: #fafcff; }

/* 暗色模式适配 */
.layout :deep(.ant-menu) { transition: background-color 0.2s ease, color 0.2s ease; }
.layout :deep(.ant-card) { transition: background-color 0.2s ease, box-shadow 0.2s ease; }
.layout :deep(.ant-table) { transition: background-color 0.2s ease; }

.layout :deep(.ant-btn.theme-toggle) { background: transparent; }

.layout.dark .header { background: #141414; color: #e8e8e8; border-bottom-color: #303030; }
.layout.dark .brand-text { color: #e8e8e8; }
.layout.dark .header-center :deep(.ant-menu) { color: #e8e8e8; }
.layout.dark .header-center :deep(.ant-menu .ant-menu-item a) { color: #e8e8e8 !important; }
.layout.dark .header-center :deep(.ant-menu .ant-menu-item a:hover) { color: #ffffff !important; }
.layout.dark .header-center :deep(.ant-menu-item:hover),
.layout.dark .header-center :deep(.ant-menu-submenu-title:hover) { background: rgba(255,255,255,0.06) !important; }
.layout.dark .ant-dropdown-link { color: #e8e8e8; }
.layout.dark .theme-toggle { color: #e8e8e8; }
.layout.dark .content { background: #181818; box-shadow: 0 1px 3px rgba(0,0,0,0.35); }
.layout.dark .page-container :deep(.ant-table-thead > tr > th) { background: #1f1f1f; color: #e8e8e8; }
.layout.dark .page-container :deep(.ant-table-tbody > tr:hover > td) { background: #1a1a1a; }

/* 全局组件暗色覆盖，避免白色背景闪烁 */
.layout.dark :deep(.ant-card) { background: #1a1a1a; border-color: #303030; }
.layout.dark :deep(.ant-list) { background: #1a1a1a; }
.layout.dark :deep(.ant-descriptions-view) { background: #1a1a1a; }
.layout.dark :deep(.ant-form-item-label > label) { color: #bfbfbf; }
.layout.dark :deep(.ant-tabs-content-holder) { background: #181818; }
.layout.dark :deep(.ant-modal-content) { background: #1a1a1a; border-color: #303030; }
.layout.dark :deep(.ant-drawer-content) { background: #1a1a1a; }
.layout.dark :deep(.ant-popover-inner) { background: #1a1a1a; }
.layout.dark :deep(.ant-tooltip-inner) { background: #1a1a1a; }

/* 富文本编辑器（Quill）暗色覆盖 */
.layout.dark :deep(.ql-toolbar.ql-snow) { background: #1a1a1a; border-color: #303030; }
.layout.dark :deep(.ql-container.ql-snow) { background: #1a1a1a; color: #e8e8e8; border-color: #303030; }
</style>

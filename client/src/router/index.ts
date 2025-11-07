import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import QuoteListView from '../views/QuoteListView.vue'
import QuoteTemplatesView from '../views/QuoteTemplatesView.vue'
import authService from '../api/auth'
// 新模块视图按需懒加载
import { useAuthStore } from '../stores/auth'

// 路由元信息类型，避免使用 any
type Role = 'admin' | 'finance' | 'sales' | 'technician' | 'production_lead' | 'production_manager' | 'storekeeper' | 'user'
interface AppRouteMeta {
  requiresAuth?: boolean
  requiresGuest?: boolean
  requiresAdmin?: boolean
  requiresRoles?: Role[]
}

// 统一角色集合与归一化函数，确保类型为 Role
const ROLES: Role[] = ['admin', 'finance', 'sales', 'technician', 'production_lead', 'production_manager', 'storekeeper', 'user']
const normalizeRole = (role?: string): Role => {
  const r = (role ?? 'user') as Role
  const valid = ROLES.includes(r) ? r : 'sales'
  return valid === 'user' ? 'sales' : valid
}

// 在 Electron 构建或 file:// 场景下使用 Hash 路由，避免资源相对路径在 HTML5 History 模式下丢失
type EnvWithTarget = ImportMeta['env'] & { VITE_TARGET?: string }
const env = import.meta.env as EnvWithTarget
const useHash = env?.VITE_TARGET === 'electron' || (typeof window !== 'undefined' && window.location?.protocol === 'file:')
const router = createRouter({
  history: useHash ? createWebHashHistory() : createWebHistory(),
  routes: [
    // 新增：首页作为默认入口
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { requiresAuth: true, requiresRoles: ['admin', 'finance', 'sales', 'technician', 'user'] }
    },
    {
      path: '/quotes',
      name: 'quotes',
      component: QuoteListView,
      meta: { requiresAuth: true, requiresRoles: ['admin', 'finance', 'sales', 'technician'] }
    },
    {
      path: '/quotes/templates',
      name: 'quote-templates',
      component: QuoteTemplatesView,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/quotes/create',
      name: 'quote-create',
      component: () => import('../views/QuoteCreateView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/quotes/edit/:id',
      name: 'quote-edit',
      component: () => import('../views/QuoteEditView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresGuest: true }
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { requiresGuest: true }
    },
    // 管理员：用户管理
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    // 管理员：销售分析
    {
      path: '/admin/sales-analysis',
      name: 'sales-analysis',
      component: () => import('../views/SalesAnalysisView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    // 知识库：管理员与销售可见
    {
      path: '/knowledge',
      name: 'knowledge',
      component: () => import('../views/KnowledgeBaseView.vue'),
      meta: { requiresAuth: true, requiresRoles: ['admin', 'finance', 'sales', 'technician'] }
    },
    // 发货单列表：管理员/财务/销售可访问（销售仅能看到自己创建的）
    {
      path: '/delivery',
      name: 'delivery',
      component: () => import('../views/DeliveryView.vue'),
      meta: { requiresAuth: true, requiresRoles: ['admin', 'finance', 'sales', 'technician'] }
    },
    // 新增：发货单创建页面
    {
      path: '/delivery/create',
      name: 'delivery-create',
      component: () => import('../views/DeliveryCreateView.vue'),
      meta: { requiresAuth: true, requiresRoles: ['admin', 'finance', 'sales', 'technician'] }
    },
    // 结算单列表：仅管理员/财务可访问
    {
      path: '/settlements',
      name: 'settlements',
      component: () => import('../views/SettlementsView.vue'),
      meta: { requiresAuth: true, requiresRoles: ['admin', 'finance'] }
    },
    // 新增：技术任务列表（所有角色可访问；销售仅查看自己创建的数据由后端控制）
    {
      path: '/technical-tasks',
      name: 'technical-tasks',
      component: () => import('../views/TechnicalTasksView.vue'),
      meta: { requiresAuth: true, requiresRoles: ROLES }
    },
    // 新增：技术任务创建（所有角色可访问）
    {
      path: '/technical-tasks/create',
      name: 'technical-tasks-create',
      component: () => import('../views/TechnicalTaskCreateView.vue'),
      meta: { requiresAuth: true, requiresRoles: ROLES }
    },
    // 其余模块暂时移除（合同/排产/联系/发运/采购/质检）
  ]
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  const meta = to.meta as AppRouteMeta;

  const hasToken = authService.isAuthenticated();
  const isAdmin = authStore.isAdmin;
  
  // 需要登录的页面：若无 token，跳转到登录
  if (meta.requiresAuth && !hasToken) {
    next('/login');
    return;
  }
  
  // 管理员权限
  if (meta.requiresAdmin && !isAdmin) {
    next('/');
    return;
  }
  
  // 角色权限（当后端角色仍为 user 时，默认视为 sales 以兼容前端模块访问）
  const normalizedRole = normalizeRole(authStore.user?.role);
  if (Array.isArray(meta.requiresRoles)) {
    const roles = meta.requiresRoles;
    if (!roles.includes(normalizedRole) && !isAdmin) {
      next('/');
      return;
    }
  }
  
  // 游客页面（登录/注册）：若已有 token，则跳转到首页
  if (meta.requiresGuest && hasToken) {
    next('/');
    return;
  }
  
  next();
})

export default router

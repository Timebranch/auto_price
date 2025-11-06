import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import authService, { type User, type LoginRequest, type RegisterRequest } from '../api/auth';

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const user = ref<User | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'finance');

  // 初始化用户状态
  const initializeAuth = () => {
    const storedUser = authService.getStoredUser();
    if (storedUser && authService.isAuthenticated()) {
      user.value = storedUser;
    }
  };

  // 登录
  const login = async (credentials: LoginRequest) => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const response = await authService.login(credentials);
      user.value = response.user;
      return response;
    } catch (err: any) {
      error.value = err.response?.data?.error || '登录失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // 注册
  const register = async (userData: RegisterRequest) => {
    isLoading.value = true;
    error.value = null;
    
    try {
      const response = await authService.register(userData);
      user.value = response.user;
      return response;
    } catch (err: any) {
      error.value = err.response?.data?.error || '注册失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // 获取当前用户信息
  const fetchCurrentUser = async () => {
    if (!authService.isAuthenticated()) {
      return;
    }

    isLoading.value = true;
    error.value = null;
    
    try {
      const response = await authService.getCurrentUser();
      user.value = response.user;
      // 更新本地存储
      localStorage.setItem('user_info', JSON.stringify(response.user));
    } catch (err: any) {
      error.value = err.response?.data?.error || '获取用户信息失败';
      // 如果获取用户信息失败，可能token已过期，清除认证状态
      logout();
    } finally {
      isLoading.value = false;
    }
  };

  // 更新用户资料
  const updateProfile = async (userData: { fullName?: string; email?: string }) => {
    isLoading.value = true;
    error.value = null;
    
    try {
      await authService.updateProfile(userData);
      // 重新获取用户信息
      await fetchCurrentUser();
    } catch (err: any) {
      error.value = err.response?.data?.error || '更新资料失败';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // 退出登录
  const logout = () => {
    user.value = null;
    error.value = null;
    authService.logout();
  };

  // 清除错误
  const clearError = () => {
    error.value = null;
  };

  return {
    // 状态
    user,
    isLoading,
    error,
    
    // 计算属性
    isAuthenticated,
    isAdmin,
    
    // 方法
    initializeAuth,
    login,
    register,
    fetchCurrentUser,
    updateProfile,
    logout,
    clearError
  };
});
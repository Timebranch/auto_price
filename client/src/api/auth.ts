import axios from 'axios';

// 生产环境通过 VITE_API_BASE_URL 注入远端基础地址；本地开发走同源 Vite 代理
const API_BASE = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || ''
const API_BASE_URL = `${API_BASE.replace(/\/$/, '')}/api`;

// 创建axios实例
const authApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证token
authApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理认证错误
authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = error.response?.config?.url || ''

    // 对于登录/注册请求的401，不进行重定向，以便在登录页展示错误提示
    const isAuthEndpoint = typeof url === 'string' && (url.includes('/auth/login') || url.includes('/auth/register'))

    if ((status === 401 || status === 403) && !isAuthEndpoint) {
      // 清除本地存储的认证信息
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
      // 避免在登录页重复跳转
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  avatarUrl?: string;
  phone?: string;
  createdAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export const authService = {
  // 用户登录
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await authApi.post('/auth/login', credentials);
    
    // 保存认证信息到本地存储
    if (response.data.token) {
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('user_info', JSON.stringify(response.data.user));
    }
    
    return response.data;
  },

  // 用户注册
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await authApi.post('/auth/register', userData);
    
    // 保存认证信息到本地存储
    if (response.data.token) {
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('user_info', JSON.stringify(response.data.user));
    }
    
    return response.data;
  },

  // 获取当前用户信息
  async getCurrentUser(): Promise<{ user: User }> {
    const response = await authApi.get('/auth/me');
    return response.data;
  },

  // 更新用户资料
  async updateProfile(userData: { fullName?: string; email?: string }): Promise<{ message: string }> {
    const response = await authApi.put('/auth/profile', userData);
    return response.data;
  },

  // 退出登录
  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    window.location.href = '/login';
  },

  // 检查是否已登录
  isAuthenticated(): boolean {
    const token = localStorage.getItem('auth_token');
    return !!token;
  },

  // 获取本地存储的用户信息
  getStoredUser(): User | null {
    const userInfo = localStorage.getItem('user_info');
    return userInfo ? JSON.parse(userInfo) : null;
  },

  // 获取认证token
  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }
};

export default authService;
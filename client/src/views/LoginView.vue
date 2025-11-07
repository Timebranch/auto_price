<template>
  <div class="login-container" :style="bgStyle">
    <div class="login-card">
      <div class="login-header">
        <h1>欢迎登录</h1>
      </div>
      
      <a-form
        :model="loginForm"
        :rules="rules"
        @finish="handleLogin"
        @finishFailed="onFinishFailed"
        layout="vertical"
        class="login-form"
      >
        <a-form-item label="用户名" name="username">
          <a-input
            v-model:value="loginForm.username"
            size="large"
            placeholder="请输入用户名或邮箱"
            :prefix="h(UserOutlined)"
          />
        </a-form-item>
        
        <a-form-item label="密码" name="password">
          <a-input-password
            v-model:value="loginForm.password"
            size="large"
            placeholder="请输入密码"
            :prefix="h(LockOutlined)"
          />
        </a-form-item>
        
        <a-form-item>
          <a-button
            type="primary"
            html-type="submit"
            size="large"
            :loading="authStore.isLoading"
            block
          >
            登录
          </a-button>
        </a-form-item>
        
      </a-form>
      
      <a-alert
        v-if="authStore.error"
        :message="uiError"
        type="error"
        show-icon
        closable
        @close="authStore.clearError"
        class="error-alert"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, h, computed } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue';
import { useAuthStore } from '../stores/auth';
import type { LoginRequest } from '../api/auth';

const router = useRouter();
const authStore = useAuthStore();

const loginForm = reactive<LoginRequest>({
  username: '',
  password: ''
});

const rules = {
  username: [
    { required: true, message: '请输入用户名或邮箱', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ]
};

const friendlyError = (e?: string | null) => {
  const s = e || ''
  if (s.includes('账户已被禁用')) return '账户已被禁用，请联系管理员启用'
  if (s.includes('用户名或密码错误')) return '账户名或密码错误'
  return s || '登录失败'
}

const uiError = computed(() => friendlyError(authStore.error))

const onFinishFailed = (info: unknown) => {
  console.warn('finishFailed', info)
}

const handleLogin = async () => {
  console.log('handleLogin submit', { username: loginForm.username, passwordLen: loginForm.password.length })
  try {
    await authStore.login(loginForm);
    message.success('登录成功');
    router.push('/');
  } catch (err: unknown) {
    // 展示明确的错误提示（如：用户名或密码错误、账户被禁用等）
    let respError: string | null = null
    if (typeof err === 'object' && err !== null) {
      const resp = (err as { response?: { data?: { error?: string } } }).response
      respError = resp?.data?.error ?? null
    }
    const raw = authStore.error || respError || '账户名或密码错误'
    message.error(friendlyError(raw))
  }
};

// 背景图：请将图片放在 public 目录下，默认文件名为 /login-bg.jpg
const bgStyle = computed(() => ({
  // 使用相对路径，确保 Electron file:// 场景下正常加载
  backgroundImage: "url('./background.jpg')",
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat'
}))
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.login-container::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.2));
}

.login-card {
  position: relative;
  z-index: 1;
  background: #ffffff;
  border: 1px solid #f0f0f0;
  border-radius: 16px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
  padding: 32px;
  width: 100%;
  max-width: 420px;
  color: #1f1f1f;
}

.login-header h1 {
  font-size: 26px;
  font-weight: 700;
  color: #1f1f1f;
  margin-bottom: 8px;
}

.login-header p { color: #8c8c8c; font-size: 14px; margin: 0; }

.error-alert { margin-top: 16px; }

:deep(.ant-input-affix-wrapper) {
  border-radius: 10px;
  background: #fff;
  border-color: #d9d9d9;
}

:deep(.ant-btn) {
  border-radius: 10px;
  height: 44px;
  font-weight: 600;
  background-image: linear-gradient(45deg, #fa8c16, #faad14);
  border: none;
}

:deep(.ant-btn-primary:hover) {
  filter: brightness(1.05);
}
</style>

<style scoped>
/* 暗色模式覆盖：登录卡片与输入框 */
:global(.layout.dark) .login-card {
  background: #1a1a1a;
  border-color: #303030;
  color: #e8e8e8;
}
:global(.layout.dark) .login-header h1 { color: #e8e8e8; }
:global(.layout.dark) .login-header p { color: #bfbfbf; }
:global(.layout.dark) .login-container::after { background: linear-gradient(120deg, rgba(0, 0, 0, 0.60), rgba(0, 0, 0, 0.45)); }
:global(.layout.dark) .login-card :deep(.ant-input-affix-wrapper) {
  background: #1a1a1a;
  border-color: #303030;
}
:global(.layout.dark) .login-card :deep(.ant-input),
:global(.layout.dark) .login-card :deep(.ant-input-password) { color: #e8e8e8; }
</style>
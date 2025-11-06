<template>
  <div class="register-container">
    <div class="register-card">
      <div class="register-header">
        <h1>注册</h1>
        <p>创建您的自动报价系统账户</p>
      </div>
      
      <a-form
        :model="registerForm"
        :rules="rules"
        @finish="handleRegister"
        layout="vertical"
        class="register-form"
      >
        <a-form-item label="用户名" name="username">
          <a-input
            v-model:value="registerForm.username"
            size="large"
            placeholder="请输入用户名"
            :prefix="h(UserOutlined)"
          />
        </a-form-item>
        
        <a-form-item label="邮箱" name="email">
          <a-input
            v-model:value="registerForm.email"
            size="large"
            placeholder="请输入邮箱地址"
            :prefix="h(MailOutlined)"
          />
        </a-form-item>
        
        <a-form-item label="姓名" name="fullName">
          <a-input
            v-model:value="registerForm.fullName"
            size="large"
            placeholder="请输入真实姓名（可选）"
            :prefix="h(IdcardOutlined)"
          />
        </a-form-item>
        
        <a-form-item label="密码" name="password">
          <a-input-password
            v-model:value="registerForm.password"
            size="large"
            placeholder="请输入密码"
            :prefix="h(LockOutlined)"
          />
        </a-form-item>
        
        <a-form-item label="确认密码" name="confirmPassword">
          <a-input-password
            v-model:value="registerForm.confirmPassword"
            size="large"
            placeholder="请再次输入密码"
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
            注册
          </a-button>
        </a-form-item>
        
        <div class="register-footer">
          <span>已有账户？</span>
          <router-link to="/login" class="login-link">立即登录</router-link>
        </div>
      </a-form>
      
      <a-alert
        v-if="authStore.error"
        :message="authStore.error"
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
import { reactive, h } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { UserOutlined, LockOutlined, MailOutlined, IdcardOutlined } from '@ant-design/icons-vue';
import { useAuthStore } from '../stores/auth';
import type { RegisterRequest } from '../api/auth';

const router = useRouter();
const authStore = useAuthStore();

interface RegisterForm extends RegisterRequest {
  confirmPassword: string;
}

const registerForm = reactive<RegisterForm>({
  username: '',
  email: '',
  password: '',
  fullName: '',
  confirmPassword: ''
});

const validateConfirmPassword = (_rule: unknown, value: string) => {
  if (value && value !== registerForm.password) {
    return Promise.reject('两次输入的密码不一致');
  }
  return Promise.resolve();
};

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, message: '用户名长度至少3位', trigger: 'blur' },
    { max: 20, message: '用户名长度不能超过20位', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
};

const handleRegister = async () => {
  try {
    const registerData: RegisterRequest = {
      username: registerForm.username.trim(),
      email: registerForm.email.trim(),
      password: registerForm.password,
      fullName: registerForm.fullName.trim()
    };
    await authStore.register(registerData);
    message.success('注册成功');
    router.push('/');
  } catch {
    // 错误已在store中处理
  }
};
</script>

<style scoped>
.register-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  padding: 20px;
}

.register-card {
  background: #2a2a2a;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  padding: 40px;
  width: 100%;
  max-width: 450px;
}

.register-header h1 {
  font-size: 28px;
  font-weight: 600;
  color: #e8e8e8;
  margin-bottom: 8px;
}

.register-header p {
  color: #bfbfbf;
  font-size: 14px;
  margin: 0;
}

.login-link {
  color: #fa8c16;
  text-decoration: none;
  margin-left: 4px;
}

.login-link:hover {
  color: #ffa940;
  text-decoration: underline;
}

.register-form {
  margin-bottom: 24px;
}

.register-footer {
  text-align: center;
  color: #6b7280;
  font-size: 14px;
}

.login-link {
  color: #fa8c16;
  text-decoration: none;
  margin-left: 4px;
}

.login-link:hover {
  color: #ffa940;
  text-decoration: underline;
}

.error-alert {
  margin-top: 16px;
}

:deep(.ant-input-affix-wrapper) {
  border-radius: 8px;
}

:deep(.ant-btn) {
  border-radius: 8px;
  height: 44px;
  font-weight: 500;
}
</style>

<style scoped>
/* 暗色模式覆盖：注册页容器与表单控件 */
:global(.layout.dark) .register-container { background: #141414; }
:global(.layout.dark) .register-card { background: #1a1a1a; }
:global(.layout.dark) .register-form :deep(.ant-input-affix-wrapper) {
  background: #1a1a1a;
  border-color: #303030;
}
:global(.layout.dark) .register-form :deep(.ant-input),
:global(.layout.dark) .register-form :deep(.ant-input-password) { color: #e8e8e8; }
</style>
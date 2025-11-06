<template>
  <div v-if="hasError" class="error-boundary">
    <a-result status="error" title="页面加载出现问题">
      <template #subTitle>
        {{ uiMessage }}
      </template>
      <template #extra>
        <a-space>
          <a-button type="primary" @click="reload">刷新页面</a-button>
          <a-button @click="clear">继续尝试</a-button>
        </a-space>
      </template>
    </a-result>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, computed, onErrorCaptured } from 'vue'

const error = ref<unknown>(null)
const hasError = computed(() => !!error.value)

const reload = () => window.location.reload()
const clear = () => { error.value = null }

const uiMessage = computed(() => {
  const e = error.value
  if (!e) return ''
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (typeof e === 'object' && e && 'message' in e) {
    const msg = (e as Record<string, unknown>).message
    if (typeof msg === 'string') return msg
  }
  return '请刷新重试或返回上一页'
})

onErrorCaptured((err, instance, info) => {
  console.error('[ErrorBoundary]', err, info)
  error.value = err
  return false // 阻止向上传播
})
</script>

<style scoped>
.error-boundary { padding: 24px; }
</style>
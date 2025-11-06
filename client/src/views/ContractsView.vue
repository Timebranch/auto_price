<template>
  <div class="page-container">
    <div class="page-header">
      <h2>合同系统</h2>
      <p class="sub">用于创建与审核加工合同，支持导出PDF。</p>
    </div>
    <a-card title="快速入口" bordered>
      <a-space>
        <a-button type="primary">新建合同</a-button>
        <a-button>合同列表</a-button>
      </a-space>
    </a-card>
  </div>
</template>

<script setup lang="ts">
// 预留后续数据与API集成
</script>

<style scoped>
.page-container { padding: 16px; }
.page-header h2 { margin: 0; }
.sub { color: #8c8c8c; margin-top: 4px; }
</style>
<template>
  <div class="page-container">
    <div class="page-header">
      <h2>质检系统</h2>
      <p class="sub">质检流程与报告管理，支持PDF导出。</p>
    </div>
    <a-card title="质检概览" bordered>
      <a-empty description="后续接入质检记录与报告模板" />
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
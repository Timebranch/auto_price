<template>
  <div class="page-container">
    <div class="page-header">
      <h2>排产系统</h2>
      <p class="sub">维护订单的生产计划与时间节点。</p>
    </div>
    <a-card title="生产计划概览" bordered>
      <a-empty description="后续接入生产计划列表与甘特图" />
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
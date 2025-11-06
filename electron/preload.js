const { contextBridge } = require('electron')

// 暴露必要的运行时配置给渲染进程（可选）
contextBridge.exposeInMainWorld('APP_CONFIG', {
  API_BASE_URL: 'http://localhost:3005'
})
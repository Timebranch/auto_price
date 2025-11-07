const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

const isDev = !app.isPackaged
// 远端模式开关：为后续发布到远端后端做准备
// 当 USE_REMOTE_API=true 时，桌面端不启动内置后端，仅作为前端壳连接远端 API
const useRemoteApi = process.env.USE_REMOTE_API === 'true'
let remoteApiBase = process.env.VITE_API_BASE_URL || ''
try {
  // 可选：读取随包配置 config/app.config.json 以在无需环境变量时启用远端模式
  const configPath = path.join(process.resourcesPath || __dirname, 'config', 'app.config.json')
  const fs = require('fs')
  if (fs.existsSync(configPath)) {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (typeof cfg.useRemoteApi === 'boolean') {
      // 仅当未显式通过环境变量关闭时才采用文件开关
      if (process.env.USE_REMOTE_API == null) {
        global.USE_REMOTE_API = cfg.useRemoteApi
      }
    }
    if (typeof cfg.remoteApiBase === 'string' && cfg.remoteApiBase) {
      remoteApiBase = cfg.remoteApiBase
    }
  }
} catch {}
let serverProcess = null

function startServer() {
  if (isDev) {
    // 开发模式下由根仓库脚本启动后端，避免端口冲突
    return
  }
  if (useRemoteApi || global.USE_REMOTE_API === true) {
    // 使用远端后端时不启动本地内置后端
    return
  }
  const port = process.env.PORT || '3005'
  const serverEntry = path.join(process.resourcesPath, 'server', 'dist', 'index.js')
  try {
    serverProcess = spawn(process.execPath, [serverEntry], {
      env: { ...process.env, PORT: port },
      stdio: 'ignore',
      detached: true,
    })
    serverProcess.unref()
  } catch (err) {
    console.error('启动内置后端失败:', err)
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5184/'
    win.loadURL(devUrl)
    // 可选：打开 DevTools
    // win.webContents.openDevTools()
  } else {
    const indexPath = path.join(process.resourcesPath, 'client', 'dist', 'index.html')
    // 若存在远端基础地址，注入给渲染进程（前端代码会读取 VITE_API_BASE_URL）
    const apiBase = remoteApiBase || process.env.VITE_API_BASE_URL || ''
    if (apiBase) {
      process.env.VITE_API_BASE_URL = apiBase
    }
    win.loadFile(indexPath)
  }
}

app.whenReady().then(() => {
  startServer()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
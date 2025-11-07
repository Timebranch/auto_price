const { app, BrowserWindow, dialog } = require('electron')
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

// 统一错误日志，避免未捕获异常导致进程直接退出
function setupGlobalErrorHandlers() {
  const fs = require('fs')
  const logDir = app.getPath('userData')
  const logFile = path.join(logDir, 'main.log')
  function writeLog(prefix, err) {
    const msg = `[${new Date().toISOString()}] ${prefix}: ${err && err.stack || err}\n`
    try { fs.appendFileSync(logFile, msg) } catch {}
    console.error(prefix, err)
  }
  process.on('uncaughtException', (err) => {
    writeLog('uncaughtException', err)
    // 在 Windows 上避免直接闪退，提示用户并尽量维持主进程运行
    try {
      dialog.showErrorBox('程序错误', '检测到未捕获异常，已记录日志并尝试继续运行。')
    } catch {}
  })
  process.on('unhandledRejection', (reason) => {
    writeLog('unhandledRejection', reason)
  })
}

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
    // 改为独立子进程，避免原生模块在 Windows 下崩溃拖垮主进程
    const env = { ...process.env, PORT: port }
    serverProcess = require('child_process').fork(serverEntry, [], { env })
    serverProcess.on('exit', (code, signal) => {
      console.error('内置后端退出:', { code, signal })
    })
    serverProcess.on('error', (err) => {
      console.error('内置后端进程错误:', err)
    })
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
      // 允许在 file:// 场景下加载本地资源，避免白屏（如需更严格安全策略，可后续收紧）
      webSecurity: false,
    },
  })

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5184/'
    win.loadURL(devUrl)
    // 可选：打开 DevTools
    // win.webContents.openDevTools()
  } else {
    const fs = require('fs')
    // Electron Builder 会将应用代码打包到 app.asar 中；生产环境下应从 app 路径解析到前端构建文件
    let indexPath = path.join(app.getAppPath(), 'client', 'dist', 'index.html')
    if (!fs.existsSync(indexPath)) {
      const asarIndex = path.join(process.resourcesPath || __dirname, 'app.asar', 'client', 'dist', 'index.html')
      if (fs.existsSync(asarIndex)) {
        indexPath = asarIndex
      } else {
        const unpackedIndex = path.join(process.resourcesPath || __dirname, 'app', 'client', 'dist', 'index.html')
        if (fs.existsSync(unpackedIndex)) {
          indexPath = unpackedIndex
        } else {
          console.error('找不到前端构建文件 index.html:', indexPath)
        }
      }
    }
    // 若存在远端基础地址，注入给渲染进程（前端代码会读取 VITE_API_BASE_URL）
    const apiBase = remoteApiBase || process.env.VITE_API_BASE_URL || ''
    if (apiBase) {
      process.env.VITE_API_BASE_URL = apiBase
    }
    const { pathToFileURL } = require('url')
    const fileUrl = pathToFileURL(indexPath).toString()
    win.loadURL(fileUrl).catch(err => {
      console.error('加载渲染进程失败:', err)
    })
    win.webContents.on('did-fail-load', (_e, errorCode, errorDesc, validatedURL) => {
      console.error('渲染进程加载失败:', { errorCode, errorDesc, validatedURL })
    })
  }
}

app.whenReady().then(() => {
  setupGlobalErrorHandlers()
  startServer()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
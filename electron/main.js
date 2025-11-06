const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

const isDev = !app.isPackaged
let serverProcess = null

function startServer() {
  if (isDev) {
    // 开发模式下由根仓库脚本启动后端，避免端口冲突
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
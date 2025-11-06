import type { Page } from '@playwright/test'

// 等待后端可用（检测 /api/auth/me 返回 401/200 即认为服务就绪）
export async function waitBackendReady(page: Page, timeoutMs = 20000) {
  const start = Date.now()
  let lastErr: unknown
  const base = process.env.E2E_BASE_URL || 'http://localhost:5173'
  const apiUrl = `${base.replace(/\/$/, '')}/api/auth/me`
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await page.request.get(apiUrl)
      const code = res.status()
      if (code === 200 || code === 401 || code === 403) {
        return
      }
    } catch (err) {
      lastErr = err
    }
    await page.waitForTimeout(500)
  }
  if (lastErr) {
    throw new Error(`Backend not ready within ${timeoutMs}ms: ${String(lastErr)}`)
  } else {
    throw new Error(`Backend not ready within ${timeoutMs}ms`)
  }
}
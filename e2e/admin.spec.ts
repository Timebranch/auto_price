import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { waitBackendReady } from './utils'

const admin = { username: 'admin', password: 'admin123' }

async function login(page: Page) {
  await waitBackendReady(page)
  await page.goto('/login')
  await page.getByPlaceholder('请输入用户名或邮箱').fill(admin.username)
  const pwd = page.getByPlaceholder('请输入密码')
  await pwd.fill(admin.password)
  await pwd.press('Enter')
  await page.waitForURL('**/quotes', { timeout: 30000 })
}

test('管理员新增/禁用/启用用户', async ({ page }) => {
  await login(page)

  // 进入用户管理
  await page.goto('/admin/users')
  await expect(page.getByRole('button', { name: '新增用户' })).toBeVisible()

  // 打开新增用户弹窗
  await page.getByRole('button', { name: '新增用户' }).click()

  const suffix = Date.now().toString().slice(-6)
  const username = `pw_user_${suffix}`
  const phone = `139${Date.now().toString().slice(-8)}`

  // 在弹窗内按占位符填写，避免 label 匹配不稳定
  const dialog = page.getByRole('dialog', { name: '新增用户' })
  await dialog.getByPlaceholder('请输入用户名').fill(username)
  await dialog.getByPlaceholder('请输入手机号').fill(phone)
  await dialog.getByPlaceholder('请输入密码').fill('pw_test_123')
  // 角色默认销售人员，可保持默认

  // 点击弹窗“确定/OK”提交（兼容中英文），并等待成功提示与弹窗关闭
  await dialog.getByRole('button', { name: /^(确定|OK)$/ }).click()
  await expect(page.getByText('创建用户成功')).toBeVisible()
  await expect(dialog).toBeHidden()

  // 在分页中查找该用户（兼容多页、页码跳转与“Next 5 Pages”）
  let userRow = page.getByRole('row', { name: new RegExp(username) })
  let found = (await userRow.count()) > 0
  for (let group = 0; group < 10 && !found; group++) {
    const pageItems = page.getByRole('listitem', { name: /^\d+$/ })
    const count = await pageItems.count()
    for (let i = 0; i < count; i++) {
      await pageItems.nth(i).click()
      await page.waitForTimeout(300)
      userRow = page.getByRole('row', { name: new RegExp(username) })
      if ((await userRow.count()) > 0) { found = true; break }
    }
    if (found) break
    const nextPages = page.getByRole('listitem', { name: /Next.*Pages/ })
    if (await nextPages.count()) {
      await nextPages.click()
      await page.waitForTimeout(300)
    } else {
      const nextPage = page.getByRole('listitem', { name: 'Next Page' })
      if (await nextPage.count()) {
        await nextPage.click()
        await page.waitForTimeout(300)
      } else {
        break
      }
    }
  }
  await expect(userRow).toBeVisible()

  // 禁用（兼容“禁 用”可访问名称变体）
  await userRow.getByRole('button', { name: /禁\s*用/ }).click()
  await page.getByRole('button', { name: /^(确定|OK)$/ }).click()
  await expect(page.getByText('用户已禁用')).toBeVisible()

  // 启用（兼容“启 用”可访问名称变体）
  await userRow.getByRole('button', { name: /启\s*用/ }).click()
  await page.getByRole('button', { name: /^(确定|OK)$/ }).click()
  await expect(page.getByText('用户已启用')).toBeVisible()

  // 验证行仍存在
  await expect(page.getByRole('row', { name: new RegExp(username) })).toBeVisible()
})
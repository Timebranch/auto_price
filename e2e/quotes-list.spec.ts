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

// 创建唯一公司名的草稿，避免与历史记录冲突，并验证编辑与删除

test('在列表中编辑并删除报价单', async ({ page }) => {
  await login(page)
  await page.goto('/quotes')

  // 创建唯一草稿
  const suffix = Date.now().toString().slice(-6)
  const company = `Playwright测试公司-${suffix}`
  await page.getByRole('button', { name: '新建报价单' }).click()
  await page.waitForURL('**/quotes/create', { timeout: 15000 })
  await expect(page.getByText('创建报价单')).toBeVisible()
  // 填基本信息与一个项目（公司名带唯一后缀）
  await page.getByPlaceholder('请输入公司名称').fill(company)
  await page.getByPlaceholder('请输入联系人').fill('张三')
  await page.getByPlaceholder('请输入电话').fill('010-12345678')
  const salesPhone = page.getByPlaceholder('请输入销售代表电话')
  if (await salesPhone.count()) {
    await salesPhone.fill('13900001234')
  }
  await page.getByPlaceholder('请输入产品名称').first().fill('H型钢')
  await page.getByPlaceholder('请输入规格型号').first().fill('Q235B 200*200')
  await page.getByPlaceholder('请输入材质').first().fill('Q235B')
  await page.getByPlaceholder('请输入数量').first().fill('5')
  await page.getByPlaceholder('请输入单位').first().fill('吨')
  await page.getByPlaceholder('请输入单价(元)').first().fill('6200')
  // 保存草稿返回列表
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByText('保存成功')).toBeVisible()
  await page.waitForURL('**/quotes', { timeout: 15000 })

  // 筛选并定位到唯一草稿行
  await page.getByPlaceholder('按客户名称筛选').fill(company)
  await page.waitForTimeout(300)
  let row = page.getByRole('row', { name: new RegExp(company) }).filter({ hasText: '草稿' }).first()
  await expect(row).toBeVisible()

  // 编辑草稿（适配“编 辑”文本变体）
  await row.scrollIntoViewIfNeeded()
  await row.getByRole('button', { name: /编\s*辑/ }).first().click()
  await page.waitForURL('**/quotes/edit/**', { timeout: 15000 })

  // 修改联系人为“李四”并保存草稿
  const contact = page.getByPlaceholder('请输入联系人')
  await contact.fill('李四')
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.getByText('保存成功')).toBeVisible()
  await page.waitForURL('**/quotes', { timeout: 15000 })

  // 再次进入编辑页，验证已保存的联系人（定位到唯一草稿行）
  await page.getByPlaceholder('按客户名称筛选').fill(company)
  await page.waitForTimeout(300)
  const row2 = page.getByRole('row', { name: new RegExp(company) }).filter({ hasText: '草稿' }).first()
  await expect(row2).toBeVisible()
  await row2.scrollIntoViewIfNeeded()
  await row2.getByRole('button', { name: /编\s*辑/ }).first().click()
  await page.waitForURL('**/quotes/edit/**', { timeout: 15000 })
  await expect(page.getByPlaceholder('请输入联系人')).toHaveValue('李四')

  // 返回列表并删除该草稿记录（唯一值避免误删）
  await page.goBack()
  await expect(page.getByText('新建报价单')).toBeVisible()
  await page.getByPlaceholder('按客户名称筛选').fill(company)
  await page.waitForTimeout(300)
  const row3 = page.getByRole('row', { name: new RegExp(company) }).filter({ hasText: '草稿' }).first()
  await expect(row3).toBeVisible()

  await row3.getByRole('button', { name: /删\s*除/ }).first().click()
  await page.getByRole('button', { name: /^(确定|OK)$/ }).click()
  await expect(page.getByText('删除成功')).toBeVisible()

  // 期望唯一“草稿”行消失（不影响历史已完成记录）
  await expect(page.getByRole('row', { name: new RegExp(company) }).filter({ hasText: '草稿' })).toHaveCount(0)
})
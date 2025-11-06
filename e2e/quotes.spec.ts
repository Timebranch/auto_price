import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { waitBackendReady } from './utils'

const admin = { username: 'admin', password: 'admin123' }

// 辅助：登录
async function login(page: Page) {
  await waitBackendReady(page)
  await page.goto('/login')
  await page.getByPlaceholder('请输入用户名或邮箱').fill(admin.username)
  const pwd = page.getByPlaceholder('请输入密码')
  await pwd.fill(admin.password)
  await pwd.press('Enter')
  await page.waitForURL('**/quotes', { timeout: 30000 })
}

// 填写必填字段与一个报价项目
async function fillCreateForm(page: Page) {
  // 自动选择默认模板后，进入表单区
  await expect(page.getByText('填写报价单信息')).toBeVisible()

  // 顶部标题（可保留默认）
  await expect(page.getByLabel('报价单标题').or(page.getByPlaceholder('请输入报价单标题'))).toBeVisible()

  // 基础信息
  await page.getByPlaceholder('请输入公司名称').fill('Playwright测试公司')
  await page.getByPlaceholder('请输入联系人').fill('张三')
  await page.getByPlaceholder('请输入电话').fill('010-12345678')
  // 公司地址为级联选择（可选填）；保持默认空即可

  // 销售代表电话（校验需要）
  const salesPhone = page.getByPlaceholder('请输入销售代表电话')
  if (await salesPhone.count()) {
    await salesPhone.fill('13900001234')
  }

  // 第一条报价项目
  await page.getByPlaceholder('请输入产品名称').first().fill('H型钢')
  await page.getByPlaceholder('请输入规格型号').first().fill('Q235B 200*200')
  await page.getByPlaceholder('请输入材质').first().fill('Q235B')
  await page.getByPlaceholder('请输入数量').first().fill('5')
  await page.getByPlaceholder('请输入单位').first().fill('吨')
  await page.getByPlaceholder('请输入单价(元)').first().fill('6200')
}

// 创建并生成PDF
test('创建报价单并生成/下载PDF', async ({ page }) => {
  await login(page)

  // 进入创建页
  await page.goto('/quotes/create')
  await expect(page.getByText('创建报价单')).toBeVisible()

  await fillCreateForm(page)

  // 提交并生成PDF：依靠成功提示与网络响应，而不强依赖浏览器下载事件
  await page.getByRole('button', { name: '保存并生成PDF' }).click()
  await expect(page.getByText('保存、生成并开始下载PDF成功')).toBeVisible({ timeout: 60000 })

  // 成功后跳转列表
  await page.waitForURL('**/quotes', { timeout: 30000 })
  await expect(page.getByText('新建报价单')).toBeVisible()

  // 搜索该公司
  await page.getByPlaceholder('按客户名称筛选').fill('Playwright测试公司')
  // 等待表格出现匹配“已完成”的行并锁定单行
  const row = page.getByRole('row', { name: /Playwright测试公司/ }).filter({ hasText: '已完成' }).first()
  await expect(row).toBeVisible()

  // 若已完成且有PDF，点击下载按钮（不强依赖网络响应，避免 blob 下载拦截差异）
  const dlBtn = row.getByRole('button', { name: '下载PDF' }).first()
  if (await dlBtn.count()) {
    await dlBtn.click()
  }
})
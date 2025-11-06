<template>
  <div class="quote-create-container">
    <div v-if="overlayVisible" class="page-overlay">
      <img :src="logoUrl" alt="logo" class="overlay-logo" />
      <div class="overlay-text">正在生成PDF，请稍候…</div>
    </div>
    <div class="header">
      <h1>创建报价单</h1>
      <a-button @click="goBack">返回列表</a-button>
    </div>

    <a-card title="选择模板" style="margin-bottom: 24px;">
      <a-select
        v-model:value="selectedTemplateId"
        placeholder="请选择报价单模板"
        style="width: 300px;"
        @change="onTemplateChange"
      >
        <a-select-option
          v-for="template in templates"
          :key="template.id"
          :value="template.id"
        >
          {{ template.name }}
        </a-select-option>
      </a-select>
    </a-card>

    <a-card v-if="selectedTemplate" title="填写报价单信息">
      <a-form
        :model="formData"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
        @finish="onSubmit"
      >
        <a-form-item
          label="报价单标题"
          name="title"
          :rules="[{ required: true, message: '请输入报价单标题' }]"
        >
          <a-input v-model:value="formData.title" placeholder="请输入报价单标题" />
        </a-form-item>



        <!-- 动态渲染表单字段 -->
        <template v-for="field in formFields" :key="field.name">
          <a-form-item
            v-if="field.type !== 'array'"
            :label="field.label"
            :name="field.name"
            :rules="getRules(field)"
          >
            <!-- 电话输入（允许 + - () 以及空格） -->
            <a-input
              v-if="field.name === 'phone' || field.name === 'salesRepPhone'"
              v-model:value="(formData[field.name] as string)"
              :placeholder="`请输入${field.label}`"
            />
            <!-- 文本输入框 -->
            <a-input
              v-else-if="field.type === 'text'"
              v-model:value="formData[field.name]"
              :placeholder="`请输入${field.label}`"
            />
            <!-- 公司地址级联选择 -->
            <a-cascader
              v-else-if="field.type === 'cascader'"
              v-model:value="(formData[field.name] as string[])"
              :options="regionOptions"
              :placeholder="`请选择${field.label}`"
              style="width: 100%;"
            />
            <!-- 邮箱输入框 -->
            <a-input
              v-else-if="field.type === 'email'"
              v-model:value="formData[field.name]"
              :placeholder="`请输入${field.label}`"
              type="email"
            />
            <!-- 数字输入框 -->
            <a-input-number
              v-else-if="field.type === 'number'"
              v-model:value="formData[field.name]"
              :placeholder="`请输入${field.label}`"
              style="width: 100%;"
            />
            <!-- 日期选择器 -->
            <a-date-picker
              v-else-if="field.type === 'date'"
              v-model:value="formData[field.name]"
              :placeholder="`请选择${field.label}`"
              style="width: 100%;"
            />
            <!-- 下拉选择框 -->
            <a-select
              v-else-if="field.type === 'select'"
              v-model:value="formData[field.name]"
              :placeholder="`请选择${field.label}`"
              style="width: 100%;"
            >
              <a-select-option
                v-for="opt in (field.options || [])"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </a-select-option>
            </a-select>
            <!-- 文本域 -->
            <a-textarea
              v-else-if="field.type === 'textarea'"
              v-model:value="formData[field.name]"
              :placeholder="`请输入${field.label}`"
              :rows="3"
            />
          </a-form-item>

          <!-- 报价展示形式：表格/图片（在销售代表电话之后显示） -->
          <template v-if="field.name === 'salesRepPhone'">
            <a-form-item label="报价展示形式" name="itemsRenderMode">
              <a-radio-group v-model:value="itemsRenderMode">
                <a-radio value="list">表格模式</a-radio>
                <a-radio value="image">图片模式</a-radio>
                <a-radio value="steel">钢结构模式</a-radio>
              </a-radio-group>

              <div v-if="itemsRenderMode === 'image'" class="items-image-section">
                <a-space style="margin-top:8px;">
                  <a-upload :beforeUpload="beforeItemsImageUpload" :showUploadList="false" accept=".png,.jpg,.jpeg,.webp,.bmp">
                    <a-button type="primary">上传项目图片</a-button>
                  </a-upload>
                  <a-button v-if="(formData as any).itemsImageUrl" @click="clearItemsImage">移除图片</a-button>
                </a-space>
                <div v-if="(formData as any).itemsImageUrl" class="items-image-preview">
                  <img :src="(formData as any).itemsImageUrl" alt="项目图片预览" style="max-width:100%; border:1px solid #eee; margin-top:8px;" />
                </div>
                <a-row :gutter="16" style="margin-top:12px;">
                  <a-col :span="12">
                    <a-form-item label="总计金额" name="grandTotalRaw" :rules="[{ required: true, message: '请输入总计金额' }]">
                      <a-input-number v-model:value="(formData['grandTotalRaw'] as number)" :min="0" :precision="2" style="width:100%;" />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="大写">
                      <a-input :value="grandTotalUppercasePreview" disabled style="width:100%;" />
                    </a-form-item>
                  </a-col>
                </a-row>
                <div class="form-tip">图片模式下，仅填写总计金额；大写联动显示。商品合计与税额将根据总计金额与税率(%)动态计算。</div>
              </div>

              <div v-if="itemsRenderMode === 'steel'" class="steel-items-section">
                <a-space style="margin-top:8px;">
                  <span>钢结构模式：仅支持基础项目编辑，不提供文件导入/上传。</span>
                </a-space>
                <div class="array-field-container" style="margin-top:8px;">
                  <div v-for="(item, index) in getSteelItems()" :key="index" class="array-item">
                    <a-card size="small" :title="`钢结构项目 ${index + 1}`">
                      <template #extra>
                        <a-button size="small" danger @click="removeSteelItem(index)">删除</a-button>
                      </template>
                      <a-row :gutter="16">
                        <a-col :span="8">
                          <a-form-item label="加工项目" :label-col="{ span: 24 }" :wrapper-col="{ span: 24 }">
                            <a-input v-model:value="item.processItem" placeholder="请输入加工项目" />
                          </a-form-item>
                        </a-col>
                        <a-col :span="8">
                          <a-form-item label="加工单位" :label-col="{ span: 24 }" :wrapper-col="{ span: 24 }">
                            <a-input v-model:value="item.processUnit" placeholder="请输入加工单位" />
                          </a-form-item>
                        </a-col>
                        <a-col :span="8">
                          <a-form-item label="单价价格" :label-col="{ span: 24 }" :wrapper-col="{ span: 24 }">
                            <a-input v-model:value="item.unitPrice" placeholder="请输入单价价格" />
                          </a-form-item>
                        </a-col>
                        <a-col :span="8">
                          <a-form-item label="总价" :label-col="{ span: 24 }" :wrapper-col="{ span: 24 }">
                            <a-input v-model:value="item.totalPrice" placeholder="请输入总价" />
                          </a-form-item>
                        </a-col>
                        <a-col :span="24">
                          <a-form-item label="备注" :label-col="{ span: 24 }" :wrapper-col="{ span: 24 }">
                            <a-textarea v-model:value="item.remark" :rows="2" placeholder="请输入备注" />
                          </a-form-item>
                        </a-col>
                      </a-row>
                    </a-card>
                  </div>
                  <a-button type="dashed" @click="addSteelItem()" style="width: 100%; margin-top: 16px;">
                    <template #icon><PlusOutlined /></template>
                    添加钢结构项目
                  </a-button>
                </div>
              </div>
            </a-form-item>
          </template>

          <a-form-item
            v-if="field.type === 'array' && itemsRenderMode === 'list'"
            :label="field.label"
            :name="field.name"
          >
            <a-space style="margin-bottom:8px;">
              <a-button @click="downloadTemplate">下载报价单文件</a-button>
              <a-upload :beforeUpload="beforeExcelUpload" :showUploadList="false" accept=".xlsx,.xls">
                <a-button type="primary">上传报价单文件</a-button>
              </a-upload>
            </a-space>
            <div class="array-field-container">
              <div
                v-for="(item, index) in getArrayField(field.name)"
                :key="index"
                class="array-item"
              >
                <a-card size="small" :title="`${field.label} ${index + 1}`">
                  <template #extra>
                    <a-button
                      size="small"
                      danger
                      @click="removeArrayItem(field.name, index)"
                    >
                      删除
                    </a-button>
                  </template>
                  
                  <a-row :gutter="16">
                    <a-col
                      v-for="subField in field.fields"
                      :key="subField.name"
                      :span="subField.type === 'textarea' ? 24 : 8"
                    >
                    <a-form-item
                      :label="subField.label"
                      :label-col="{ span: 24 }"
                      :wrapper-col="{ span: 24 }"
                      style="margin-bottom: 16px;"
                      :rules="getSubFieldRules(subField)"
                    >
                      <a-input
                        v-if="subField.type === 'text'"
                        v-model:value="item[subField.name]"
                        :placeholder="`请输入${subField.label}`"
                      />
                      <a-input-number
                        v-else-if="subField.type === 'number'"
                        v-model:value="item[subField.name]"
                        :placeholder="`请输入${subField.label}`"
                        style="width: 100%;"
                        @change="calculateItemTotal(field.name, index)"
                      />
                      <a-textarea
                        v-else-if="subField.type === 'textarea'"
                        v-model:value="item[subField.name]"
                        :placeholder="`请输入${subField.label}`"
                        :rows="2"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </a-card>
            </div>
              
              <a-button
                type="dashed"
                @click="addArrayItem(field.name, field.fields || [])"
                style="width: 100%; margin-top: 16px;"
              >
                <template #icon>
                  <PlusOutlined />
                </template>
                添加{{ field.label }}
              </a-button>
            </div>
          </a-form-item>
        </template>

        <!-- 已移除签章图片上传表单项 -->

        <a-form-item :wrapper-col="{ offset: 6, span: 18 }">
          <a-space>
            <a-button type="primary" html-type="submit" :loading="submitting">
              保存草稿
            </a-button>
            <a-button type="primary" @click="onSubmitAndGenerate" :loading="submitting">
              保存并生成PDF
            </a-button>
            <a-button @click="goBack">取消</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onActivated } from 'vue'
import { useRouter, onBeforeRouteLeave, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { quoteApi, type QuoteTemplate } from '@/api/quote'
import dayjs from 'dayjs'
import { regionData } from 'element-china-area-data'
import { useAuthStore } from '@/stores/auth'
import type { AxiosError } from 'axios'
import * as XLSX from 'xlsx'

// 类型定义，避免使用 any
type FieldType = 'text' | 'email' | 'number' | 'date' | 'textarea' | 'array' | 'cascader' | 'select'
interface SubField { name: string; label: string; type: 'text' | 'number' | 'textarea' }
interface TemplateField { name: string; label: string; type: FieldType; required?: boolean; fields?: SubField[]; options?: { label: string; value: string }[] }
type DayValue = ReturnType<typeof dayjs>
type ArrayItem = Record<string, string | number>
type FormDataModel = Record<string, string | number | DayValue | string[] | Array<ArrayItem>>

// 表单校验规则的本地类型（覆盖常用字段）
type FormRule = {
  required?: boolean
  message?: string
  type?: 'string' | 'number' | 'email' | 'date'
  pattern?: RegExp
}

// 取消未使用的电话号码 formatter/parser，当前采用文本输入与放宽校验

const authStore = useAuthStore()

// 公司地址级联选项（全国）：将 element-china-area-data 的 value 统一为中文名称，便于存储与显示
interface RegionNodeRaw { label: string; value: string | number; children?: RegionNodeRaw[] }
interface RegionNode { label: string; value: string; children?: RegionNode[] }
const transformRegions = (nodes: RegionNodeRaw[]): RegionNode[] => {
  return (nodes || []).map((n): RegionNode => ({
    label: n.label,
    value: String(n.label),
    children: Array.isArray(n.children) ? transformRegions(n.children) : undefined,
  }))
}
const regionOptions: RegionNode[] = transformRegions(regionData as unknown as RegionNodeRaw[])

// 是/否选项
const yesNoOptions: { label: string; value: string }[] = [
  { label: '是', value: '是' },
  { label: '否', value: '否' },
]

const router = useRouter()
const route = useRoute()
const templates = ref<QuoteTemplate[]>([])
const selectedTemplateId = ref<number>()
const selectedTemplate = ref<QuoteTemplate>()
// 移除未使用的 FormDataModelExt 定义
// interface FormDataModelExt extends FormDataModel { stampImageUrl?: string }

// 移除扩展类型，避免索引类型冲突
const formData = ref<FormDataModel>({
  title: '天津光大钢铁有限公司报价单',
})
const submitting = ref(false)
const overlayVisible = ref(false)
// 统一静态资源基础地址（生产通过 VITE_API_BASE_URL 注入；本地默认 3005）
const API_BASE = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3005'
const UPLOADS_BASE = `${API_BASE.replace(/\/$/, '')}/uploads`
const logoUrl = computed(() => `${UPLOADS_BASE}/logo.jpg`)

// Excel导入模式：初始隐藏手动报价项目，提供下载与上传入口
const excelImportMode = ref(true)
const itemsRenderMode = ref<'list'|'image'|'steel'>('list')
// 钢结构模式项目数组工具
const getSteelItems = (): Array<ArrayItem> => {
  const v = (formData.value as Record<string, unknown>)['steelItems']
  return Array.isArray(v) ? (v as Array<ArrayItem>) : []
}
const addSteelItem = () => {
  const arr = getSteelItems()
  arr.push({ processItem: '', processUnit: '', unitPrice: '', totalPrice: '', remark: '' })
  ;(formData.value as Record<string, unknown>)['steelItems'] = arr
}
const removeSteelItem = (index: number) => {
  const arr = getSteelItems()
  if (index >= 0 && index < arr.length) {
    arr.splice(index, 1)
    ;(formData.value as Record<string, unknown>)['steelItems'] = arr
  }
}
// 大写金额预览（根据总计金额联动）
const numberToChineseUppercase = (n: number): string => {
  const fraction = ['角', '分']
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
  const unit = [['元', '万', '亿'], ['', '拾', '佰', '仟']]
  const head = n < 0 ? '负' : ''
  n = Math.abs(n)
  let s = ''
  for (let i = 0; i < fraction.length; i++) {
    s += ((digit[Math.floor(n * 10 * Math.pow(10, i)) % 10]! + fraction[i]!).replace(/零./, ''))
  }
  s = s || '整'
  let integer = Math.floor(n)
  for (let i = 0; i < unit[0].length && integer > 0; i++) {
    let p = ''
    for (let j = 0; j < unit[1].length && integer > 0; j++) {
      p = digit[integer % 10]! + unit[1][j]! + p
      integer = Math.floor(integer / 10)
    }
    s = p.replace(/(零.)+/g, '零').replace(/零+$/, '') + unit[0][i]! + s
  }
  return head + s
    .replace(/(零元)/, '元')
    .replace(/(零.)+/g, '零')
    .replace(/^元$/, '零元')
}
const grandTotalUppercasePreview = computed(() => {
  const val = parseFloat(String((formData.value as Record<string, unknown>)['grandTotalRaw'] ?? '0')) || 0
  return numberToChineseUppercase(val)
})
const TEMPLATE_FILE_NAME = '天津光大钢铁报价单模板.xlsx'
const downloadTemplate = () => {
  const url = `${UPLOADS_BASE}/${encodeURIComponent(TEMPLATE_FILE_NAME)}`
  window.open(url, '_blank')
}

const headerMap: Record<string, string> = {
  '名称': 'itemName',
  '品名': 'itemName',
  '产品名称': 'itemName',
  '项目名称': 'itemName',
  '规格': 'specification',
  '规格型号': 'specification',
  '材质': 'material',
  '单组数量': 'groupQuantity',
  '数量': 'quantity',
  '单位': 'unit',
  '含税单价': 'unitPrice',
  '单价（元）': 'unitPrice',
  '含税单价（元）': 'unitPrice',
  '金额': 'totalPrice',
  '金额（元）': 'totalPrice',
  '含税总价': 'totalPrice',
  '含税总价（元）': 'totalPrice',
  '备注': 'remark',
  '长度/mm': 'lengthMm',
  '长度（mm）': 'lengthMm',
}

const fuzzyMapHeader = (k: string): string | undefined => {
  const s = k.replace(/\s/g, '')
  if (s.includes('品名') || s.includes('项目名称') || s.includes('产品名称') || s.includes('名称')) return 'itemName'
  if (s.includes('规格')) return 'specification'
  if (s.includes('材质')) return 'material'
  if (s.includes('单组数量')) return 'groupQuantity'
  if (s.includes('数量')) return 'quantity'
  if (s.includes('单位')) return 'unit'
  if (s.includes('含税单价') || s.includes('单价')) return 'unitPrice'
  if (s.includes('含税总价') || s.includes('总价') || s.includes('金额')) return 'totalPrice'
  if (s.includes('备注')) return 'remark'
  if (s.toLowerCase().includes('mm') || s.includes('长度')) return 'lengthMm'
  return undefined
}

const normalizeNumber = (v: unknown): number => {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const s = v.replace(/[,，\s]/g, '')
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

const parseExcelFile = async (file: File) => {
  try {
    const itemsField = formFields.value.find((f) => f.name === 'items' && f.type === 'array')
    if (!itemsField) {
      message.error('当前模板不包含报价项目字段')
      return
    }
    const reader = new FileReader()
    const data: ArrayBuffer = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = (err) => reject(err)
      reader.readAsArrayBuffer(file)
    })
    const workbook = XLSX.read(data, { type: 'array' })
    const parsed: ArrayItem[] = []
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      if (!worksheet) continue
      // 使用按行读取并自动识别列头，避免将标题或空列作为键
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false }) as unknown[][]
       let headerRowIndex = -1
       let colToField: (string | undefined)[] = []
       for (let i = 0; i < rows.length; i++) {
         const rowDataRaw = rows[i]
         const row = (Array.isArray(rowDataRaw) ? rowDataRaw : []) as unknown[]
         const mapped = row.map((cell: unknown) => {
           const t = String(cell ?? '').trim()
           return headerMap[t] ?? fuzzyMapHeader(t)
         })
        const count = mapped.filter(Boolean).length
        const hasKey = mapped.includes('itemName') || mapped.includes('specification') || mapped.includes('material') || mapped.includes('quantity') || mapped.includes('unitPrice') || mapped.includes('totalPrice')
        if (count >= 3 && hasKey) {
          headerRowIndex = i
          colToField = mapped
          break
        }
      }
      if (headerRowIndex === -1) {
        continue
      }
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const rowRaw = rows[i]
        const row = (Array.isArray(rowRaw) ? rowRaw : []) as unknown[]
        const item: ArrayItem = {}
        let hasText = false
        let hasNumericInput = false
        for (let c = 0; c < row.length; c++) {
          const field = colToField[c]
          if (!field) continue
          const f = field as string
          const value = row[c]
          if (['quantity', 'groupQuantity', 'unitPrice', 'totalPrice', 'lengthMm'].includes(f)) {
            const rawStr = String(value ?? '').trim()
            const num = normalizeNumber(value)
            item[f] = num
            if (rawStr !== '') hasNumericInput = true
          } else {
            const str = String(value ?? '').trim()
            item[f] = str
            if (str !== '') hasText = true
          }
        }
        // 如果存在 groupQuantity 但不存在 quantity，则用 groupQuantity 填充 quantity
        if (typeof item.groupQuantity === 'number' && (item.quantity === undefined || item.quantity === '')) {
          item.quantity = item.groupQuantity as number
        }
        // 计算总价，如缺失
        const qty = typeof item.groupQuantity === 'number' ? (item.groupQuantity as number) : (item.quantity as number)
        if (!Number.isFinite(item.totalPrice as number) || (item.totalPrice as number) <= 0) {
          const up = item.unitPrice as number
          if (Number.isFinite(qty) && Number.isFinite(up)) {
            item.totalPrice = qty * up
          } else {
            item.totalPrice = 0
          }
        }
        // 过滤空行（没有任何有效值）：存在任意文本或数值输入即视为有效
        const hasData = hasText || hasNumericInput
        if (hasData) {
          parsed.push(item)
        }
      }
    }

    if (!parsed.length) {
      message.error('Excel中没有有效的报价项目数据，请至少填写一条')
      return
    }

    formData.value.items = parsed
    // 统一再次计算总价
    parsed.forEach((_, idx) => calculateItemTotal('items', idx))
    excelImportMode.value = false
    message.success(`已导入 ${parsed.length} 条报价项目`)
  } catch (error) {
    console.error('解析Excel失败:', error)
    message.error('解析Excel失败，请确认文件格式正确')
  }
}

const beforeExcelUpload = async (file: File) => {
  await parseExcelFile(file)
  return false
}

const beforeItemsImageUpload = async (file: File) => {
  const isImage = file.type.startsWith('image/')
  if (!isImage) { message.error('请上传图片文件'); return false }
  if (file.size > 5 * 1024 * 1024) { message.error('图片大小不能超过 5MB'); return false }
  try {
    const res = await quoteApi.uploadItemsImage(file)
    ;(formData.value as Record<string, unknown>)['itemsImageUrl'] = (res.data?.url || '')
    message.success('项目图片上传成功')
  } catch (error) {
    console.error('上传项目图片失败:', error)
    message.error('上传失败，请重试')
  }
  return false
}

const clearItemsImage = () => {
  delete (formData.value as Record<string, unknown>)['itemsImageUrl']
}

const formFields = computed<TemplateField[]>(() => {
  if (!selectedTemplate.value) return []
  try {
    const raw = JSON.parse(selectedTemplate.value.fields) as TemplateField[]
    // 规范化字段：为报价项目追加备注列
    const fields: TemplateField[] = JSON.parse(JSON.stringify(raw))
    const itemsField = fields.find((f) => f.name === 'items' && f.type === 'array')
    if (itemsField) {
      if (!itemsField.fields) itemsField.fields = []
      const hasRemark = itemsField.fields.some((sf) => sf.name === 'remark')
      if (!hasRemark) {
        itemsField.fields.push({ name: 'remark', label: '备注', type: 'textarea' })
      }
    }
    // 若模板中未包含新增字段，则按需追加
    if (!fields.some((f) => f.name === 'salesRepPhone')) {
      // 将销售代表电话强制为文本类型，避免数字类型校验冲突
      fields.push({ name: 'salesRepPhone', label: '销售代表电话', type: 'text', required: true })
    }
    if (!fields.some((f) => f.name === 'companyAddress')) {
      fields.push({ name: 'companyAddress', label: '公司地址', type: 'cascader' })
    }
    if (!fields.some((f) => f.name === 'freightIncluded')) {
      fields.push({ name: 'freightIncluded', label: '是否包含运费', type: 'select', required: true, options: yesNoOptions })
    }
    if (!fields.some((f) => f.name === 'taxRatePercent')) {
      fields.push({ name: 'taxRatePercent', label: '税率(%)', type: 'number', required: true })
    }
    // 调整顺序：确保“报价项目(items)”位于“销售代表电话”之后
    const idxSales = fields.findIndex((f) => f.name === 'salesRepPhone')
    const idxItems = fields.findIndex((f) => f.name === 'items' && f.type === 'array')
    if (idxSales !== -1 && idxItems !== -1 && idxItems < idxSales) {
      const move = fields[idxItems]!
      fields.splice(idxItems, 1)
      fields.splice(idxSales + 1, 0, move)
    }
    // 确保税率(%)位于报价项目之后
    const idxTax = fields.findIndex((f) => f.name === 'taxRatePercent')
    if (idxTax !== -1 && idxItems !== -1) {
      const taxField = fields[idxTax]!
      fields.splice(idxTax, 1)
      const idxItemsNow = fields.findIndex((f) => f.name === 'items' && f.type === 'array')
      fields.splice(idxItemsNow + 1, 0, taxField)
    }
    return fields
  } catch (error) {
    console.error('解析模板字段失败:', error)
    return []
  }
})

// 字段校验规则（统一必填+类型校验）
const getRules = (field: TemplateField): FormRule[] => {
  const rules: FormRule[] = []
  const forceRequired = new Set(['customerName', 'contactPerson', 'phone', 'salesRep', 'salesRepPhone'])
  if (forceRequired.has(field.name) || field.required) {
    rules.push({ required: true, message: `请输入${field.label}` })
  }
  if (field.name === 'phone') {
    rules.push({ pattern: /^[0-9\-+()（）\s]+$/, message: '电话仅能包含数字、+、-、() 和空格' })
  }
  if (field.name === 'salesRepPhone') {
    rules.push({ pattern: /^[0-9\-+()（）\s]+$/, message: '销售代表电话仅能包含数字、+、-、() 和空格' })
  }
  if (field.type === 'email') {
    rules.push({ type: 'email', message: '请输入有效的邮箱地址' })
  }
  // 对于电话类字段，不应用数字类型规则（允许 + - () 空格）
  if (field.type === 'number' && field.name !== 'salesRepPhone' && field.name !== 'phone') {
    rules.push({ type: 'number', message: `请输入数字` })
  }
  if (field.type === 'date') {
    rules.push({ required: true, message: `请选择${field.label}` })
  }
  return rules
}

// 子项字段校验（数组项）
const getSubFieldRules = (subField: SubField): FormRule[] => {
  const rules: FormRule[] = []
  if (['itemName', 'unit'].includes(subField.name)) {
    rules.push({ required: true, message: `请输入${subField.label}` })
  }
  if (['quantity', 'unitPrice'].includes(subField.name)) {
    rules.push({ required: true, message: `请输入${subField.label}` })
    rules.push({ type: 'number', message: `请输入数字` })
  }
  return rules
}

const generateQuoteNumber = () => {
  const datePart = dayjs().format('YYYYMMDD')
  const randomPart = Math.floor(100000 + Math.random() * 900000).toString() // 6位随机数
  return `QD-${datePart}-${randomPart}`
}

const initFormData = () => {
  const newFormData: FormDataModel = {
    title: '天津大地钢铁有限公司报价单',
  }

  formFields.value.forEach((field: TemplateField) => {
    if (field.type === 'array') {
      newFormData[field.name] = []
    } else if (field.type === 'date') {
      newFormData[field.name] = dayjs()
    } else if (field.type === 'number') {
      newFormData[field.name] = 0
    } else {
      newFormData[field.name] = ''
    }
  })

  // 设置默认值
  if ('quoteNumber' in newFormData) newFormData.quoteNumber = generateQuoteNumber()
  if ('quoteDate' in newFormData) newFormData.quoteDate = dayjs()
  if ('validityPeriod' in newFormData) newFormData.validityPeriod = ''
  if ('taxRatePercent' in newFormData) newFormData.taxRatePercent = 13
  if ('salesRep' in newFormData) newFormData.salesRep = (authStore.user?.username || authStore.user?.fullName || '')
  if ('salesRepPhone' in newFormData) newFormData.salesRepPhone = (authStore.user?.phone || '')
  if ('companyAddress' in newFormData) newFormData.companyAddress = []
  if ('freightIncluded' in newFormData) newFormData.freightIncluded = '否'

  // 初始不添加默认报价项目，等待用户通过 Excel 导入或手动添加

  if ('remarks' in newFormData) newFormData.remarks = ''

  formData.value = newFormData
}

// 恢复获取模板列表函数
const fetchTemplates = async () => {
  try {
    const response = await quoteApi.getTemplates()
    templates.value = response.data

    // 自动选择“默认报价单模板”，如果没有则选择第一个
    const defaultTpl = templates.value.find((t) => t.name === '默认报价单模板') || templates.value[0]
    if (defaultTpl) {
      selectedTemplateId.value = defaultTpl.id
      await onTemplateChange(defaultTpl.id)
    }
  } catch (error) {
    message.error('获取模板列表失败')
    console.error('获取模板列表失败:', error)
  }
}

// 恢复模板切换函数
const applyMockFillIfNeeded = () => {
  const mock = String(route.query.mock || '').toLowerCase()
  const isMock = mock === '1' || mock === 'true'
  if (!isMock) return
  const fd = formData.value
  const fieldExists = (name: string) => formFields.value.some(f => f.name === name)
  // 标题
  if (typeof fd.title === 'string') {
    fd.title = 'Mock演示报价单'
  }
  // 基本信息
  if (fieldExists('customerName')) fd.customerName = '天津光大钢铁有限公司'
  if (fieldExists('companyName')) fd.companyName = '天津光大钢铁有限公司'
  if (fieldExists('contactPerson')) fd.contactPerson = '张三'
  if (fieldExists('phone')) fd.phone = '13800000000'
  if (fieldExists('salesRep')) fd.salesRep = (authStore.user?.username || '管理员')
  if (fieldExists('salesRepPhone')) fd.salesRepPhone = '13912345678'
  if (fieldExists('companyAddress')) fd.companyAddress = ['天津市', '南开区']
  // 日期与有效期
  if (fieldExists('quoteDate')) fd.quoteDate = dayjs()
  if (fieldExists('validityStartDate')) fd.validityStartDate = dayjs()
  if (fieldExists('validityEndDate')) fd.validityEndDate = dayjs().add(7, 'day')
  if (fieldExists('freightIncluded')) fd.freightIncluded = '否'
  // 项目
  if (fieldExists('items')) {
    const arr = getArrayField('items')
    if (!arr.length) {
      addArrayItem('items', (formFields.value.find(f => f.name === 'items')?.fields || []))
    }
    const item = arr[0]
    if (item) {
      ;(item as ArrayItem).itemName = '热轧钢板 Q235'
      ;(item as ArrayItem).specification = '3.0*1250*2500'
      ;(item as ArrayItem).material = 'Q235'
      ;(item as ArrayItem).unit = '吨'
      ;(item as ArrayItem).quantity = 20
      ;(item as ArrayItem).unitPrice = 4200
      calculateItemTotal('items', 0)
      ;(item as ArrayItem).remark = '此报价为Mock示例，用于演示系统功能。'
    }
  }
  // 备注
  if (fieldExists('remarks')) fd.remarks = '此报价为Mock示例，用于演示系统功能。'
}

const onTemplateChange = async (templateId: number) => {
  try {
    const response = await quoteApi.getTemplate(templateId)
    selectedTemplate.value = response.data
    initFormData()
    // 若为mock模式，自动填充示例数据
    applyMockFillIfNeeded()
  } catch (error) {
    message.error('获取模板详情失败')
    console.error('获取模板详情失败:', error)
  }
}

// 更新数组项处理函数的类型
const addArrayItem = (fieldName: string, subFields: SubField[]) => {
  const newItem: ArrayItem = {}
  subFields.forEach((subField) => {
    if (subField.type === 'number') {
      newItem[subField.name] = 0
    } else {
      newItem[subField.name] = ''
    }
  })

  if (!formData.value[fieldName]) {
    formData.value[fieldName] = []
  }
  ;(formData.value[fieldName] as Array<ArrayItem>).push(newItem)
}

const removeArrayItem = (fieldName: string, index: number) => {
  const arr = formData.value[fieldName] as Array<ArrayItem>
  arr.splice(index, 1)
}

const calculateItemTotal = (fieldName: string, index: number) => {
  const arr = formData.value[fieldName] as Array<ArrayItem>
  const item = arr[index] as { quantity?: number; groupQuantity?: number; unitPrice?: number; totalPrice?: number }
  const qty = typeof item.groupQuantity === 'number' ? item.groupQuantity : item.quantity
  if (item && typeof qty === 'number' && typeof item.unitPrice === 'number') {
    item.totalPrice = qty * item.unitPrice
  }
}

const prepareFormData = () => {
  const data: Record<string, unknown> = { ...formData.value }

  // 处理日期字段
  formFields.value.forEach((field) => {
    if (field.type === 'date' && data[field.name]) {
      data[field.name] = dayjs(data[field.name] as DayValue).format('YYYY-MM-DD')
    }
    // 公司地址级联序列化为字符串
    if (field.name === 'companyAddress') {
      const v = data[field.name]
      if (Array.isArray(v)) {
        data[field.name] = (v as string[]).join(' ')
      }
    }
  })

  // 图片模式下，启用手动总计计算
  if (itemsRenderMode.value === 'image') {
    data['preferManualTotals'] = true
  }
  if (itemsRenderMode.value === 'steel') {
    data['steelStructureMode'] = true
  }

  return data
}

const getArrayField = (fieldName: string): Array<ArrayItem> => {
  const v = formData.value[fieldName]
  return Array.isArray(v) ? (v as Array<ArrayItem>) : []
}

// 额外提交前校验（数组项与关键字段）
const labelMap: Record<string, string> = {
  customerName: '客户公司名称',
  contactPerson: '联系人',
  phone: '电话',
  salesRep: '销售代表',
  salesRepPhone: '销售代表电话',
}

const validateBeforeSubmit = (): boolean => {
  const requiredFields = ['customerName', 'contactPerson', 'phone', 'salesRep', 'salesRepPhone'] as const
  for (const name of requiredFields) {
    const v = formData.value[name]
    const isEmpty = v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
    if (isEmpty) {
      message.error(`请填写${labelMap[name] || name}`)
      return false
    }
  }
  if (!/^[0-9\-+()（）\s]+$/.test(String((formData.value as Record<string, unknown>).phone ?? ''))) {
    message.error('电话仅能包含数字、+、-、() 和空格')
    return false
  }
  if (!/^[0-9\-+()（）\s]+$/.test(String((formData.value as Record<string, unknown>).salesRepPhone ?? ''))) {
    message.error('销售代表电话仅能包含数字、+、-、() 和空格')
    return false
  }
  if (itemsRenderMode.value === 'image') {
    const url = String((formData.value as Record<string, unknown>)['itemsImageUrl'] || '').trim()
    if (!url) {
      message.error('请上传报价项目图片')
      return false
    }
    const gt = Number((formData.value as Record<string, unknown>)['grandTotalRaw'] || 0)
    if (!Number.isFinite(gt) || gt <= 0) {
      message.error('请填写有效的总计金额')
      return false
    }
    const tax = Number((formData.value as Record<string, unknown>)['taxRatePercent'] || 0)
    if (!Number.isFinite(tax) || tax < 0 || tax > 100) {
      message.error('请填写0-100之间的税率')
      return false
    }
  } else if (itemsRenderMode.value === 'steel') {
    const steelItems = getSteelItems()
    if (!steelItems || steelItems.length < 1) {
      message.error('请至少填写一个钢结构报价项目')
      return false
    }
    for (let i = 0; i < steelItems.length; i++) {
      const item = steelItems[i] as { processItem?: string; processUnit?: string; unitPrice?: string | number; totalPrice?: string | number; remark?: string }
      if (!item || String(item.processItem || '').trim() === '') {
        message.error(`第${i + 1}行加工项目不能为空`)
        return false
      }
      if (!item || String(item.processUnit || '').trim() === '') {
        message.error(`第${i + 1}行加工单位不能为空`)
        return false
      }
      const unitPriceNum = Number(item.unitPrice)
      if (!Number.isFinite(unitPriceNum) || unitPriceNum <= 0) {
        message.error(`第${i + 1}行单价价格需为正数`)
        return false
      }
      // 总价字段不进行数值校验，允许填写中文或数字
    }
  } else {
    const items = getArrayField('items')
    if (!items || items.length < 1) {
      message.error('请至少填写一个报价项目')
      return false
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as { itemName?: string; unit?: string; quantity?: number; groupQuantity?: number; unitPrice?: number; totalPrice?: number }
      if (!item || String(item.itemName || '').trim() === '') {
        message.error(`第${i + 1}行项目名称不能为空`)
        return false
      }
      if (!item || String(item.unit || '').trim() === '') {
        message.error(`第${i + 1}行单位不能为空`)
        return false
      }
      const qty = typeof item.groupQuantity === 'number' ? item.groupQuantity : item.quantity
      const unitPrice = item.unitPrice
      if (!Number.isFinite(qty as number) || (qty as number) <= 0) {
        message.error(`第${i + 1}行数量需为正数`)
        return false
      }
      if (!Number.isFinite(unitPrice as number) || (unitPrice as number) <= 0) {
        message.error(`第${i + 1}行单价需为正数`)
        return false
      }
      item.totalPrice = (qty as number) * (unitPrice as number)
    }
  }
  return true
}

const onSubmit = async () => {
  if (!selectedTemplateId.value) {
    message.error('请选择模板')
    return
  }
  if (!validateBeforeSubmit()) return
  
  submitting.value = true
  try {
    const data = prepareFormData()
    await quoteApi.createQuoteRecord({
      template_id: selectedTemplateId.value,
      title: typeof formData.value.title === 'string' ? formData.value.title : String(formData.value.title),
      form_data: data,
    })
    
    message.success('保存成功')
    router.push('/quotes')
  } catch (error) {
    message.error('保存失败')
    console.error('保存失败:', error)
  } finally {
    submitting.value = false
  }
}

const onSubmitAndGenerate = async () => {
  if (!selectedTemplateId.value) {
    message.error('请选择模板')
    return
  }
  if (!validateBeforeSubmit()) return
  
  submitting.value = true
  overlayVisible.value = true
  try {
    const data = prepareFormData()
    const response = await quoteApi.createQuoteRecord({
      template_id: selectedTemplateId.value,
      title: typeof formData.value.title === 'string' ? formData.value.title : String(formData.value.title),
      form_data: data,
    })
    
    const genRes = await quoteApi.generatePDF(response.data.id)
    const pdfPath = String(genRes.data?.pdf_path || '')
    let filename = `quote_${response.data.id}.pdf`
    if (pdfPath) {
      const base = pdfPath.split('/').pop()
      if (base && base.endsWith('.pdf')) {
        filename = base
      } else if (base) {
        filename = `${base}.pdf`
      }
    }
    const dl = await quoteApi.downloadPDF(response.data.id)
    const url = window.URL.createObjectURL(new Blob([dl.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    
    message.success('保存、生成并开始下载PDF成功')
    router.push('/quotes')
  } catch (error) {
    const err = error as AxiosError<{ error?: string; message?: string }>
    const serverMsg = err.response?.data?.error || err.response?.data?.message || err.message || '操作失败'
    message.error(serverMsg)
    console.error('操作失败:', err)
  } finally {
    submitting.value = false
    overlayVisible.value = false
  }
}

const goBack = () => {
  router.push('/quotes')
}

onMounted(() => {
  fetchTemplates()
})

// 离开当前路由时清空已填写表单与选择，避免返回后残留
onBeforeRouteLeave(() => {
  selectedTemplateId.value = undefined
  selectedTemplate.value = undefined
  formData.value = { title: '天津光大钢铁有限公司报价单' }
})

// 每次视图被再次激活时（若未来启用 keep-alive），重新回填默认值
onActivated(() => {
  if (selectedTemplate.value) {
    initFormData()
  } else if (!templates.value.length) {
    fetchTemplates()
  }
})
</script>

<style scoped>
.quote-create-container {
  position: relative; padding: 24px; }
.page-overlay { position: fixed; inset: 0; background: rgba(255,255,255,0.88); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 2000; }
.overlay-logo { width: 120px; height: 120px; object-fit: contain; animation: pulse 1.2s ease-in-out infinite; }
.overlay-text { margin-top: 16px; color: #333; font-size: 14px; }
@keyframes pulse { 0% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 0.9; } }

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header h1 {
  margin: 0;
}

.array-field-container {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 16px;
  background-color: #ffffff;
}

.array-item {
  margin-bottom: 16px;
}

.array-item:last-child {
  margin-bottom: 0;
}
</style>

<style scoped>
/* 暗色模式覆盖 */
:global(.layout.dark) .quote-create-container .array-field-container {
  background-color: #1a1a1a;
  border-color: #303030;
}
:global(.layout.dark) .quote-create-container .overlay-text { color: #e8e8e8; }
:global(.layout.dark) .quote-create-container .page-overlay { background: rgba(0,0,0,0.55); }
</style>
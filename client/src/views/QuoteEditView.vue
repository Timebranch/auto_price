<template>
  <div class="quote-edit-container">
    <div v-if="overlayVisible" class="page-overlay">
      <img :src="logoUrl" alt="logo" class="overlay-logo" />
      <div class="overlay-text">正在生成PDF，请稍候…</div>
    </div>
    <div class="header">
      <h1>编辑报价单</h1>
      <a-button @click="goBack">返回列表</a-button>
    </div>

    <a-card v-if="quoteRecord" title="报价单信息">
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
            :rules="field.required ? [{ required: true, message: `请输入${field.label}` }] : []"
          >
            <!-- 文本输入框 -->
            <a-input
              v-if="field.type === 'text'"
              v-model:value="formData[field.name]"
              :placeholder="`请输入${field.label}`"
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
            <!-- 公司地址级联选择 -->
            <a-cascader
              v-else-if="field.type === 'cascader'"
              v-model:value="(formData[field.name] as unknown as string[])"
              :options="regionOptions"
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

          <!-- 数组类型字段（如报价项目） -->
          <a-form-item
            v-else-if="field.type === 'array'"
            :label="field.label"
            :name="field.name"
          >
            <div class="array-field-container">
              <div
                v-for="(item, index) in getArrayItems(field.name)"
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
                      >
                        <a-input
                          v-if="subField.type === 'text'"
                          v-model:value="(item[subField.name] as string)"
                          :placeholder="`请输入${subField.label}`"
                        />
                        <a-input-number
                          v-else-if="subField.type === 'number'"
                          v-model:value="(item[subField.name] as number)"
                          :placeholder="`请输入${subField.label}`"
                          style="width: 100%;"
                          @change="() => calculateItemTotal(field.name, index)"
                        />
                        <a-textarea
                          v-else-if="subField.type === 'textarea'"
                          v-model:value="(item[subField.name] as string)"
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
                @click="addArrayItem(field.name, field.fields)"
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

        <a-form-item :wrapper-col="{ offset: 6, span: 18 }">
          <a-space>
            <a-button type="primary" html-type="submit" :loading="submitting">
              保存草稿
            </a-button>
            <a-button type="primary" @click="onSubmitAndGenerate" :loading="submitting">
              保存并生成PDF
            </a-button>
            <a-button 
              v-if="quoteRecord.generated_pdf_path" 
              @click="downloadPDF" 
              :loading="downloading"
            >
              下载PDF
            </a-button>
            <a-button @click="goBack">取消</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-spin v-else size="large" style="display: block; text-align: center; margin-top: 100px;" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { quoteApi, type QuoteRecord, type QuoteTemplate } from '@/api/quote'
import dayjs from 'dayjs'
import { regionData } from 'element-china-area-data'

// 类型定义，避免使用 any
type FieldType = 'text' | 'email' | 'number' | 'date' | 'textarea' | 'array' | 'cascader' | 'select'
interface SubField { name: string; label: string; type: 'text' | 'number' | 'textarea' }
interface TemplateField { name: string; label: string; type: FieldType; required?: boolean; fields?: SubField[]; options?: { label: string; value: string }[] }
type DayValue = ReturnType<typeof dayjs>
type ArrayItem = Record<string, string | number>
type FormDataModel = Record<string, string | DayValue | number | string[] | Array<ArrayItem>>

// 地区节点类型（避免 any）
type RegionNodeRaw = { label: string; value?: string | number; children?: RegionNodeRaw[] }
type RegionNode = { label: string; value: string; children?: RegionNode[] }

const router = useRouter()
const route = useRoute()
const quoteRecord = ref<QuoteRecord>()
const template = ref<QuoteTemplate>()
const formData = ref<FormDataModel>({})
const submitting = ref(false)
const downloading = ref(false)
const overlayVisible = ref(false)
// 统一静态资源基础地址（生产通过 VITE_API_BASE_URL 注入；本地默认 3005）
const API_BASE = (import.meta.env?.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3005'
const UPLOADS_BASE = `${API_BASE.replace(/\/$/, '')}/uploads`
const logoUrl = computed(() => `${UPLOADS_BASE}/logo.jpg`)

const quoteId = computed(() => Number(route.params.id))

const formFields = computed<TemplateField[]>(() => {
  if (!template.value) return []
  try {
    const fields = JSON.parse(template.value.fields || '[]') as TemplateField[]
    const exists = (name: string) => fields.some((f) => f.name === name)
    if (!exists('companyAddress')) {
      fields.push({ name: 'companyAddress', label: '公司地址', type: 'cascader' })
    }
    if (!exists('salesRepPhone')) {
      fields.push({ name: 'salesRepPhone', label: '业务电话', type: 'text' })
    }
    return fields
  } catch (error) {
    console.error('解析模板字段失败:', error)
    return []
  }
})

// 公司地址级联选项（全国）：将 element-china-area-data 的 value 统一为中文名称，便于存储与显示
const transformRegions = (nodes: RegionNodeRaw[]): RegionNode[] => {
  return (nodes || []).map((n) => ({
    label: n.label,
    value: String(n.label),
    children: n.children ? transformRegions(n.children) : undefined,
  }))
}
const regionOptions: RegionNode[] = transformRegions(regionData as RegionNodeRaw[])

const fetchQuoteRecord = async () => {
  try {
    const response = await quoteApi.getQuoteRecord(quoteId.value)
    quoteRecord.value = response.data
    
    // 获取模板信息
    const templateResponse = await quoteApi.getTemplate(response.data.template_id)
    template.value = templateResponse.data
    
    initFormData()
  } catch (error) {
    message.error('获取报价单详情失败')
    console.error('获取报价单详情失败:', error)
  }
}

const initFormData = () => {
  if (!quoteRecord.value) return
  
  try {
    const savedFormData = JSON.parse(quoteRecord.value.form_data) as Record<string, unknown>
    
    // 处理日期字段
    formFields.value.forEach((field: TemplateField) => {
      if (field.type === 'date' && savedFormData[field.name]) {
        savedFormData[field.name] = dayjs(savedFormData[field.name] as string)
      }
      // 公司地址字符串转数组（用于级联显示）
      if (field.name === 'companyAddress') {
        const v = savedFormData[field.name]
        if (typeof v === 'string') {
          savedFormData[field.name] = (v as string).split(/\s+/).filter(Boolean)
        }
      }
    })
    
    formData.value = {
      title: quoteRecord.value.title,
      ...(savedFormData as FormDataModel),
    }

    // 缺失时为“是否包含运费”设置默认值为“否”
    if (formData.value['freightIncluded'] === undefined || formData.value['freightIncluded'] === '') {
      formData.value['freightIncluded'] = '否'
    }
  } catch (error) {
    console.error('解析表单数据失败:', error)
    formData.value = { title: quoteRecord.value.title }
  }
}

const addArrayItem = (fieldName: string, subFields?: SubField[]) => {
  const fields = subFields ?? []
  const newItem: ArrayItem = {}
  fields.forEach((subField) => {
    if (subField.type === 'number') {
      newItem[subField.name] = 0
    } else {
      newItem[subField.name] = ''
    }
  })
  
  if (!formData.value[fieldName] || !Array.isArray(formData.value[fieldName])) {
    formData.value[fieldName] = []
  }
  ;(formData.value[fieldName] as Array<ArrayItem>).push(newItem)
}

const removeArrayItem = (fieldName: string, index: number) => {
  const val = formData.value[fieldName]
  if (Array.isArray(val)) {
    (val as Array<ArrayItem>).splice(index, 1)
  }
}

// 强类型获取数组项，避免模板隐式 any 索引
const getArrayItems = (name: string): ArrayItem[] => {
  const v = formData.value[name]
  return Array.isArray(v) ? (v as Array<ArrayItem>) : []
}

interface ItemWithPrice { groupQuantity?: number; quantity?: number; unitPrice?: number; totalPrice?: number }
const calculateItemTotal = (fieldName: string, index: number) => {
  const val = formData.value[fieldName]
  if (!Array.isArray(val)) return
  const item = val[index] as ItemWithPrice
  const qty = typeof item.groupQuantity === 'number' ? item.groupQuantity : item.quantity
  if (item && typeof qty === 'number' && typeof item.unitPrice === 'number') {
    item.totalPrice = qty * item.unitPrice
  }
}

// 已移除签章图片上传与回填逻辑，后端会自动注入默认签章URL

// 合并签章URL到提交数据
const prepareFormData = () => {
  const data: Record<string, unknown> = { ...formData.value }
  formFields.value.forEach((field: TemplateField) => {
    const val = data[field.name]
    if (field.type === 'date' && val) {
      if (dayjs.isDayjs(val)) {
        data[field.name] = (val as DayValue).format('YYYY-MM-DD')
      } else {
        data[field.name] = dayjs(val as string).format('YYYY-MM-DD')
      }
    }
    // 公司地址数组转字符串（便于模板与PDF展示）
    if (field.name === 'companyAddress') {
      const v = data[field.name]
      if (Array.isArray(v)) {
        data[field.name] = (v as string[]).join(' ')
      }
    }
  })
  return data
}

const onSubmit = async () => {
  submitting.value = true
  try {
    const data = prepareFormData()
    await quoteApi.updateQuoteRecord(quoteId.value, {
      title: String(formData.value.title ?? ''),
      form_data: data,
      status: 'draft',
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
  submitting.value = true
  overlayVisible.value = true
  try {
    const data = prepareFormData()
    await quoteApi.updateQuoteRecord(quoteId.value, {
      title: String(formData.value.title ?? ''),
      form_data: data,
      status: 'completed',
    })
    await quoteApi.generatePDF(quoteId.value)
    await downloadPDF()
    message.success('保存、生成并开始下载PDF成功')
    router.push('/quotes')
  } catch (error) {
    message.error('操作失败')
    console.error('操作失败:', error)
  } finally {
    submitting.value = false
    overlayVisible.value = false
  }
}

const downloadPDF = async () => {
  downloading.value = true
  try {
    const response = await quoteApi.downloadPDF(quoteId.value)
    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${String(formData.value.title || 'quote')}.pdf`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    message.error('下载PDF失败')
    console.error('下载PDF失败:', error)
  } finally {
    downloading.value = false
  }
}

const goBack = () => {
  router.push('/quotes')
}

onMounted(() => {
  fetchQuoteRecord()
})
</script>

<style scoped>
.quote-edit-container { position: relative; padding: 24px; }
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
:global(.layout.dark) .quote-edit-container .array-field-container {
  background-color: #1a1a1a;
  border-color: #303030;
}
:global(.layout.dark) .quote-edit-container .overlay-text { color: #e8e8e8; }
:global(.layout.dark) .quote-edit-container .page-overlay { background: rgba(0,0,0,0.55); }
</style>
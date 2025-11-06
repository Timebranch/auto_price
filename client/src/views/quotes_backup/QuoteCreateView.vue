<template>
  <div class="quote-create-container">
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

        <!-- 签章图片上传（仅图片，最大5MB） -->
        <a-form-item label="签章图片" name="stampImageUrl">
          <a-space direction="vertical" style="width: 100%">
            <input type="file" accept="image/*" @change="onStampFileSelected" />
            <div v-if="stampImageUrl" style="text-align: right; margin-top: 8px;">
              <img :src="stampImageUrl" alt="签章预览" style="max-width: 120px; max-height: 120px; opacity: 0.9;" />
            </div>
          </a-space>
        </a-form-item>

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
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { quoteApi, type QuoteTemplate } from '@/api/quote'
import dayjs from 'dayjs'
import { useAuthStore } from '@/stores/auth'

// 类型定义，避免使用 any
type FieldType = 'text' | 'email' | 'number' | 'date' | 'textarea' | 'array'
interface SubField { name: string; label: string; type: 'text' | 'number' | 'textarea' }
interface TemplateField { name: string; label: string; type: FieldType; required?: boolean; fields?: SubField[] }
type DayValue = ReturnType<typeof dayjs>
type ArrayItem = Record<string, string | number>
type FormDataModel = Record<string, string | number | DayValue | Array<ArrayItem>>

const authStore = useAuthStore()

const router = useRouter()
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

const formFields = computed<TemplateField[]>(() => {
  if (!selectedTemplate.value) return []
  try {
    return JSON.parse(selectedTemplate.value.fields) as TemplateField[]
  } catch (error) {
    console.error('解析模板字段失败:', error)
    return []
  }
})

const getRules = (field: TemplateField) => {
  if (field?.name === 'customerName' || field?.name === 'projectName') {
    return []
  }
  return field?.required ? [{ required: true, message: `请输入${field.label}` }] : []
}

const generateQuoteNumber = () => {
  const datePart = dayjs().format('YYYYMMDD')
  const randomPart = Math.floor(100000 + Math.random() * 900000).toString() // 6位随机数
  return `QD-${datePart}-${randomPart}`
}

const initFormData = () => {
  const newFormData: FormDataModel = {
    title: '天津光大钢铁有限公司报价单',
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

  // 自动生成报价单号与日期
  newFormData['quoteNumber'] = generateQuoteNumber()
  newFormData['quoteDate'] = dayjs()

  formData.value = newFormData
}

const onTemplateChange = (templateId: number) => {
  selectedTemplate.value = templates.value.find(t => t.id === templateId)
  initFormData()
}

const getArrayField = (fieldName: string) => {
  const arr = (formData.value[fieldName] as Array<ArrayItem>) || []
  return arr
}

const addArrayItem = (fieldName: string, subFields: SubField[] = []) => {
  const arr = (formData.value[fieldName] as Array<ArrayItem>) || []
  const newItem: ArrayItem = {}
  subFields.forEach(sf => { newItem[sf.name] = '' })
  arr.push(newItem)
  formData.value[fieldName] = arr
}

const removeArrayItem = (fieldName: string, index: number) => {
  const arr = (formData.value[fieldName] as Array<ArrayItem>) || []
  arr.splice(index, 1)
  formData.value[fieldName] = arr
}

const calculateItemTotal = (fieldName: string, index: number) => {
  const arr = (formData.value[fieldName] as Array<ArrayItem>) || []
  if (!arr[index]) return
  const item = arr[index]
  const qty = Number(item.quantity || 0)
  const unitPrice = Number(item.unitPrice || 0)
  item.totalPrice = Number((qty * unitPrice).toFixed(2))
}

const onSubmit = async () => {
  submitting.value = true
  try {
    const payload = { title: String(formData.value.title || '报价单'), form_data: { ...formData.value } }
    const res = await quoteApi.createQuoteRecord(payload)
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
  try {
    const payload = { title: String(formData.value.title || '报价单'), form_data: { ...formData.value } }
    const res = await quoteApi.createQuoteRecord(payload)
    await quoteApi.generatePDF(res.data.id)
    message.success('保存并生成PDF成功')
    router.push('/quotes')
  } catch (error) {
    message.error('保存并生成PDF失败')
    console.error('保存并生成PDF失败:', error)
  } finally {
    submitting.value = false
  }
}

const onStampFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // 限制上传大小：5MB
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    message.error('图片大小不能超过 5MB')
    return
  }

  // 上传到服务器
  try {
    const formDataStamp = new FormData()
    formDataStamp.append('file', file)
    const res = await quoteApi.uploadStamp(formDataStamp)
    const url: string = res.data?.url || ''
    formData.value['stampImageUrl'] = url
    message.success('签章图片上传成功')
  } catch (error) {
    message.error('签章图片上传失败')
  }
}

const goBack = () => { router.push('/quotes') }

const fetchTemplates = async () => {
  try {
    const res = await quoteApi.getTemplates()
    templates.value = res.data
    if (templates.value.length > 0) {
      selectedTemplateId.value = templates.value[0].id
      selectedTemplate.value = templates.value[0]
      initFormData()
    }
  } catch (error) {
    message.error('获取模板失败')
    console.error('获取模板失败:', error)
  }
}

onMounted(() => {
  authStore.fetchCurrentUser().catch(() => {})
  fetchTemplates()
})
</script>

<style scoped>
.quote-create-container { padding: 24px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.array-field-container { display: flex; flex-direction: column; gap: 8px; }
.array-item { margin-bottom: 12px; }
</style>
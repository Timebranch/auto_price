<template>
  <div class="quote-edit-container">
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
                v-for="(item, index) in formData[field.name]"
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

// 类型定义，避免使用 any
type FieldType = 'text' | 'email' | 'number' | 'date' | 'textarea' | 'array'
interface SubField { name: string; label: string; type: 'text' | 'number' | 'textarea' }
interface TemplateField { name: string; label: string; type: FieldType; required?: boolean; fields?: SubField[] }
type DayValue = ReturnType<typeof dayjs>
type ArrayItem = Record<string, string | number>
type FormDataModel = Record<string, string | DayValue | number | Array<ArrayItem>>

const router = useRouter()
const route = useRoute()
const quoteRecord = ref<QuoteRecord>()
const template = ref<QuoteTemplate>()
const formData = ref<FormDataModel>({})
const submitting = ref(false)
const downloading = ref(false)

const quoteId = computed(() => Number(route.params.id))

const formFields = computed<TemplateField[]>(() => {
  if (!template.value) return []
  try {
    return JSON.parse(template.value.fields || '[]') as TemplateField[]
  } catch (error) {
    console.error('解析模板字段失败:', error)
    return []
  }
})

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
    })
    
    formData.value = {
      title: quoteRecord.value.title,
      ...(savedFormData as FormDataModel),
    }
  } catch (error) {
    console.error('解析表单数据失败:', error)
    formData.value = { title: quoteRecord.value.title }
  }
}

const addArrayItem = (fieldName: string, subFields?: SubField[]) => {
  const fields = subFields ?? []
  const arr = (formData.value[fieldName] as Array<ArrayItem>) || []
  const newItem: ArrayItem = {}
  fields.forEach(sf => { newItem[sf.name] = '' })
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
    await quoteApi.updateQuoteRecord(quoteId.value, payload)
    message.success('保存成功')
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
    await quoteApi.updateQuoteRecord(quoteId.value, payload)
    await quoteApi.generatePDF(quoteId.value)
    message.success('保存并生成PDF成功')
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

const downloadPDF = async () => {
  if (!quoteRecord.value) return
  downloading.value = true
  try {
    const response = await quoteApi.downloadPDF(quoteId.value)
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${quoteRecord.value.title || 'quote'}.pdf`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    message.error('下载PDF失败')
  } finally {
    downloading.value = false
  }
}

const goBack = () => { router.push('/quotes') }

onMounted(() => { fetchQuoteRecord() })
</script>

<style scoped>
.quote-edit-container { padding: 24px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.array-field-container { display: flex; flex-direction: column; gap: 8px; }
.array-item { margin-bottom: 12px; }
</style>
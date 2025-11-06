<template>
  <div class="kb-container">
    <div class="kb-header">
      <a-space>
        <a-button v-if="isAdmin" @click="openBulkImport">导入Mock数据</a-button>
        <a-button v-if="!isAdmin" type="primary" @click="openCreate">新增问题</a-button>
      </a-space>
      <a-input-search v-model:value="searchKeyword" placeholder="按标题与内容检索" allowClear style="width: 280px" />
    </div>

    <div class="kb-list">
      <a-table
        :data-source="filteredArticles"
        :columns="columns"
        row-key="id"
        :loading="loading"
        bordered
        :rowClassName="rowClassByDate"
        v-model:expandedRowKeys="expandedRowKeys"
      >
        <template #expandedRowRender="{ record }">
          <div class="kb-content" v-html="formatContent(record.content, searchKeyword)"></div>
        </template>
        <template #bodyCell="{ column, record, index }">
          <template v-if="isAdmin && column.key === 'actions'">
            <a-space>
              <a-button size="small" @click="openEdit(record)">修改</a-button>
              <a-popconfirm
                title="确认删除该问题？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="deleteArticle(record)"
              >
                <a-button size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
          <template v-else-if="column.key === 'id'">
            {{ index + 1 }}
          </template>
          <template v-else-if="column.key === 'title'">
            <span v-html="highlightText(record.title)"></span>
          </template>
          <template v-else-if="column.key === 'created_at'">
            {{ (record.created_at || '').slice(0, 10) }}
          </template>
        </template>
      </a-table>
    </div>

    <!-- 新增（销售） -->
    <a-modal v-model:open="createOpen" title="新增问题" @ok="createArticle" ok-text="提交" cancel-text="取消">
      <a-form layout="vertical">
        <a-form-item label="问题标题">
          <a-input v-model:value="createForm.title" placeholder="请输入问题标题" />
        </a-form-item>
        <a-form-item label="问题内容">
          <QuillEditor v-model:content="createForm.content" contentType="html" :toolbar="quillToolbar" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 导入Mock（管理员，单条） -->
    <a-modal v-model:open="bulkOpen" title="导入Mock数据（单条）" @ok="importMockSingle" ok-text="导入" cancel-text="取消">
      <a-form layout="vertical">
        <a-form-item label="标题">
          <a-input v-model:value="mockTitle" placeholder="请输入标题（例如：热轧钢材价格计算规则）" />
        </a-form-item>
        <a-form-item label="内容（按段落或列表分行）">
          <a-textarea v-model:value="mockContent" :rows="10" placeholder="示例：\n概述：本条用于说明计算规则。\n- 步骤1：选择材质\n- 步骤2：确定市场价\n\n注意：可按空行分段，列表用“ - ”或“1.”开头。" />
        </a-form-item>
        <a-form-item>
          <a-alert type="info" message="系统将自动将内容排版为富文本（段落、列表），并添加 Mock 标记以便后续统一清理。" show-icon />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑（管理员） -->
    <a-modal v-model:open="editOpen" title="修改知识" @ok="updateArticle" ok-text="保存" cancel-text="取消">
      <a-form layout="vertical">
        <a-form-item label="问题标题">
          <a-input v-model:value="editForm.title" placeholder="请输入问题标题" />
        </a-form-item>
        <a-form-item label="问题内容">
          <QuillEditor v-model:content="editForm.content" contentType="html" :toolbar="quillToolbar" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { knowledgeApi, type KnowledgeArticle } from '@/api/knowledge'
import { message } from 'ant-design-vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import DOMPurify from 'dompurify'

const auth = useAuthStore()
const role = computed(() => (auth.user?.role ?? 'user'))
const isAdmin = computed(() => role.value === 'admin' || role.value === 'finance')

const loading = ref(false)
const articles = ref<KnowledgeArticle[]>([])
const searchKeyword = ref('')

// Quill 工具栏配置（精简常用）
const quillToolbar = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ header: [1, 2, 3, false] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link', 'blockquote', 'code'],
  ['clean']
]

// 列定义：统一表格视图，管理员增加操作列
const columns = computed(() => {
  const base = [
    { title: '序号', dataIndex: 'id', key: 'id', width: 100 },
    { title: '日期', dataIndex: 'created_at', key: 'created_at', width: 140 },
    { title: '问题标题', dataIndex: 'title', key: 'title' },
  ]
  if (isAdmin.value) base.push({ title: '操作', dataIndex: 'actions', key: 'actions', width: 180 })
  return base
})

// 排序并在表格中按天添加视觉分隔
const sortedArticles = computed(() => {
  return articles.value.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
})

const stripTags = (html: string) => html.replace(/<[^>]+>/g, ' ')
const highlightHtml = (html: string, kw: string) => {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(esc, 'gi')
  return html.replace(re, (m) => `<span class="kb-search-hit">${m}</span>`)
}
const highlightText = (text: string) => {
  const kw = searchKeyword.value.trim()
  if (!kw) return text
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(esc, 'gi')
  return text.replace(re, (m) => `<span class="kb-search-hit">${m}</span>`)
}
const filteredArticles = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return sortedArticles.value
  return sortedArticles.value.filter((a) =>
    (a.title || '').toLowerCase().includes(kw) || stripTags(a.content || '').toLowerCase().includes(kw)
  )
})

const expandedRowKeys = ref<number[]>([])
watch([searchKeyword, filteredArticles], ([kw]) => {
  const k = (kw || '').trim().toLowerCase()
  if (!k) {
    expandedRowKeys.value = []
    return
  }
  expandedRowKeys.value = filteredArticles.value
    .filter((a) => stripTags(a.content || '').toLowerCase().includes(k))
    .map((a) => a.id as number)
    .filter((id) => typeof id === 'number')
}, { immediate: true })
const dateOf = (a: KnowledgeArticle) => (a.created_at || '').slice(0, 10)
const rowClassByDate = (record: KnowledgeArticle, index: number) => {
  const prev = sortedArticles.value[index - 1]
  if (!prev || dateOf(prev) !== dateOf(record)) return 'day-start'
  return ''
}

const fetchAll = async () => {
  loading.value = true
  try {
    const res = await knowledgeApi.list()
    articles.value = res.data
  } catch {
    message.error('获取知识库失败')
  } finally {
    loading.value = false
  }
}

// 将纯文本答案智能排版并高亮重要信息（支持分区、列表、句子分段、内联序列、子标题）
const formatContent = (raw: string, keyword?: string) => {
  if (!raw) return ''
  // 若已包含常见HTML标签，直接使用现有内容，并应用关键字高亮
  if (/<\s*(div|p|ul|ol|li|br|span|h1|h2|h3|h4|h5|pre|code|a|img|blockquote|em|strong)\b/i.test(raw)) {
    const html = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
    return keyword ? highlightHtml(html, keyword) : html
  }

  const escape = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const emphasize = (s: string) => s
    .replace(/(注意[:：]?[^\n]*)/g, '<span class="kb-important">$1</span>')
    .replace(/(重要[:：]?[^\n]*)/g, '<span class="kb-important">$1</span>')
    .replace(/(提示[:：]?[^\n]*)/g, '<span class="kb-important">$1</span>')
    .replace(/(风险[:：]?[^\n]*)/g, '<span class="kb-important">$1</span>')
    .replace(/(警告[:：]?[^\n]*)/g, '<span class="kb-important">$1</span>')
    .replace(/(建议[:：]?[^\n]*)/g, '<span class="kb-important">$1</span>')
    .replace(/【(重要|注意|提示|风险|警告|建议)】/g, '<span class="kb-important">【$1】</span>')

  // 优先按“基础知识 / 客户思路 / 回答话术”结构化渲染
  const hasSections = /(基础知识|客户思路|回答话术)[:：]/.test(raw)
  if (hasSections) {
    const htmlParts: string[] = []
    const section = (name: string) => {
      const m = raw.match(new RegExp(`${name}[:：]([\\s\\S]*?)(?=\\n\\s*(基础知识|客户思路|回答话术)[:：]|$)`))
      if (!m) return
      const content = m[1].trim()
      if (name === '基础知识') {
        const sentences = content.split(/(?<=[。！？；.!?;])\s*/).filter(Boolean)
        const body = sentences.map(s => emphasize(escape(s.trim()))).join('<br/>')
        htmlParts.push(`<div class="kb-block"><div class="kb-section-title">基础知识</div><p>${body}</p></div>`)
      } else if (name === '客户思路') {
        // 识别“1. 标题\n内心独白：...\n潜台词：...”结构
        const items: string[] = []
        const g = new RegExp(`(?:^|\\n)\\s*\\d+[\\.、]\\s*([^\\n]+)\\n([\\s\\S]*?)(?=(?:^|\\n)\\s*\\d+[\\.、]|$)`, 'g')
        let mm: RegExpExecArray | null
        const contentWithHead = '\n' + content // 方便以^或\n匹配
        while ((mm = g.exec(contentWithHead)) !== null) {
          const title = mm[1].trim()
          const detail = mm[2].trim()
          const im = detail.match(/内心独白[:：]\s*([“”"']?[\s\S]*?)(?=\n\s*潜台词[:：]|$)/)
          const sm = detail.match(/潜台词[:：]\s*([\s\S]*)/)
          const inner = im ? im[1].trim() : ''
          const subtext = sm ? sm[1].trim() : ''
          const innerHtml = inner ? `<div class="kb-subtitle">内心独白</div><blockquote class="kb-quote">${emphasize(escape(inner))}</blockquote>` : ''
          const subtextHtml = subtext ? `<div class="kb-subtitle">潜台词</div><p>${emphasize(escape(subtext)).replace(/\n/g,'<br/>')}</p>` : ''
          items.push(`<li><div class="kb-ol-title">${emphasize(escape(title))}</div>${innerHtml}${subtextHtml}</li>`)
        }
        if (items.length) {
          htmlParts.push(`<div class="kb-block"><div class="kb-section-title">客户思路</div><ol>${items.join('')}</ol></div>`)
        } else {
          const body = emphasize(escape(content)).replace(/\n/g,'<br/>')
          htmlParts.push(`<div class="kb-block"><div class="kb-section-title">客户思路</div><p>${body}</p></div>`)
        }
      } else if (name === '回答话术') {
        const body = emphasize(escape(content)).replace(/\n/g,'<br/>')
        htmlParts.push(`<div class="kb-block"><div class="kb-section-title">回答话术</div><p>${body}</p></div>`)
      }
    }
    section('基础知识')
    section('客户思路')
    section('回答话术')
    if (htmlParts.length) return htmlParts.join('')
  }

  // 其次：若存在内联序列（如“一、二、三”或“1.”、“1、”），按序列生成有序列表
  const olInlineRegex = /（?[一二三四五六七八九十]+）\s*|[一二三四五六七八九十]+、\s*|\d+[\.、\)]\s*/g
  const inlineOlMatches = raw.match(olInlineRegex)
  if (inlineOlMatches && inlineOlMatches.length >= 2) {
    const items = raw.split(olInlineRegex).map(t => t.trim()).filter(Boolean).map(t => emphasize(escape(t)))
    return `<div class="kb-block"><ol>${items.map(it => `<li>${it}</li>`).join('')}</ol></div>`
  }

  // 再次：分块—优先按空行，其次按句子分段（中文/英文标点），每1–2句生成一个文档块
  const hasBlankSplit = /\r?\n\s*\r?\n/.test(raw)
  let blocks = [] as string[]
  if (hasBlankSplit) {
    blocks = raw.split(/\r?\n\s*\r?\n/).map(b => b.trim()).filter(Boolean)
  } else {
    const sentences = raw
      .replace(/\s+/g, ' ')
      .split(/(?<=[。！？；.!?;])\s*/)
      .map(s => s.trim())
      .filter(Boolean)
    if (sentences.length > 0) {
      for (let i = 0; i < sentences.length; i += 2) {
        blocks.push(sentences.slice(i, i + 2).join(' '))
      }
    } else {
      blocks = [raw.trim()]
    }
  }

  const htmlBlocks = blocks.map(block => {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const isUl = lines.length > 1 && lines.every(l => /^[-•\u2022]\s+/.test(l))
    const isOl = lines.length > 1 && lines.every(l => /^\d+[\.、\)]\s+/.test(l))
    if (isUl) {
      const items = lines.map(l => l.replace(/^[-•\u2022]\s+/, '')).map(x => emphasize(escape(x)))
      return `<div class="kb-block"><ul>${items.map(it => `<li>${it}</li>`).join('')}</ul></div>`
    }
    if (isOl) {
      const items = lines.map(l => l.replace(/^\d+[\.、\)]\s+/, '')).map(x => emphasize(escape(x)))
      return `<div class="kb-block"><ol>${items.map(it => `<li>${it}</li>`).join('')}</ol></div>`
    }
    // 标题型段落：例如“概述：...”、“规则：...” 等
    const m = lines[0]?.match(/^(概述|规则|步骤|说明|示例|结论|注意|背景|目标|方法|结果|风险|建议)[:：]\s*(.*)$/)
    if (m) {
      const title = escape(m[1])
      const rest = emphasize(escape(m[2]))
      const remain = lines.slice(1).map(l => emphasize(escape(l))).join('<br/>')
      const body = [rest, remain].filter(Boolean).join('<br/>')
      return `<div class="kb-block"><div class="kb-section-title">${title}</div><p>${body}</p></div>`
    }
    const text = emphasize(escape(lines.join('\n'))).replace(/\n/g,'<br/>')
    return `<div class="kb-block"><p>${text}</p></div>`
  })
  return htmlBlocks.join('')
}

// 销售新增
const createOpen = ref(false)
const createForm = ref<{ title: string; content: string }>({ title: '', content: '' })
const openCreate = () => {
  createOpen.value = true
}
const createArticle = async () => {
  const title = createForm.value.title.trim()
  const content = DOMPurify.sanitize(createForm.value.content, { USE_PROFILES: { html: true } }).trim()
  if (!title || !content) {
    message.warning('请填写完整的标题与内容')
    return
  }
  try {
    await knowledgeApi.create({ title, content })
    message.success('新增成功')
    createOpen.value = false
    createForm.value = { title: '', content: '' }
    fetchAll()
  } catch {
    message.error('新增失败')
  }
}

// 导入Mock（管理员，单条）
const bulkOpen = ref(false)
const mockTitle = ref<string>('')
const mockContent = ref<string>('')
const openBulkImport = () => { bulkOpen.value = true }

// 将纯文本内容转换为富文本HTML（段落与列表），并附加Mock标记
const toRichHtml = (text: string) => {
  const escape = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const blocks = text.split(/\r?\n\s*\r?\n/).map(b => b.trim()).filter(Boolean)
  const htmlBlocks = blocks.map(block => {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const isUl = lines.length > 1 && lines.every(l => /^[-•\u2022]\s+/.test(l))
    const isOl = lines.length > 1 && lines.every(l => /^\d+[\.、\)]\s+/.test(l))
    if (isUl) {
      const items = lines.map(l => l.replace(/^[-•\u2022]\s+/, '')).map(escape)
      return `<div class="kb-block"><ul>${items.map(it => `<li>${it}</li>`).join('')}</ul></div>`
    }
    if (isOl) {
      const items = lines.map(l => l.replace(/^\d+[\.、\)]\s+/, '')).map(escape)
      return `<div class="kb-block"><ol>${items.map(it => `<li>${it}</li>`).join('')}</ol></div>`
    }
    return `<div class="kb-block"><p>${escape(lines.join('\n')).replace(/\n/g,'<br/>')}</p></div>`
  })
  const mockTag = '<div class="kb-mock-tag" style="display:none;">系统导入的Mock内容</div>'
  return htmlBlocks.join('') + mockTag
}

const importMockSingle = async () => {
  if (!mockTitle.value.trim() || !mockContent.value.trim()) {
    message.warning('请填写完整的标题与内容')
    return
  }
  try {
    const html = toRichHtml(mockContent.value)
    await knowledgeApi.create({ title: mockTitle.value.trim(), content: html })
    message.success('已导入 1 条 Mock')
    bulkOpen.value = false
    mockTitle.value = ''
    mockContent.value = ''
    await fetchAll()
  } catch {
    message.error('导入失败，请稍后重试')
  }
}

// 已移除“清空Mock数据”按钮；保留后端接口供运维脚本使用

// 管理员编辑与删除
const editOpen = ref(false)
const editForm = ref<{ id?: number; title: string; content: string }>({ title: '', content: '' })
const openEdit = (record: KnowledgeArticle) => {
  editForm.value = { id: record.id, title: record.title, content: record.content }
  editOpen.value = true
}
const updateArticle = async () => {
  if (!editForm.value.id) { editOpen.value = false; return }
  const title = editForm.value.title.trim()
  const content = DOMPurify.sanitize(editForm.value.content, { USE_PROFILES: { html: true } }).trim()
  if (!title || !content) {
    message.warning('请填写完整的标题与内容')
    return
  }
  try {
    await knowledgeApi.update(editForm.value.id, { title, content })
    message.success('已更新')
    editOpen.value = false
    fetchAll()
  } catch {
    message.error('更新失败')
  }
}
const deleteArticle = async (record: KnowledgeArticle) => {
  try {
    await knowledgeApi.delete(record.id)
    message.success('已删除')
    fetchAll()
  } catch {
    message.error('删除失败')
  }
}

onMounted(() => {
  fetchAll()
})
</script>

<style scoped>
.kb-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
.kb-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.kb-list {
  width: 100%;
}
.kb-content {
  line-height: 1.8;
}
.kb-content .kb-block {
  background: #fafafa;
  border-left: 3px solid #fa8c16;
  border-radius: 6px;
  padding: 8px 12px;
  margin: 8px 0;
}
.kb-content .kb-block p { margin: 0; }
.kb-content .kb-block ul,
.kb-content .kb-block ol { margin: 0; padding-left: 20px; }
.kb-content .kb-block li { line-height: 1.8; }
.kb-section-title { font-weight: 600; color: #fa8c16; margin-bottom: 6px; }
.kb-important { color: #d4380d; font-weight: 600; }
.kb-subtitle { color: #8c8c8c; font-weight: 600; margin-top: 6px; }
.kb-quote { margin: 6px 0; padding: 6px 12px; border-left: 3px solid #1890ff; background: #f0f5ff; font-style: italic; }
.kb-ol-title { font-weight: 600; margin-bottom: 4px; }
.kb-content :deep(.kb-search-hit),
.kb-list :deep(.kb-search-hit) { background-color: #fffb8f; color: #d48806; padding: 0 2px; border-radius: 2px; }
/* 每天分隔：为每日第一行加粗顶部边框，实现明显分隔 */
.day-start td {
  border-top: 2px solid #bfbfbf !important;
}
</style>
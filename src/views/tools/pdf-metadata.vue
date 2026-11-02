<template>
  <ToolPage
    ref="pageRef"
    title="PDF修改元数据"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :multiple="false"
    :process-handler="processHandler"
    intro="查看并修改 PDF 的标题、作者、主题、关键词与创建时间。修改结果直接写入 PDF 元数据，在浏览器本地完成。"
    usage="1. 添加一个 PDF 文件（单文件处理）。&#10;2. 修改下方字段；点击「读取当前元数据」可把原文件的元数据填入表单。&#10;3. 点击「开始处理」下载修改后的 PDF。&#10;提示：留空的字段会被清空。创建时间使用本地时间，格式为 YYYY-MM-DD HH:mm。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px">
          <button type="button" class="el-button el-button--info" :disabled="!pageRef || !pageRef.tasks.length" @click="readMetadata">
            <span><i class="fa fa-refresh mr-1"></i> 读取当前元数据</span>
          </button>
          <span style="color:#909399;font-size:13px">读取任务列表中第一个 PDF 的元数据</span>
        </div>

        <div class="mt-3 flex items-center flex-wrap" style="gap:10px 12px">
          <span class="form-label" style="width:72px">标题</span>
          <input v-model="meta.title" class="el-input__inner" style="width:320px" type="text" maxlength="200" />
        </div>
        <div class="mt-2 flex items-center flex-wrap" style="gap:10px 12px">
          <span class="form-label" style="width:72px">作者</span>
          <input v-model="meta.author" class="el-input__inner" style="width:320px" type="text" maxlength="200" />
        </div>
        <div class="mt-2 flex items-center flex-wrap" style="gap:10px 12px">
          <span class="form-label" style="width:72px">主题</span>
          <input v-model="meta.subject" class="el-input__inner" style="width:320px" type="text" maxlength="200" />
        </div>
        <div class="mt-2 flex items-center flex-wrap" style="gap:10px 12px">
          <span class="form-label" style="width:72px">关键词</span>
          <input v-model="meta.keywords" class="el-input__inner" style="width:320px" type="text" maxlength="200" placeholder="逗号分隔" />
        </div>
        <div class="mt-2 flex items-center flex-wrap" style="gap:10px 12px">
          <span class="form-label" style="width:72px">创建时间</span>
          <input v-model="meta.date" class="el-input__inner" style="width:220px" type="datetime-local" />
          <span style="color:#909399;font-size:13px">留空则清除创建时间</span>
        </div>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { reactive, ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadBlob } from '../../lib/ui.js'
import { loadPdfDoc, pdfBlob } from '../../lib/pdf.js'

const pageRef = ref(null)

const meta = reactive({
  title: '',
  author: '',
  subject: '',
  keywords: '',
  date: ''
})

function pad2(n) { return String(n).padStart(2, '0') }

function toLocalInput(date) {
  if (!date || Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

async function readMetadata() {
  const task = pageRef.value && pageRef.value.tasks[0]
  if (!task) { msgError('请先添加一个 PDF 文件'); return }
  try {
    const { doc } = await loadPdfDoc(task.file)
    meta.title = doc.getTitle() || ''
    meta.author = doc.getAuthor() || ''
    meta.subject = doc.getSubject() || ''
    meta.keywords = doc.getKeywords() || ''
    const created = doc.getCreationDate()
    meta.date = toLocalInput(created)
    msgSuccess('已读取当前元数据')
  } catch (e) {
    msgError(`读取失败：${e.message || e}`)
  }
}

async function processHandler(tasks) {
  const task = tasks[0]
  task.status = 'processing'
  try {
    const { doc } = await loadPdfDoc(task.file)
    doc.setTitle(meta.title)
    doc.setAuthor(meta.author)
    doc.setSubject(meta.subject)
    doc.setKeywords(meta.keywords ? meta.keywords.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [])
    doc.setProducer('Toolbox')
    doc.setModificationDate(new Date())
    if (meta.date) {
      const d = new Date(meta.date)
      if (Number.isNaN(d.getTime())) throw new Error('创建时间格式无效')
      doc.setCreationDate(d)
    } else {
      doc.setCreationDate(new Date(0))
      // pdf-lib 没有 removeCreationDate，设为纪元时间表示「未设置」
    }

    const bytes = await doc.save()
    task.status = 'done'
    task.outSize = bytes.length
    downloadBlob(pdfBlob(bytes), `${baseName(task.file.name)}_metadata.pdf`)
    msgSuccess('元数据已更新并下载')
  } catch (e) {
    task.status = 'failed'
    task.error = e.message || String(e)
    msgError(`处理失败：${e.message || e}`)
  }
}
</script>

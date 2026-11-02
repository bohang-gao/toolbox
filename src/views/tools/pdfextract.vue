<template>
  <ToolPage
    ref="pageRef"
    title="PDF提取页面"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="从 PDF 中提取指定页码，生成一个新的 PDF 文件。页码支持 1-3,5 这类写法，页面按输入顺序排列。"
    usage="1. 添加一个或多个 PDF 文件。&#10;2. 输入要提取的页码，例如 1-3,5（每段按输入顺序排列）。&#10;3. 点击「开始处理」，每个 PDF 输出一个提取结果并打包下载。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px">
          <span class="form-label">提取页码</span>
          <input
            v-model="rangeText"
            class="el-input__inner"
            style="width:260px"
            type="text"
            placeholder="例如：1-3,5"
          />
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          只生成一个 PDF；重复输入的页码会自动去重。范围示例：2-5 表示第 2 到第 5 页。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadZip } from '../../lib/ui.js'
import {
  loadPdfDoc, copyPagesToNewDoc, parsePageGroups, flattenGroups,
  pagesToLabel, pdfBlob
} from '../../lib/pdf.js'

const pageRef = ref(null)
const rangeText = ref('1-3,5')

async function extractOne(file) {
  const { doc } = await loadPdfDoc(file)
  const total = doc.getPageCount()
  const { groups, error } = parsePageGroups(rangeText.value, total)
  if (error) throw new Error(error)
  const pages = flattenGroups(groups)
  if (!pages.length) throw new Error('请输入要提取的页码')

  const outDoc = await copyPagesToNewDoc(doc, pages)
  const bytes = await outDoc.save()
  return {
    blob: pdfBlob(bytes),
    name: `${baseName(file.name)}_pages_${pagesToLabel(pages)}.pdf`,
    count: pages.length
  }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await extractOne(t.file)
      t.status = 'done'
      t.outSize = out.blob.size
      outputs.push(out)
    } catch (e) {
      t.status = 'failed'
      t.error = e.message || String(e)
      msgError(`${t.file.name}：${t.error}`)
    }
  }
  if (outputs.length) {
    await downloadZip(outputs, 'extracted.zip')
    msgSuccess(`提取完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>

<template>
  <ToolPage
    ref="pageRef"
    title="PDF合并"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="在浏览器本地把多个 PDF 文件按任务列表顺序合并成一个 PDF，不会上传到任何服务器。"
    usage="1. 点击上传区或「添加文件」选择一个或多个 PDF（可分批添加）。&#10;2. 任务列表中的顺序即合并后的页序，可先清空再重新添加调整顺序。&#10;3. 点击「开始处理」，完成后自动下载合并结果。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <p style="color:#606266">按任务列表顺序合并；加密或损坏的 PDF 会单独标记失败并跳过。</p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import { PDFDocument } from 'pdf-lib'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName } from '../../lib/ui.js'
import { loadPdfDoc, saveAndDownload } from '../../lib/pdf.js'

const pageRef = ref(null)

async function processHandler(tasks) {
  const out = await PDFDocument.create()
  let pageCount = 0
  let okCount = 0

  for (const t of tasks) {
    t.status = 'processing'
    try {
      const { doc } = await loadPdfDoc(t.file)
      const pages = await out.copyPages(doc, doc.getPageIndices())
      for (const p of pages) out.addPage(p)
      pageCount += pages.length
      okCount++
      t.status = 'done'
    } catch (e) {
      t.status = 'failed'
      t.error = e.message || String(e)
      msgError(`${t.file.name}：${t.error}`)
    }
  }

  if (okCount < 2) {
    msgError(okCount === 0 ? '没有可合并的 PDF 文件' : '至少需要两个有效的 PDF 文件才能合并')
    return
  }

  const first = tasks.find(t => t.status === 'done')
  const name = `${baseName(first.file.name)}_merged.pdf`
  await saveAndDownload(out, name)
  msgSuccess(`合并完成：${okCount} 个文件，共 ${pageCount} 页`)
}
</script>

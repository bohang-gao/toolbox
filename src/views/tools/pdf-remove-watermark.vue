<template>
  <ToolPage
    ref="pageRef"
    title="PDF去水印"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="简化实现：不解析 PDF 内部对象来精准删除水印，而是把每一页重新渲染为图片，再重新组装成「图片型 PDF」。这样能去掉绝大多数水印，但会丢失文字层（不可再复制/搜索），且文件可能变大。"
    usage="1. 添加一个或多个 PDF 文件。&#10;2. 选择渲染缩放倍数（越高越清晰、文件越大）。&#10;3. 点击「开始处理」，每个文件输出图片型 PDF 并打包下载。&#10;注意：与原站「精准移除水印对象」的实现不同——本工具是渲染重建，文字会变为图片，体积通常增大；不适用于需要保留可搜索文字的文档。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 16px">
          <span class="form-label">渲染缩放</span>
          <select v-model.number="scale" class="el-input__inner" style="width:150px">
            <option :value="1.5">1.5×</option>
            <option :value="2">2×</option>
            <option :value="3">3×</option>
          </select>
          <span class="form-label">图片质量</span>
          <input v-model.number="quality" class="el-input__inner" style="width:110px" type="number" min="40" max="100" />
          <span style="color:#909399">%</span>
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          简化实现说明：按页渲染重建为图片型 PDF，文字不可选中/搜索；压缩质量越高体积越大。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import { PDFDocument } from 'pdf-lib'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadZip, canvasToBlob } from '../../lib/ui.js'
import { openPdf, renderPageToCanvas, closePdf } from '../../lib/pdf-render.js'
import { pdfBlob, clampNumber } from '../../lib/pdf.js'

const pageRef = ref(null)
const scale = ref(2)
const quality = ref(85)

async function rebuildOne(file) {
  const src = await openPdf(file)
  const out = await PDFDocument.create()
  const q = clampNumber(quality.value, 40, 100, 85) / 100
  try {
    const total = src.numPages
    for (let i = 1; i <= total; i++) {
      const page = await src.getPage(i)
      const { canvas, viewport } = await renderPageToCanvas(page, Number(scale.value) || 2)
      const blob = await canvasToBlob(canvas, 'image/jpeg', q)
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const jpg = await out.embedJpg(bytes)
      // 使用页面原始尺寸（pt），保持与原 PDF 相同的物理页面大小
      const baseViewport = page.getViewport({ scale: 1 })
      const outPage = out.addPage([baseViewport.width, baseViewport.height])
      outPage.drawImage(jpg, {
        x: 0,
        y: 0,
        width: baseViewport.width,
        height: baseViewport.height
      })
      page.cleanup()
      void viewport
    }
  } finally {
    await closePdf(src)
  }
  const bytes = await out.save()
  return { blob: pdfBlob(bytes), name: `${baseName(file.name)}_no-watermark.pdf` }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await rebuildOne(t.file)
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
    await downloadZip(outputs, 'no-watermark.zip')
    msgSuccess(`处理完成，共 ${outputs.length} 个文件（图片型 PDF，文字层已移除）`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>

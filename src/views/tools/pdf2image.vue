<template>
  <ToolPage
    ref="pageRef"
    title="PDF转图片"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="用 pdfjs-dist 在浏览器本地把 PDF 的每一页渲染为 PNG 图片，可调整缩放倍数，支持单页下载或全部打包 zip。"
    usage="1. 添加一个或多个 PDF 文件。&#10;2. 选择渲染缩放倍数（默认 2 倍，倍数越高越清晰、文件越大）。&#10;3. 点击「开始处理」，每页输出一张 PNG；多张时打包成 zip 下载。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 16px">
          <span class="form-label">渲染缩放</span>
          <select v-model.number="scale" class="el-input__inner" style="width:150px">
            <option :value="1">1× （约 72 DPI）</option>
            <option :value="1.5">1.5× （约 108 DPI）</option>
            <option :value="2">2× （约 144 DPI）</option>
            <option :value="3">3× （约 216 DPI）</option>
            <option :value="4">4× （约 288 DPI）</option>
          </select>
          <span style="color:#909399;font-size:13px">输出格式：PNG（带白底）</span>
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          页面过大时会受浏览器 canvas 尺寸上限约束，可选择较小倍数重试。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadZip, canvasToBlob } from '../../lib/ui.js'
import { openPdf, renderPageToCanvas, closePdf } from '../../lib/pdf-render.js'

const pageRef = ref(null)
const scale = ref(2)

async function renderOne(file) {
  const doc = await openPdf(file)
  const outputs = []
  try {
    const total = doc.numPages
    const pad = String(total).length
    for (let i = 1; i <= total; i++) {
      const page = await doc.getPage(i)
      const { canvas } = await renderPageToCanvas(page, Number(scale.value) || 2)
      const blob = await canvasToBlob(canvas, 'image/png')
      outputs.push({
        blob,
        name: `${baseName(file.name)}_page_${String(i).padStart(pad, '0')}.png`
      })
      page.cleanup()
    }
  } finally {
    await closePdf(doc)
  }
  return outputs
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const files = await renderOne(t.file)
      t.status = 'done'
      t.outSize = files.reduce((s, f) => s + f.blob.size, 0)
      outputs.push(...files)
    } catch (e) {
      t.status = 'failed'
      t.error = e.message || String(e)
      msgError(`${t.file.name}：${t.error}`)
    }
  }
  if (outputs.length) {
    await downloadZip(outputs, 'pdf2image.zip')
    msgSuccess(`转换完成，共生成 ${outputs.length} 张图片`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>

<template>
  <ToolPage
    ref="pageRef"
    title="PDF转长图"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="把 PDF 的所有页面按顺序纵向拼接成一张长图（PNG）。页面宽度统一为最大页宽，页面之间可留白。全程在浏览器本地渲染。"
    usage="1. 添加一个或多个 PDF 文件。&#10;2. 选择渲染缩放倍数与页面间距。&#10;3. 点击「开始处理」，每个 PDF 输出一张纵向长图，多文件打包 zip 下载。&#10;提示：页数很多或倍数很高时，长图可能超过浏览器 canvas 尺寸上限，会给出明确错误。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 16px">
          <span class="form-label">渲染缩放</span>
          <select v-model.number="scale" class="el-input__inner" style="width:150px">
            <option :value="1">1×</option>
            <option :value="1.5">1.5×</option>
            <option :value="2">2×</option>
            <option :value="3">3×</option>
          </select>
          <span class="form-label">页面间距</span>
          <input v-model.number="gap" class="el-input__inner" style="width:110px" type="number" min="0" max="200" />
          <span style="color:#909399">px</span>
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          各页按最大页宽居中，多余区域填充白色背景。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadZip, canvasToBlob } from '../../lib/ui.js'
import { openPdf, renderPageToCanvas, closePdf, MAX_CANVAS_SIDE } from '../../lib/pdf-render.js'

const pageRef = ref(null)
const scale = ref(1.5)
const gap = ref(12)

async function longImageOne(file) {
  const doc = await openPdf(file)
  const rendered = []
  try {
    const total = doc.numPages
    for (let i = 1; i <= total; i++) {
      const page = await doc.getPage(i)
      const { canvas } = await renderPageToCanvas(page, Number(scale.value) || 1.5)
      rendered.push(canvas)
      page.cleanup()
    }
  } finally {
    await closePdf(doc)
  }
  if (!rendered.length) throw new Error('PDF 没有可渲染的页面')

  const spacing = Math.max(0, Math.min(200, Math.round(Number(gap.value) || 0)))
  const width = Math.max(...rendered.map(c => c.width))
  const height = rendered.reduce((s, c) => s + c.height, 0) + spacing * (rendered.length - 1)
  if (height > MAX_CANVAS_SIDE) {
    throw new Error(`长图高度 ${height}px 超出浏览器 canvas 上限 ${MAX_CANVAS_SIDE}px，请降低缩放倍数或拆分 PDF`)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)

  let y = 0
  for (const c of rendered) {
    ctx.drawImage(c, Math.round((width - c.width) / 2), y)
    y += c.height + spacing
  }

  const blob = await canvasToBlob(canvas, 'image/png')
  return { blob, name: `${baseName(file.name)}_long.png`, pages: rendered.length }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await longImageOne(t.file)
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
    await downloadZip(outputs, 'long-images.zip')
    msgSuccess(`转换完成，共 ${outputs.length} 张长图`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>

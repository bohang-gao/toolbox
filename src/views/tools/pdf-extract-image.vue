<template>
  <ToolPage
    ref="pageRef"
    title="PDF提取图片"
    accept="application/pdf,.pdf"
    :validator="pdfValidator"
    :process-handler="processHandler"
    intro="使用 pdfjs-dist 分析 PDF 内容流，提取页面中嵌入的图片（不包含矢量图形与文字渲染结果），支持逐张下载或打包 zip。"
    usage="1. 添加一个或多个 PDF 文件。&#10;2. 点击「开始处理」，每个文件输出其中内嵌的图片。&#10;3. 结果打包 zip 下载。&#10;说明：仅能提取 PDF 中直接嵌入的位图（JPEG/PNG/位图流）；被裁剪或仅作蒙版的图片可能无法提取，扫描件整页图通常可以提取。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 20px">
          <span class="form-label">最小尺寸</span>
          <input v-model.number="minSize" class="el-input__inner" style="width:130px" type="number" min="1" max="2000" />
          <span style="color:#909399;font-size:13px">px（小于该宽/高的图片会被忽略，用于过滤图标）</span>
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          提取结果为 PNG（保留透明度），文件名按页码与序号命名。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import { pdfValidator, msgSuccess, msgError, baseName, downloadZip, canvasToBlob } from '../../lib/ui.js'
import { openPdf, collectPageImages, imgDataToCanvas, closePdf } from '../../lib/pdf-render.js'
import { clampNumber } from '../../lib/pdf.js'

const pageRef = ref(null)
const minSize = ref(16)

async function extractOne(file) {
  const doc = await openPdf(file)
  const outputs = []
  const min = clampNumber(minSize.value, 1, 2000, 16)
  try {
    const total = doc.numPages
    for (let i = 1; i <= total; i++) {
      const page = await doc.getPage(i)
      const images = await collectPageImages(page)
      let idx = 0
      for (const imgData of images) {
        idx++
        if (!imgData || !imgData.width || !imgData.height) continue
        if (imgData.width < min && imgData.height < min) continue
        const canvas = imgDataToCanvas(imgData)
        if (!canvas) continue
        const blob = await canvasToBlob(canvas, 'image/png')
        outputs.push({
          blob,
          name: `${baseName(file.name)}_p${i}_img${idx}_${imgData.width}x${imgData.height}.png`
        })
      }
      page.cleanup()
    }
  } finally {
    await closePdf(doc)
  }
  if (!outputs.length) throw new Error('未在该 PDF 中找到可提取的内嵌图片')
  return outputs
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const files = await extractOne(t.file)
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
    await downloadZip(outputs, 'pdf-images.zip')
    msgSuccess(`提取完成，共 ${outputs.length} 张图片`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>

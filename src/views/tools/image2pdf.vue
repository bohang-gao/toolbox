<template>
  <ToolPage
    ref="pageRef"
    title="图片转PDF"
    accept="image/*"
    :validator="imageValidator"
    make-thumb
    :process-handler="processHandler"
    intro="在浏览器本地使用 pdf-lib 将多张图片合成一个 PDF，每张图片单独一页；页面方向会按图片宽高自动选择横向或纵向。"
    usage="1. 点击上传区或「添加文件」选择多张图片（顺序即 PDF 页序）。&#10;2. 点击「开始处理」，图片会按 A4 页面等比缩放并居中放置。&#10;3. 处理完成后自动下载 PDF 文件。&#10;提示：JPG / PNG 直接嵌入，其它格式会先转换为 PNG 再嵌入。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <p style="color:#606266">每张图片生成一页 A4 PDF：宽大于高时自动使用横向页面，否则使用纵向页面；图片等比缩放并居中。</p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import { PDFDocument } from 'pdf-lib'
import ToolPage from '../../components/ToolPage.vue'
import {
  imageValidator, loadImage, canvasToBlob, downloadBlob,
  baseName, msgSuccess, msgError
} from '../../lib/ui.js'

const pageRef = ref(null)

const A4_W = 595.28
const A4_H = 841.89

async function embedImage(pdfDoc, file, img) {
  if (file.type === 'image/jpeg') {
    const bytes = new Uint8Array(await file.arrayBuffer())
    return pdfDoc.embedJpg(bytes)
  }
  if (file.type === 'image/png') {
    const bytes = new Uint8Array(await file.arrayBuffer())
    return pdfDoc.embedPng(bytes)
  }
  // 其它格式（webp / gif / bmp 等）先转为 PNG
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const blob = await canvasToBlob(canvas, 'image/png')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return pdfDoc.embedPng(bytes)
}

async function processHandler(tasks) {
  const pdfDoc = await PDFDocument.create()
  let added = 0

  for (const t of tasks) {
    t.status = 'processing'
    try {
      const img = await loadImage(t.file)
      const embedded = await embedImage(pdfDoc, t.file, img)
      const landscape = img.naturalWidth > img.naturalHeight
      const pageW = landscape ? A4_H : A4_W
      const pageH = landscape ? A4_W : A4_H

      const scale = Math.min(pageW / img.naturalWidth, pageH / img.naturalHeight)
      const drawW = img.naturalWidth * scale
      const drawH = img.naturalHeight * scale

      const page = pdfDoc.addPage([pageW, pageH])
      page.drawImage(embedded, {
        x: (pageW - drawW) / 2,
        y: (pageH - drawH) / 2,
        width: drawW,
        height: drawH
      })
      t.status = 'done'
      added++
    } catch (e) {
      t.status = 'failed'
      t.error = e.message || String(e)
      msgError(`${t.file.name}：${t.error}`)
    }
  }

  if (!added) {
    msgError('没有可转换的图片')
    return
  }

  const bytes = await pdfDoc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const firstName = tasks.find(t => t.status === 'done')
  const name = firstName ? `${baseName(firstName.file.name)}.pdf` : 'images.pdf'
  downloadBlob(blob, name)
  msgSuccess(`已生成 PDF，共 ${added} 页`)
}
</script>

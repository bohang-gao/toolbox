<template>
  <ToolPage
    ref="pageRef"
    title="图片转PNG"
    accept="image/*"
    :validator="imageValidator"
    make-thumb
    :process-handler="processHandler"
    intro="把 JPG / WebP / GIF / BMP 等格式批量转换为 PNG，保留透明通道。"
    usage="1. 点击上传区或「添加文件」选择图片，支持多选与拖拽。&#10;2. 点击「开始处理」，完成后自动下载（单文件直接下载，多文件打包 zip）。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <p style="color:#909399;font-size:13px">
          PNG 为无损格式，输出文件通常比 JPG 大；支持透明背景。
        </p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import {
  imageValidator, loadImage, canvasToBlob, baseName,
  downloadZip, msgSuccess, msgError
} from '../../lib/ui.js'

const pageRef = ref(null)

async function convertOne(t) {
  const img = await loadImage(t.file)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const blob = await canvasToBlob(canvas, 'image/png')
  return { blob, name: `${baseName(t.file.name)}.png` }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await convertOne(t)
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
    await downloadZip(outputs, 'png.zip')
    msgSuccess(`转换完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>

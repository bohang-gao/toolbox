<template>
  <ToolPage
    ref="pageRef"
    title="图片转webp"
    accept="image/*"
    :validator="imageValidator"
    make-thumb
    :process-handler="processHandler"
    intro="把 JPG / PNG / GIF / BMP 等格式批量转换为 WebP，体积更小且支持透明。"
    usage="1. 点击上传区或「添加文件」选择图片，支持多选与拖拽。&#10;2. 调整 WebP 输出质量（默认 92）。&#10;3. 点击「开始处理」，完成后自动下载（单文件直接下载，多文件打包 zip）。&#10;注意：需要浏览器支持 WebP 编码（Chrome / Edge / Firefox 等现代浏览器）。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="el-slider">
          <span class="form-label" style="flex-shrink:0">输出质量</span>
          <input v-model.number="quality" type="range" min="1" max="100" />
          <span style="min-width:40px;text-align:right;color:#606266">{{ quality }}</span>
        </div>
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
const quality = ref(92)

async function convertOne(t) {
  const img = await loadImage(t.file)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const q = Math.min(1, Math.max(0.01, Number(quality.value) / 100))
  const blob = await canvasToBlob(canvas, 'image/webp', q)
  if (blob.type !== 'image/webp') throw new Error('当前浏览器不支持 WebP 编码')
  return { blob, name: `${baseName(t.file.name)}.webp` }
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
    await downloadZip(outputs, 'webp.zip')
    msgSuccess(`转换完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>

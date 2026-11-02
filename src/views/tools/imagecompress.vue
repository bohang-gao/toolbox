<template>
  <ToolPage
    ref="pageRef"
    title="图片压缩"
    accept="image/*"
    :validator="imageValidator"
    make-thumb
    :process-handler="processHandler"
    intro="在浏览器本地对图片重新编码，减小文件体积；可选等比缩放，压缩前后体积会显示在任务列表中。"
    usage="1. 点击上传区或「添加文件」选择图片，支持多选与拖拽。&#10;2. 拖动滑杆设置压缩质量（1-100，默认 80），数值越低体积越小。&#10;3. 可选按百分比或最大宽等比缩放。&#10;4. 点击「开始处理」，完成后自动下载（单文件直接下载，多文件打包 zip）。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="el-slider">
          <span class="form-label" style="flex-shrink:0">压缩质量</span>
          <input v-model.number="quality" type="range" min="1" max="100" />
          <span style="min-width:40px;text-align:right;color:#606266">{{ quality }}</span>
        </div>
        <div class="mt-2 flex items-center flex-wrap" style="gap:12px 16px">
          <span class="form-label">尺寸</span>
          <label class="el-radio"><input v-model="resizeMode" type="radio" value="none" />不缩放</label>
          <label class="el-radio"><input v-model="resizeMode" type="radio" value="percent" />按百分比</label>
          <label class="el-radio"><input v-model="resizeMode" type="radio" value="maxwidth" />按最大宽</label>
          <template v-if="resizeMode === 'percent'">
            <input v-model.number="percent" class="el-input__inner" style="width:100px" type="number" min="1" max="400" />
            <span style="color:#909399">%</span>
          </template>
          <template v-else-if="resizeMode === 'maxwidth'">
            <input v-model.number="maxWidth" class="el-input__inner" style="width:120px" type="number" min="1" max="20000" />
            <span style="color:#909399">px</span>
          </template>
        </div>
        <p class="mt-2" style="color:#909399;font-size:13px">
          JPG / WebP 按质量重新编码；PNG 等其它格式会转为 JPG（透明区域填充白色）。
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
const quality = ref(80)
const resizeMode = ref('none')
const percent = ref(80)
const maxWidth = ref(1280)

function pickMime(file) {
  return file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
}

function targetSize(w, h) {
  let scale = 1
  if (resizeMode.value === 'percent') {
    scale = Math.min(400, Math.max(1, Number(percent.value) || 100)) / 100
  } else if (resizeMode.value === 'maxwidth') {
    const mw = Math.min(20000, Math.max(1, Math.round(Number(maxWidth.value) || w)))
    if (w > mw) scale = mw / w
  }
  return {
    w: Math.max(1, Math.round(w * scale)),
    h: Math.max(1, Math.round(h * scale))
  }
}

async function compressOne(t) {
  const img = await loadImage(t.file)
  const size = targetSize(img.naturalWidth, img.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = size.w
  canvas.height = size.h
  const ctx = canvas.getContext('2d')
  const mime = pickMime(t.file)
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, size.w, size.h)
  }
  ctx.drawImage(img, 0, 0, size.w, size.h)
  const q = Math.min(1, Math.max(0.01, Number(quality.value) / 100))
  const blob = await canvasToBlob(canvas, mime, q)
  const ext = mime === 'image/webp' ? 'webp' : 'jpg'
  return { blob, name: `${baseName(t.file.name)}.${ext}` }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await compressOne(t)
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
    await downloadZip(outputs, 'compressed.zip')
    msgSuccess(`处理完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>
